import test from "node:test";
import assert from "node:assert/strict";
import { civicProjectType, completionTimeline } from "../lib/project-details.mjs";
import { getPublicProjects } from "../lib/public-projects.mjs";
import { areaSummary } from "../lib/ranking.mjs";
import { normalizeSourceRow } from "../lib/project-pipeline.mjs";
import { SOURCES } from "../lib/report.mjs";
import { getTransitOverlay, transitFeatures } from "../lib/transit.mjs";
import { fetchSoundscore, soundscoreLocation } from "../lib/soundscore.mjs";
import { GET as transitGet } from "../app/api/transit/route.js";
import { GET as soundscoreGet } from "../app/api/soundscore/route.js";

const now = new Date("2026-10-21T20:00:00Z");

test("completion labels require explicit project completion, never permit or expiry dates", () => {
  for (const summary of ["Permit issued 2026, expires 2028", "Plan review completed in 2026", "Construction starts in March 2027", "Completion not announced", "No expected completion in 2027", "Expected completion 2027-2028"])
    assert.equal(completionTimeline({ summary, lastActivityAt: "2026-10-01" }, { now }), null, summary);
  const timeline = completionTimeline({ summary: "Expected completion: Q3 2027", sourceUrl: "https://city.example/project" }, { now });
  assert.equal(timeline.label, "Q3 2027");
  assert.equal(timeline.pastTarget, false);
  assert.equal(timeline.sourceUrl, "https://city.example/project");
  assert.equal(completionTimeline({ summary: "Construction is expected to be completed in 2025" }, { now }).pastTarget, true);
  assert.equal(completionTimeline({ summary: "Expected completion: January 2026" }, { now }).pastTarget, true);
  assert.equal(completionTimeline({ summary: "Expected completion: Q4 2026" }, { now }).pastTarget, false);
});

test("civic work survives permit filtering, while apartment parking is not a public project", () => {
  for (const summary of ["Construct apartment building with parking", "Park View Apartments: replace windows", "Renovate private apartment recreation room", "New community of 40 homes"])
    assert.equal(civicProjectType(summary), null);
  const row = { permitnum: "PARK-LU", originalzip: "98103", originaladdress1: "5100 Green Lake Way N", description: "Replace playground equipment and renovate a public park", statuscurrent: "Reviews In Process", applieddate: "2026-08-01" };
  const record = normalizeSourceRow(SOURCES[1], row, "98103", now);
  assert.ok(record);
  assert.equal(record.category, "public_facility");
  assert.equal(normalizeSourceRow(SOURCES[1], { ...row, statuscurrent: "Completed" }, "98103", now), null);
  const projects = Array.from({ length: 16 }, (_, index) => ({ id: String(index), visible: true, basePriority: 100-index, stage: "in_review", summary: index === 15 ? row.description : "New apartment building" }));
  const summary = areaSummary(projects, { zip: "98103" });
  assert.equal(summary.highlights.length, 15);
  assert.equal(summary.civicProjects[0].id, "15");
});

test("reviewed public projects preserve phase targets and flag past unconfirmed dates", () => {
  const projects = getPublicProjects("98103", { now });
  const field = projects.find((project) => project.id === "spr-lower-woodland-field-1");
  assert.equal(field.timeline.pastTarget, true);
  assert.equal(field.timeline.label, "September 2026");
  assert.equal(projects.find((project) => project.id === "spr-lower-woodland-landscape").timeline, null);
  assert.equal(projects.find((project) => project.id === "spu-ship-canal").timeline.kind, "program_target");
  const phase = getPublicProjects("98104", { now })[0];
  assert.equal(phase.timeline.kind, "phase_target");
  assert.match(phase.timeline.phase, /final opening not announced/);
  assert.deepEqual(getPublicProjects("98103", { now: "2027-01-19" }), []);
  assert.deepEqual(getPublicProjects("98103", { now: "2026-10-20" }), []);
  assert.deepEqual(getPublicProjects("98103", { now: "invalid" }), []);
  projects[0].timeline.label = "Wrong";
  assert.equal(getPublicProjects("98103", { now })[0].timeline.label, "September 2026");
});

const feature = (route, paths, extra = {}) => ({ attributes: { ROUTE_NUM: route, IN_SERVICE_FLAG: "Y", CURRENT_NEXT_CODE: "IN SERVICE", ...extra }, geometry: { paths } });
test("transit geometry clips crossing routes and omits future, inactive and invalid features", () => {
  const result = transitFeatures({ features: [feature(40, [[[-2, 0], [2, 0]]]), feature(41, [[[0, 0], [0, 2]]], { IN_SERVICE_FLAG: "N" }), feature(42, [[[0, 0], [1, 1]]], { CURRENT_NEXT_CODE: "NEXT" }), feature(43, [[[NaN, 0], [0, 0]]]), feature(44, [[[2, 2], [3, 3]]])] }, [-1, -1, 1, 1]);
  assert.equal(result.features.length, 1);
  assert.deepEqual(result.features[0].geometry.coordinates, [[[-1, 0], [1, 0]]]);
  assert.throws(() => transitFeatures({ features: [], exceededTransferLimit: true }, [-1,-1,1,1]));
  assert.throws(() => transitFeatures({ error: { code: 500 } }, [-1,-1,1,1]));
});

test("transit endpoint rejects unsupported ZIPs; failed queries recover and successful requests coalesce", async () => {
  assert.equal((await transitGet(new Request("https://app.example/api/transit?zip=98103%27%20OR%201=1"))).status, 400);
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    const query = new URL(url).searchParams;
    assert.equal(query.get("outSR"), "4326");
    assert.match(query.get("where"), /IN_SERVICE_FLAG='Y'/);
    if (calls === 1) return { ok: false };
    return { ok: true, json: async () => ({ features: [feature(40, [[[-122.4,47.67],[-122.3,47.67]]])] }) };
  };
  await assert.rejects(getTransitOverlay("98103", { fetcher, now: 1000 }));
  const [one, two] = await Promise.all([getTransitOverlay("98103", { fetcher, now: 1000 }), getTransitOverlay("98103", { fetcher, now: 1000 })]);
  assert.equal(calls, 2);
  assert.deepEqual(one, two);
  assert.equal(one.geojson.features.length, 1);
  await getTransitOverlay("98103", { fetcher, now: 1001 });
  assert.equal(calls, 2);
  await getTransitOverlay("98103", { fetcher, now: 1000 + 6*60*60*1000 });
  assert.equal(calls, 3);
});

test("Soundscore requires a specific Seattle location and a key, with no provider calls otherwise", async () => {
  for (const query of ["", "lat=&lng=", "lat=0&lng=0", "lat=NaN&lng=-122.34", "lat=47.66", "lat=48&lng=-122.34"])
    assert.equal(soundscoreLocation(new URLSearchParams(query)), null);
  const location = soundscoreLocation(new URLSearchParams("lat=47.66&lng=-122.34"));
  assert.deepEqual(location, { latitude: 47.66, longitude: -122.34 });
  assert.equal((await soundscoreGet(new Request("https://app.example/api/soundscore?zip=98103"))).status, 400);
  const result = await fetchSoundscore(location, { apiKey: "", fetcher: () => assert.fail("No key must not call provider") });
  assert.equal(result.status, "not_configured");
});

test("Soundscore uses server-only key and no cache, validates results and handles provider limits", async () => {
  const location = { latitude: 47.66, longitude: -122.34 };
  let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers["x-api-key"], "test-key");
    assert.doesNotMatch(url, /test-key/);
    return { ok: true, json: async () => ({ status: "OK", result: { score: 82, scoretext: "Calm", traffictext: "Active" } }) };
  };
  for (let i = 0; i < 2; i++) {
    const result = await fetchSoundscore(location, { apiKey: "test-key", fetcher });
    assert.equal(result.score, 82);
    assert.equal(result.traffic, "Active");
    assert.equal(JSON.stringify(result).includes("test-key"), false);
  }
  assert.equal(calls, 2);
  const bad = await fetchSoundscore(location, { apiKey: "test-key", fetcher: async () => ({ ok: true, json: async () => ({ status: "OK", result: { score: 150 } }) }) });
  assert.equal(bad.status, "unavailable");
  assert.equal((await fetchSoundscore(location, { apiKey: "test-key", fetcher: async () => ({ ok: false, status: 429 }) })).status, "limit_reached");
});
