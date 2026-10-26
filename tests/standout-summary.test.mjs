import test from "node:test";
import assert from "node:assert/strict";
import { areaSummary, composeImpactSummary } from "../lib/ranking.mjs";
import { getPublicProjects } from "../lib/public-projects.mjs";

const now = new Date("2026-10-25T20:00:00Z");
const project = (id, summary, extra = {}) => ({
  id, summary, displayAddress: `${id} EXAMPLE AVE`, visible: true,
  stage: "in_review", basePriority: 50, sourceUrl: `https://city.example/${id}`, ...extra,
});
const impact = (projects) => areaSummary(projects, { zip: "98103" }).impactSummary;
const words = (text) => text.trim().split(/\s+/).length;
const publicProject = (extra = {}) => ({
  id: "park", title: "Example Park play area", stage: "Planning", summary: "Relocate the play area.",
  snapshotWork: "play area relocation", snapshotImpact: "The planned play area could provide new recreation space.",
  sourceUrl: "https://city.example/park", reviewedAt: "2026-10-01", reviewUntil: "2027-01-01", ...extra,
});

test("standouts name ranked housing and a different project category, not the largest apartment by default", () => {
  const result = impact([
    project("100", "Construct new apartment building", { unitsAdded: 40, basePriority: 100, stage: "permitted" }),
    project("200", "Construct new apartment building", { unitsAdded: 400, basePriority: 90 }),
    project("300", "Change use from office to restaurant", { basePriority: 80 }),
  ]);
  assert.match(result.changesSummary, /100 EXAMPLE AVE.*40|40.*100 EXAMPLE AVE/);
  assert.match(result.changesSummary, /300 EXAMPLE AVE/);
  assert.match(result.changesSummary, /Permitted/);
  assert.doesNotMatch(result.changesSummary, /400|200 EXAMPLE/);
  assert.match(result.overview, /Housing plans could add choices/i);
  assert.doesNotMatch(result.overview, /denser|busier|prices|blocked views/);
  assert.equal(result.standouts.length, 2);
  assert.equal(result.standouts[0].sourceUrl, "https://city.example/100");
});

test("candidate diversity considers all projects before the 15 highlight cap and ignores location ranking", () => {
  const projects = Array.from({ length: 16 }, (_, i) => project(String(i), "Construct new apartment building", { unitsAdded: 10, basePriority: 100-i, latitude: 47.6, longitude: -122.3 }));
  projects.push(project("clinic", "Construct tenant improvements for existing medical clinic", { basePriority: 10, latitude: 47.7, longitude: -122.4 }));
  const result = areaSummary(projects, { zip: "98103", location: { latitude: 47.7, longitude: -122.4 } });
  assert.equal(result.highlights.some((p) => p.id === "clinic"), false);
  assert.match(result.impactSummary.changesSummary, /clinic EXAMPLE AVE/);
  assert.equal(result.impactSummary.standouts[0].projectId, "0");
  assert.equal(result.impactSummary.standoutCandidates.filter((p) => p.category === "housing").length, 1);
});

test("commercial summaries distinguish existing fit-outs, use changes and new buildings", () => {
  const existing = impact([project("10", "Construct tenant improvements for existing restaurant, no change of use")]);
  assert.match(existing.changesSummary, /existing restaurant/);
  assert.doesNotMatch(existing.changesSummary, /new restaurant|new shop|opening/);
  const converted = impact([project("20", "Change use from office to restaurant and construct tenant improvements")]);
  assert.match(converted.changesSummary, /change to restaurant use/);
  assert.doesNotMatch(converted.changesSummary, /office use/);
  const fitOut = impact([project("21", "Construct tenant improvements for medical clinic in existing commercial building")]);
  assert.match(fitOut.changesSummary, /medical clinic fit-out/);
  assert.doesNotMatch(fitOut.changesSummary, /existing medical clinic/);
  const hotel = impact([project("30", "Allow a 15-story hotel with 1 apartment unit and restaurant", { unitsAdded: 1 })]);
  assert.match(hotel.changesSummary, /hotel/);
  assert.doesNotMatch(hotel.changesSummary, /1-home/);
});

test("hidden and closed projects cannot drive claims; demolition is disruption rather than new supply", () => {
  const result = impact([
    project("hidden", "Construct retail and apartments", { visible: false, unitsAdded: 900 }),
    project("closed", "Construct retail and apartments", { stage: "completed", unitsAdded: 900 }),
    project("cancelled", "Construct retail and apartments", { originalStatus: "Cancelled", unitsAdded: 900 }),
    project("demo", "Demolish existing retail and apartment building", { category: "demolition", unitsAdded: 900 }),
  ]);
  assert.equal(result.standouts.length, 1);
  assert.match(result.changesSummary, /demolition/);
  assert.match(result.overview, /noise|dust|truck/);
  assert.doesNotMatch(result.changesSummary, /900|new shop|homes/);
});

test("a current reviewed public improvement pairs with the highest permit and targets stay conditional", () => {
  const base = impact([project("10", "Construct new apartment building", { unitsAdded: 30 })]);
  const result = composeImpactSummary(base, [publicProject({ timeline: { label: "2027", kind: "construction_window", targetEnd: "2027-12-31" } })], { now });
  assert.equal(result.standouts.length, 2);
  assert.match(result.changesSummary, /Example Park play area/);
  assert.match(result.changesSummary, /relocation/);
  assert.match(result.changesSummary, /Planning/);
  assert.match(result.changesSummary, /target.*2027/i);
  assert.match(result.overview, /recreation/);
  assert.equal(result.items, base.items);
});

test("expired, future-reviewed and past-target public references never lead the snapshot", () => {
  const base = impact([]);
  for (const excluded of [
    publicProject({ reviewUntil: "2026-10-01" }),
    publicProject({ reviewedAt: "2026-11-01" }),
    publicProject({ timeline: { label: "September 2026", targetEnd: "2026-09-30" } }),
    publicProject({ timeline: { label: "2027", targetEnd: "2027-12-31", pastTarget: true } }),
    publicProject({ stage: "Completed" }),
  ]) assert.equal(composeImpactSummary(base, [excluded], { now }).standouts.length, 0);
  const actual = composeImpactSummary(base, getPublicProjects("98103", { now }), { now });
  assert.equal(actual.standouts.length, 1);
  assert.equal(actual.standouts[0].referenceId, "spu-ship-canal");
  assert.doesNotMatch(actual.changesSummary, /Lower Woodland Playfield #1/);
});

test("same project cannot occupy both slots and one supported project needs no filler", () => {
  const base = impact([project("10", "Construct alterations to Example Park play area", { sourceUrl: "https://city.example/park" })]);
  const result = composeImpactSummary(base, [publicProject()], { now });
  assert.equal(result.standouts.length, 1);
  assert.match(result.changesSummary, /Example Park/);
  const single = impact([project("20", "Construct seismic retrofit to existing residence")]);
  assert.equal(single.standouts.length, 1);
  assert.match(single.changesSummary, /seismic retrofit/);
  const empty = impact([]);
  assert.equal(empty.standouts.length, 0);
  assert.match(empty.overview, /Missing data does not mean no change/);
});

test("word budgets, legacy summaries and ZIP-specific facts survive composition", () => {
  const legacy = { changesSummary: "Existing stored summary", overview: "Existing takeaway", items: [] };
  assert.equal(composeImpactSummary(legacy, [publicProject()], { now }), legacy);
  for (const zip of ["98101", "98103", "98104", "98116", "98125", "98133", "98199"]) {
    const result = composeImpactSummary(impact([project("1234", "Construct new apartment building", { unitsAdded: 109, displayAddress: "1234 VERY LONG EXAMPLE STREET NORTHWEST" })]), getPublicProjects(zip, { now }), { now });
    assert.ok(words(result.changesSummary) <= 45, result.changesSummary);
    assert.ok(words(result.overview) <= 35, result.overview);
    assert.ok(result.standouts.length <= 2);
  }
});

test("completion targets expire from stored candidates without requiring permit fetching", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: now.getTime() });
  const base = impact([
    project("old", "Construct new apartment building. Expected completion: September 2026", { unitsAdded: 100, basePriority: 100 }),
    project("future", "Construct new apartment building. Expected completion: December 2026", { unitsAdded: 50 }),
  ]);
  assert.equal(base.standoutCandidates.length, 1);
  assert.match(base.changesSummary, /completion target: December 2026/);
  assert.equal(composeImpactSummary(base, [], { now: new Date("2027-01-01") }).standouts.length, 0);
});
