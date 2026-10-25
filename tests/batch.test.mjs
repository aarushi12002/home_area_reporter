import test from "node:test";
import assert from "node:assert/strict";
import { SEATTLE_ZIPS, serviceArea, sourcePostalCode, validPostalCode, sectionAvailability } from "../lib/service-areas.mjs";
import { partitionSourceRecords, fetchAllSourceRecords, insideSeattle, settleSources } from "../lib/ingestion.mjs";
import { sourceAdapter, adaptersForJurisdiction } from "../lib/source-adapters.mjs";
import { SOURCES } from "../lib/report.mjs";
import { getZipProfile } from "../lib/zip-profile.mjs";
import { buildProjects, normalizeSourceRow } from "../lib/project-pipeline.mjs";
import { encodeCursor, decodeCursor, orderingContext, locationFrom } from "../lib/report-cursor.mjs";
import { GET as summary } from "../app/api/area-summary/route.js";
import { GET as coverage } from "../app/api/service-areas/route.js";
import { BASELINE_METRICS, normalizeBaseline, fetchBaseline } from "../lib/baseline.mjs";

test("reviewed registry includes institutional ZIPs, distinguishes shared areas and preserves leading zeros", () => {
  assert.equal(SEATTLE_ZIPS.length, 31);
  for (const zip of ["98154", "98164", "98174", "98195"]) assert.ok(serviceArea(zip));
  assert.equal(serviceArea("98133").shared, true);
  assert.equal(serviceArea("98155"), null);
  assert.equal(validPostalCode("02108"), true);
  assert.equal(sourcePostalCode("02108-1234"), "02108");
  for (const value of ["98103oops", "0", "98103 OR 1=1", 98103]) assert.equal(sourcePostalCode(value), null);
});

test("all reviewed Seattle areas have current named facts in four groups and transit geography", () => {
  for (const zip of SEATTLE_ZIPS) {
    const profile = getZipProfile(zip, { now: new Date("2026-10-24T20:00:00Z") });
    assert.ok(profile, zip);
    assert.equal(profile.groups.length, 4);
    assert.ok(profile.groups.every((group) => group.places.length > 0), zip);
    assert.equal(sectionAvailability(zip, { profile, now: new Date("2026-10-24") }).neighborhood, "ready");
    for (const group of profile.groups) for (const place of group.places) {
      assert.equal(new URL(place.url).protocol, "https:");
      if (place.postalCode && place.postalCode !== zip) assert.equal(place.relation, "nearby");
    }
  }
});

test("batch partition reconciles bad ZIPs, outside-city geometry, and records without coordinates", () => {
  assert.equal(insideSeattle(-122.34, 47.67), true);
  assert.equal(insideSeattle(-122.34, 47.78), false);
  const adapter = sourceAdapter(SOURCES[0]);
  const records = [
    { permitnum: "A", originalzip: "98103", latitude: "47.67", longitude: "-122.34" },
    { permitnum: "B", originalzip: "98133", latitude: "47.78", longitude: "-122.34" },
    { permitnum: "C", originalzip: "98103-1234" },
    { permitnum: "D", originalzip: "78" },
    { permitnum: "E", originalzip: "98004" },
    { permitnum: "F", originalzip: "98103", latitude: "NaN", longitude: "-122.34" },
  ];
  const result = partitionSourceRecords(adapter, records);
  assert.equal(result.received, result.acceptedCount + result.quarantinedCount);
  assert.equal(result.accepted.get("98103").length, 2);
  assert.deepEqual(result.quarantine, { outside_jurisdiction: 1, invalid_zip: 1, outside_registry: 1, invalid_geometry: 1 });
  assert.throws(() => partitionSourceRecords(adapter, [records[0], records[0]]), /Duplicate upstream ID/);
  assert.throws(() => adaptersForJurisdiction("us-wa-bellevue"), /No connected permit/);
});

test("citywide adapter pages each feed without a per-ZIP predicate and rejects truncation", async () => {
  const offsets = [];
  const result = await fetchAllSourceRecords(SOURCES[0], null, { pageSize: 2, fetcher: async (url) => {
    const query = new URL(url).searchParams;
    assert.doesNotMatch(query.get("$where"), /originalzip/);
    offsets.push(Number(query.get("$offset")));
    return { ok: true, json: async () => offsets.length === 1 ? [{ permitnum: "A" }, { permitnum: "B" }] : [] };
  } });
  assert.deepEqual(offsets, [0, 2]); assert.equal(result.complete, true);
  const truncated = await fetchAllSourceRecords(SOURCES[0], null, { pageSize: 1, maxPages: 1, fetcher: async () => ({ ok: true, json: async () => [{}] }) });
  assert.equal(truncated.complete, false);
});

test("source changes during pagination are rejected and source workers never exceed two", async () => {
  let calls = 0;
  await assert.rejects(fetchAllSourceRecords(SOURCES[0], null, { verifyCount: true, fetcher: async (url) => {
    if (new URL(url).searchParams.get("$select") === "count(*) as count") return { ok: true, json: async () => [{ count: String(++calls) }] };
    return { ok: true, json: async () => [{ permitnum: "A" }] };
  } }), /Source changed/);
  let active = 0, highest = 0, finished = 0;
  const result = await settleSources([1, 2, 3, 4], async (value) => {
    active++; highest = Math.max(highest, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--; finished++;
    if (value === 2) throw new Error("one source failed");
    return value;
  });
  assert.equal(highest, 2); assert.equal(finished, 4);
  assert.equal(result[1].status, "rejected"); assert.equal(result[3].value, 4);
});

test("cross-jurisdiction address and permit references never merge unrelated projects", () => {
  const base = { sourceId: "one", externalId: "A", references: [], normalizedAddress: "100 MAIN ST", description: "New apartment building", category: "multifamily", stage: "in_review", eventAt: "2026-10-01", postalCode: "02108" };
  const projects = buildProjects([{ ...base, jurisdictionId: "city-one" }, { ...base, sourceId: "two", externalId: "B", jurisdictionId: "city-two", references: ["A"] }], { now: new Date("2026-10-24") });
  assert.equal(projects.length, 2);
  const normalized = normalizeSourceRow(SOURCES[0], { permitnum: "A", originalzip: "98103", description: "Construct new apartment building", statuscurrent: "Issued", applieddate: "2026-10-01", latitude: "", longitude: null }, "98103");
  assert.equal(normalized.latitude, null); assert.equal(normalized.longitude, null);
});

test("cursors bind ZIP, generation, visibility and location without containing coordinates", () => {
  const context = orderingContext("98103", { latitude: 47.67, longitude: -122.34 });
  const value = { v: 1, zip: "98103", generation: "first", context, id: "project_a", score: 100, activity: -1e15 };
  const encoded = encodeCursor(value);
  assert.doesNotMatch(Buffer.from(encoded, "base64url").toString(), /47\.67|-122\.34/);
  assert.deepEqual(decodeCursor(encoded, value), value);
  assert.throws(() => decodeCursor(encoded, { ...value, generation: "second" }), (error) => error.status === 409 && error.code === "REPORT_UPDATED");
  assert.throws(() => decodeCursor(encoded, { ...value, context: orderingContext("98103", null) }), /Invalid project cursor/);
  for (const params of ["lat=&lng=", "lat=47", "lat=91&lng=0", "lat=0&lng=181"]) assert.throws(() => locationFrom(new URLSearchParams(params)), /coordinates/);
  assert.deepEqual(locationFrom(new URLSearchParams("lat=0&lng=0")), { latitude: 0, longitude: 0 });
});

test("new ZIPs without published reports are preparing and never trigger live source crawling", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("No upstream lookup before publication"));
  const response = await summary(new Request("https://app.example/api/area-summary?zip=98109"));
  assert.equal(response.status, 202);
  assert.equal((await response.json()).code, "REPORT_PREPARING");
  const status = await coverage(new Request("https://app.example/api/service-areas?zip=98109"));
  assert.equal((await status.json()).areas[0].status, "pending");
});

test("national baseline preserves suppressed values and uncertainty, and requires a key", async () => {
  const fields = Object.values(BASELINE_METRICS).flatMap(([id]) => [`${id}E`, `${id}M`]);
  const headers = ["NAME", ...fields, "zip code tabulation area"];
  const row = ["ZCTA5 02108", ...fields.map((_, i) => i === 0 ? "-666666666" : "5"), "02108"];
  const result = normalizeBaseline([headers, row]);
  assert.equal(result[0].zip, "02108"); assert.equal(result[0].metrics.population.estimate, null);
  assert.equal(result[0].metrics.population.marginOfError, 5);
  assert.throws(() => normalizeBaseline([headers, row, row]), /duplicate/);
  await assert.rejects(fetchBaseline({ apiKey: "", fetcher: () => assert.fail("No key") }), /CENSUS_API_KEY/);
});
