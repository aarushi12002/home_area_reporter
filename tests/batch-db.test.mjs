import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { getDatabase, closeDatabase } from "../lib/db.mjs";
import { runIngestionBatch } from "../lib/ingestion.mjs";
import { databaseAreaSummary, paginatedProjects } from "../lib/project-repository.mjs";
import { reportTools } from "../lib/mcp.mjs";
import { consumeMcpQuota } from "../lib/mcp-rate-limit.mjs";

test("real Postgres batch publication, pagination, recovery and overlap protection", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const name = `batch_test_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(process.env.TEST_DATABASE_URL, { max: 1 });
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.pathname = `/${name}`;
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url.toString();
  const { sql } = getDatabase();
  t.after(async () => {
    await closeDatabase();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
    await admin.unsafe(`DROP DATABASE ${name}`); await admin.end();
  });
  for (const migration of ["0000_area_pipeline.sql", "0001_batch_reports.sql", "0002_quarantine.sql", "0003_mcp_rate_limits.sql"])
    await sql.unsafe(await readFile(new URL(`../drizzle/${migration}`, import.meta.url), "utf8"));

  const now = new Date("2026-10-24T20:00:00Z");
  let version = 1, mode = "normal";
  const records = () => Array.from({ length: 26 }, (_, i) => ({
    permitnum: `TEST-${i}-CN`, originalzip: "98107", originaladdress1: `${i + 1} Example Ave NW`,
    description: `Construct new ${i + 2} unit apartment building${mode === "publication-failure" ? " FAIL" : ""}`,
    statuscurrent: version === 2 && i === 0 ? "Completed" : "Reviews In Process", housingunitsadded: String(i + 2),
    applieddate: "2026-10-01", latitude: "47.67", longitude: String(-122.38 + i * 0.0001),
  }));
  const fetcher = async (request) => {
    const url = new URL(request);
    if (url.searchParams.get("$select") === "count(*) as count") return { ok: true, json: async () => [{ count: url.pathname.includes("ht3q-kdvx") ? "0" : String(records().length) }] };
    if (url.pathname.includes("ht3q-kdvx")) {
      if (mode === "source-failure") return { ok: false, status: 503 };
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => records() };
  };
  const run = () => runIngestionBatch({ sql, zips: ["98107"], now, fetcher, maxAttempts: 1 });

  const first = await run();
  assert.equal(first.areas[0].readiness, "backfilling");
  assert.equal(await databaseAreaSummary("98107"), null);
  const second = await run();
  assert.equal(second.areas[0].readiness, "ready");
  const snapshot = await databaseAreaSummary("98107");
  const mcpSummary = await reportTools.get_zip_summary({ zip: "98107" });
  assert.equal(mcpSummary.generation, snapshot.generation);
  assert.deepEqual(mcpSummary.highlights, snapshot.highlights);
  assert.equal(mcpSummary.fullReportUrl, "https://home-area-reporter.vercel.app/report?zip=98107");
  const mcpProjects = await reportTools.list_projects({ zip: "98107", limit: 20 });
  assert.equal(mcpProjects.items.length, 20);
  const evidence = await reportTools.get_project({ id: mcpProjects.items[0].id, generation: mcpProjects.generation });
  assert.ok(evidence.events.length);
  await sql`INSERT INTO area_baselines (postal_code, vintage, metrics, provenance, retrieved_at) VALUES ('02139', '2024', '{"population":{"estimate":100,"marginOfError":5}}', '{"observationPeriod":"2020–2024"}', now())`;
  assert.equal((await reportTools.get_zip_summary({ zip: "02139" })).reportType, "baseline");
  assert.equal((await reportTools.list_supported_zipcodes({ zip: "02139" })).baseline.zip, "02139");
  assert.equal((await reportTools.list_projects({ zip: "02139" })).coverageStatus, "not_connected");
  const quotas = await Promise.all(Array.from({ length: 12 }, () => consumeMcpQuota("test-client", { sql, perClient: 5, global: 10 })));
  assert.equal(quotas.filter((quota) => quota.allowed).length, 5);
  assert.equal((await consumeMcpQuota("other-client", { sql, perClient: 5, global: 10 })).allowed, false);
  await sql`INSERT INTO mcp_rate_limits (bucket, window_start) VALUES ('expired', now() - interval '2 hours')`;
  await consumeMcpQuota("cleanup", { sql });
  assert.equal(Number((await sql`SELECT count(*) FROM mcp_rate_limits WHERE bucket = 'expired'`)[0].count), 0);
  assert.equal(snapshot.totalCurrentProjects, 26);
  assert.equal(snapshot.highlights.length, 15);
  const { GET: summaryRoute } = await import("../app/api/area-summary/route.js");
  for (const [query, expected] of [["zip=98107", "public"], ["zip=98107&lat=47.67&lng=-122.38", "private"], ["zip=98107&address=Example", "private"], ["zip=98107&refresh=1", "private"]]) {
    const response = await summaryRoute(new Request(`https://example.test/api/area-summary?${query}`));
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("cache-control").startsWith(expected));
  }

  const invalidLocation = await summaryRoute(new Request("https://example.test/api/area-summary?zip=98107&lat=bad&lng=-122.38"));
  assert.equal(invalidLocation.status, 400);
  assert.equal(invalidLocation.headers.get("cache-control"), "private, no-store");
  const page1 = await paginatedProjects("98107", { limit: 10 });
  const page2 = await paginatedProjects("98107", { cursor: page1.nextCursor, limit: 10 });
  const page3 = await paginatedProjects("98107", { cursor: page2.nextCursor, limit: 10 });
  assert.equal(new Set([...page1.items, ...page2.items, ...page3.items].map((p) => p.id)).size, 26);
  assert.equal(page3.nextCursor, null);
  const nearby = await paginatedProjects("98107", { location: { latitude: 47.67, longitude: -122.38 } });
  assert.equal(nearby.items.length, 20);
  assert.ok(nearby.items.every((p) => Number.isFinite(p.distanceMiles)));

  mode = "source-failure";
  await assert.rejects(run(), /HTTP 503/);
  assert.equal((await databaseAreaSummary("98107")).generation, second.batchId);
  assert.equal(Number((await sql`SELECT count(*) FROM projects`)[0].count), 26);

  await sql.unsafe(`CREATE FUNCTION reject_test_project() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.summary LIKE '%FAIL' THEN RAISE EXCEPTION 'Injected publication failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_test_project BEFORE INSERT ON projects FOR EACH ROW EXECUTE FUNCTION reject_test_project();`);
  mode = "publication-failure";
  await assert.rejects(run(), /Injected publication failure/);
  assert.equal((await databaseAreaSummary("98107")).generation, second.batchId);
  assert.equal(Number((await sql`SELECT count(*) FROM projects`)[0].count), 26);
  await sql.unsafe("DROP TRIGGER reject_test_project ON projects; DROP FUNCTION reject_test_project()");

  mode = "normal"; version = 2;
  await run();
  assert.equal((await databaseAreaSummary("98107")).totalCurrentProjects, 25);
  await assert.rejects(paginatedProjects("98107", { cursor: page1.nextCursor }), (error) => error.code === "REPORT_UPDATED");

  const owner = randomUUID();
  await sql`INSERT INTO ingestion_batches (id, jurisdiction_id, status, lease_until) VALUES (${owner}, 'us-wa-seattle', 'running', now() + interval '10 minutes')`;
  await assert.rejects(run(), (error) => error.code === "23505");
  await sql`UPDATE ingestion_batches SET lease_until = now() - interval '1 minute' WHERE id = ${owner}`;
  await run();
  assert.equal((await sql`SELECT status FROM ingestion_batches WHERE id = ${owner}`)[0].status, "failed");
});
