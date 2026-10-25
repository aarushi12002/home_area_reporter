import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/area-summary/route.js";
import { GET as RUN_INGESTION } from "../app/api/internal/ingest/route.js";

const request = (query) =>
  new Request(`https://report.example/api/area-summary?${query}`);

test("summary endpoint rejects unsupported areas before source lookup", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return { ok: true, json: async () => [] };
  });
  const response = await GET(request("zip=98004"));
  assert.equal(response.status, 400);
  assert.equal(calls, 0);
});

test("scheduled ingestion endpoint is closed without a configured secret", async () => {
  const response = await RUN_INGESTION(
    new Request("https://report.example/api/internal/ingest"),
  );
  assert.equal(response.status, 401);
});

test("summary endpoint returns a maximum of fifteen current highlights", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-21T20:00:00Z") });
  const records = Array.from({ length: 18 }, (_, index) => ({
    permitnum: `70000${index}1-CN`,
    originalzip: "98105",
    originaladdress1: `${index + 1} Example Ave`,
    description: `Construct new ${index + 2} unit apartment building`,
    statuscurrent: index % 2 ? "Issued" : "Reviews In Process",
    applieddate: "2026-09-01",
    housingunitsadded: String(index + 2),
    latitude: String(47.65 + index * 0.001),
    longitude: String(-122.31 - index * 0.001),
  }));
  t.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => records,
  }));
  const response = await GET(request("zip=98105&lat=47.66&lng=-122.31"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.highlights.length, 15);
  assert.equal(body.totalCurrentProjects, 18);
  assert.equal(body.moreCount, 3);
  assert.equal(body.dataSource, "live_fallback");
  assert.match(body.impactSummary.overview, /More homes could mean a denser/);
  assert.match(body.impactSummary.changesSummary, /Housing plans include up to 19 homes in one project/);
  assert.equal(body.impactSummary.items.length, 6);
  assert.ok(body.impactSummary.items.find((item) => item.id === "housing").evidence.length);
  assert.equal(body.impactSummary.items.find((item) => item.id === "prices").assessment, "Direction unknown");
  assert.equal(body.impactSummary.items.find((item) => item.id === "prices").score, null);
  assert.equal(body.impactSummary.items.find((item) => item.id === "housing").score, 5);
  assert.equal(typeof body.highlights[0].latitude, "number");
  assert.equal(typeof body.highlights[0].longitude, "number");
  assert.match(body.fullReportUrl, /zip=98105/);
  assert.equal(body.zipProfile.zip, "98105");
  assert.ok(body.zipProfile.groups[2].places.some((item) => item.name === "University Village"));
});

test("current ZIP highlights survive a permit-source outage", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-21T20:00:00Z") });
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
  const response = await GET(request("zip=98101"));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.status, "unavailable");
  assert.equal(body.zipProfile.zip, "98101");
  assert.equal(body.zipProfile.groups[1].places[0].name, "Westlake Station · Link light rail");
  assert.equal(body.publicProjects[0].id, "spr-freeway-park");
});
