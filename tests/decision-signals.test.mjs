import test from "node:test";
import assert from "node:assert/strict";
import { areaSummary } from "../lib/ranking.mjs";
import { commercialWork, hasSiteWork, parkingPlan } from "../lib/project-details.mjs";
import { SOURCES, relevant } from "../lib/report.mjs";
import { normalizeSourceRow } from "../lib/project-pipeline.mjs";

function project(summary, extra = {}) {
  return { id: summary, summary, displayAddress: "100 Example St", visible: true, stage: "in_review", basePriority: 50, sourceUrl: "https://data.seattle.gov/example", ...extra };
}
const signals = (projects) => Object.fromEntries(areaSummary(projects, { zip: "98103" }).decisionSignals.map((signal) => [signal.id, signal]));

test("signals use all current projects before highlight cap and never add housing or parking totals", () => {
  const projects = Array.from({ length: 17 }, (_, index) => project(`Construct a ${index === 16 ? 8 : 4}-story apartment building. Parking for ${index === 16 ? 140 : 10} vehicles proposed.`, { id: String(index), basePriority: 100-index, unitsAdded: index === 16 ? 230 : 2 }));
  const summary = areaSummary(projects, { zip: "98103" });
  const result = Object.fromEntries(summary.decisionSignals.map((signal) => [signal.id, signal]));
  assert.equal(summary.highlights.some((item) => item.id === "16"), false);
  assert.equal(result.housing.count, 17);
  assert.equal(result.housing.metric, "230 homes");
  assert.match(result.housing.fact, /Largest individual plan/);
  assert.equal(result.views.metric, "Up to 8 stories");
  assert.equal(result.parking.metric, "Up to 140 spaces");
  assert.equal(result.housing.examples[0].projectId, "16");
  assert.equal(result.parking.examples[0].projectId, "16");
  assert.doesNotMatch(result.housing.metric, /262/);
  assert.doesNotMatch(result.parking.metric, /300/);
});

test("housing and business implications exclude hidden, uncertain and demolition-only supply", () => {
  const result = signals([
    project("Construct new apartment with retail", { visible: false, unitsAdded: 500 }),
    project("Construct new 20-story apartment with retail", { stage: "uncertain", unitsAdded: 600 }),
    project("Demolish existing 9-story retail building", { category: "demolition", unitsAdded: 700 }),
  ]);
  assert.equal(result.housing, undefined);
  assert.equal(result.shops, undefined);
  assert.equal(result.commercial, undefined);
  assert.equal(result.views, undefined);
  assert.equal(result.disruption.count, 1);
  assert.match(result.disruption.takeaways.home, /If work proceeds/);
});

test("commercial matching reads the destination use and preserves fit-outs without promising openings", () => {
  assert.deepEqual(commercialWork("Change use from retail to apartments").uses, []);
  assert.deepEqual(commercialWork("Convert existing office to apartments").uses, []);
  assert.equal(commercialWork("Demolish existing retail store").hasWork, false);
  assert.equal(commercialWork("Construct apartments. Existing office building to remain.").hasWork, false);
  assert.equal(commercialWork("Construct apartments without retail").hasWork, false);
  const converted = commercialWork("Change use from office to restaurant and construct tenant improvements");
  assert.deepEqual(converted.uses, ["Food & drink"]);
  assert.equal(converted.conversion, true);
  assert.equal(converted.fitOut, true);
  const existing = commercialWork("Construct tenant improvements for existing restaurant, no change of use");
  assert.equal(existing.hasWork, true);
  assert.equal(existing.conversion, false);
  assert.equal(existing.fitOut, true);
  const result = signals([project("Change use from office to restaurant and construct tenant improvements")]);
  assert.match(result.commercial.fact, /1 use change/);
  assert.match(result.shops.takeaways.home, /openings are unconfirmed/);
  assert.match(result.commercial.takeaways.business, /do not establish vacant or leasable space/);
});

test("parking distinguishes explicit no-parking proposals, removal, bicycles and retained spaces", () => {
  assert.equal(parkingPlan("Parking for 140 vehicles proposed").spaces, 140);
  assert.equal(parkingPlan("12 parking stalls proposed").spaces, 12);
  assert.equal(parkingPlan("No parking proposed").explicitNone, true);
  assert.equal(parkingPlan("Remove existing parking garage").removed, true);
  assert.equal(parkingPlan("Parking for 20 bicycles proposed"), null);
  assert.equal(parkingPlan("No change to existing parking"), null);
  assert.equal(parkingPlan("No new parking proposed"), null);
  const result = signals([project("Construct apartments. No parking proposed."), project("Construct new apartment building. Parking for 40 vehicles proposed.")]);
  assert.equal(result.parking.count, 2);
  assert.equal(result.parking.metric, "Up to 40 spaces");
  assert.match(result.parking.fact, /1 plan proposes no parking/);
});

test("site work includes proposed demolition but omits explicitly finished phases and negations", () => {
  assert.equal(hasSiteWork("Existing buildings to be demolished"), true);
  assert.equal(hasSiteWork("Existing buildings were demolished"), false);
  assert.equal(hasSiteWork("No demolition proposed. Construct apartments."), false);
  assert.equal(hasSiteWork("New shoring and excavation"), true);
});

test("explicit business changes and building upgrades survive filtering; routine maintenance remains excluded", () => {
  for (const description of ["Construct tenant improvements for a retail shop", "Change use from office to restaurant", "Seismic retrofit of existing building", "Install new accessible ramp", "Upgrade fire sprinkler system"]) {
    assert.equal(relevant({ description }), true, description);
    const record = normalizeSourceRow(SOURCES[0], { permitnum: description, description, originalzip: "98103", statuscurrent: "Issued", applieddate: "2026-10-01" }, "98103", new Date("2026-10-21"));
    assert.ok(record, description);
    assert.equal(normalizeSourceRow(SOURCES[0], { permitnum: description, description, originalzip: "98103", statuscurrent: "Canceled" }, "98103"), null);
  }
  for (const description of ["Construct alterations to kitchen and bathroom", "Commercial sign installation", "Replace windows in office building", "Re-roof existing retail shop"])
    assert.equal(relevant({ description }), false, description);
  const result = signals([project("Seismic retrofit of building. Install new accessible ramp. Upgrade fire sprinkler system.")]);
  assert.match(result.upgrades.fact, /Seismic retrofit/);
  assert.match(result.upgrades.fact, /Accessibility/);
  assert.match(result.upgrades.fact, /Fire systems/);
});

test("unsupported topics remain absent and audience messages stay distinct", () => {
  assert.deepEqual(areaSummary([], { zip: "98103" }).decisionSignals, []);
  const result = signals([project("Construct new office building")]);
  assert.deepEqual(result.commercial.audience, ["business"]);
  assert.equal(result.parking, undefined);
  assert.equal(result.shops, undefined);
  assert.notEqual(result.commercial.takeaways.home, result.commercial.takeaways.business);
  assert.equal(result.prices, undefined);
});
