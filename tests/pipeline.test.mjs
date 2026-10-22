import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjects,
  normalizeSourceRow,
  usableDate,
} from "../lib/project-pipeline.mjs";
import { areaSummary, haversineMiles } from "../lib/ranking.mjs";
import { SOURCES } from "../lib/report.mjs";

const now = new Date("2026-10-18T00:00:00.000Z");
const base = {
  permitnum: "7000001-CN",
  originalzip: "98103",
  originaladdress1: "100 Example Ave N",
  description: "Construct new 40 unit apartment building",
  statuscurrent: "Reviews In Process",
  applieddate: "2026-08-01",
  housingunitsadded: "40",
  latitude: "47.67",
  longitude: "-122.34",
};

test("invalid sentinel dates do not make old records look current", () => {
  assert.equal(usableDate("1900-01-01", now), null);
  assert.equal(usableDate("not a date", now), null);
  assert.equal(usableDate("2026-09-01", now), "2026-09-01T00:00:00.000Z");
});

test("explicit references combine permits into one canonical project", () => {
  const records = [
    normalizeSourceRow(SOURCES[0], base, "98103", now),
    normalizeSourceRow(
      SOURCES[1],
      {
        ...base,
        permitnum: "3000001-LU",
        description: "Land use review for apartment project 7000001-CN",
      },
      "98103",
      now,
    ),
  ];
  const projects = buildProjects(records, { now });
  assert.equal(projects.length, 1);
  assert.equal(projects[0].records.length, 2);
  assert.equal(projects[0].visible, true);
  assert.equal(projects[0].scaleBand, "notable");
});

test("stale and undated records are retained but hidden from the primary view", () => {
  const projects = buildProjects(
    [
      normalizeSourceRow(
        SOURCES[0],
        { ...base, permitnum: "OLD-CN", applieddate: "2015-01-01" },
        "98103",
        now,
      ),
      normalizeSourceRow(
        SOURCES[0],
        {
          ...base,
          permitnum: "UNKNOWN-CN",
          originaladdress1: "200 Different Ave N",
          applieddate: null,
        },
        "98103",
        now,
      ),
    ],
    { now },
  );
  assert.equal(projects.length, 2);
  assert.ok(projects.every((project) => project.visible === false));
});

test("summary returns at most fifteen highlights and proximity changes ranking", () => {
  const projects = Array.from({ length: 18 }, (_, index) => ({
    id: String(index),
    displayAddress: `${index} Example Ave`,
    latitude: 47.6 + index * 0.01,
    longitude: -122.3,
    visible: true,
    stage: "in_review",
    basePriority: 50,
    scaleBand: "local",
    evidenceConfidence: 1,
    summary: "Documented project",
    records: [{}],
  }));
  const result = areaSummary(projects, {
    zip: "98103",
    location: { latitude: 47.6, longitude: -122.3 },
  });
  assert.equal(result.highlights.length, 15);
  assert.equal(result.highlights[0].id, "0");
  assert.equal(result.highlights[0].latitude, 47.6);
  assert.equal(result.highlights[0].longitude, -122.3);
  assert.equal(result.moreCount, 3);
  assert.equal(
    haversineMiles(
      { latitude: 47.6, longitude: -122.3 },
      { latitude: 47.6, longitude: -122.3 },
    ),
    0,
  );
});

test("impact assessment includes evidence beyond the highlight cap without summing housing units", () => {
  const projects = Array.from({ length: 16 }, (_, index) => ({
    id: String(index),
    displayAddress: `${index} Example Ave`,
    visible: true,
    stage: "in_review",
    basePriority: 100 - index,
    unitsAdded: index === 15 ? 200 : 2,
    summary: index === 15 ? "Proposed 8-story apartment building" : "New dwelling",
    sourceUrl: `https://data.seattle.gov/example/${index}`,
  }));
  const result = areaSummary(projects, { zip: "98103" });
  assert.equal(result.highlights.some((project) => project.id === "15"), false);
  assert.match(result.impactSummary.overview, /More homes could mean a denser/);
  assert.equal(result.impactSummary.changesSummary, "Housing plans include up to 200 homes in one project; some plans mention buildings up to 8 stories.");
  assert.doesNotMatch(result.impactSummary.changesSummary, /230/);
  const housing = result.impactSummary.items.find((item) => item.id === "housing");
  assert.equal(housing.evidence[0].projectId, "15");
  assert.equal(housing.evidence[0].stage, "In review");
  assert.match(housing.text, /not a net housing gain/);
  assert.equal(housing.score, 4);
  assert.match(housing.takeaway, /potentially higher density/);
  const views = result.impactSummary.items.find((item) => item.id === "views");
  assert.match(views.text, /up to 8 stories/);
  assert.match(views.text, /require site plans/);
  assert.equal(views.evidence[0].sourceUrl, projects[15].sourceUrl);
});

test("hidden, demolition-only and uncertain projects do not drive positive impact claims", () => {
  const baseProject = {
    visible: true,
    stage: "permitted",
    basePriority: 50,
    unitsAdded: 500,
    stories: 12,
    summary: "Construct apartment building",
  };
  const result = areaSummary([
    { ...baseProject, id: "hidden", visible: false },
    { ...baseProject, id: "demolition", category: "demolition" },
    { ...baseProject, id: "legacy-demolition", summary: "Demolish existing apartment building" },
    { ...baseProject, id: "uncertain", stage: "uncertain" },
  ], { zip: "98103" });
  assert.doesNotMatch(result.impactSummary.overview, /500/);
  assert.doesNotMatch(result.impactSummary.changesSummary, /500|12 stories/);
  for (const item of result.impactSummary.items) {
    assert.equal(item.evidence.length, 0);
    assert.equal(item.score, null);
    assert.notEqual(item.assessment, "Possible impact");
  }
});

test("missing coverage stays unknown even with housing, rail and rezone keywords in permit descriptions", () => {
  const result = areaSummary([{
    id: "proposal",
    visible: true,
    stage: "early_proposal",
    basePriority: 50,
    unitsAdded: 40,
    stories: 6,
    summary: "Proposed housing near rail station in rezone area with retail",
  }], { zip: "98103" });
  for (const id of ["transport", "zoning", "prices"]) {
    const item = result.impactSummary.items.find((entry) => entry.id === id);
    assert.equal(item.evidence.length, 0);
    assert.notEqual(item.assessment, "Possible impact");
  }
  assert.match(result.impactSummary.items.find((item) => item.id === "prices").text, /do not establish/);
  assert.match(result.impactSummary.items.find((item) => item.id === "housing").text, /built and occupied/);
});

test("empty evidence does not imply no neighborhood change or a positive economic outlook", () => {
  const { impactSummary } = areaSummary([], { zip: "98103" });
  assert.match(impactSummary.overview, /Missing data does not mean no change/);
  assert.match(impactSummary.changesSummary, /No recent building plans.*available city records/);
  assert.equal(impactSummary.items.length, 6);
  assert.ok(impactSummary.items.every((item) => item.evidence.length === 0));
  assert.ok(impactSummary.items.every((item) => item.assessment !== "Possible impact"));
  assert.ok(impactSummary.items.every((item) => item.score === null));
});

test("a height-only change summary does not invent housing additions", () => {
  const { impactSummary } = areaSummary([{
    id: "building", visible: true, stage: "in_review", basePriority: 20,
    summary: "Proposed 5-story building", unitsAdded: null,
  }], { zip: "98103" });
  assert.equal(impactSummary.changesSummary, "City records describe buildings of up to 5 stories.");
  assert.doesNotMatch(impactSummary.changesSummary, /homes/);
  assert.equal(impactSummary.items.find((item) => item.id === "housing").score, null);
});

test("record scores distinguish source support from indirect economic implications and missing coverage", () => {
  const project = {
    id: "one", visible: true, stage: "permitted", basePriority: 50,
    unitsAdded: 40, stories: 6, summary: "Proposed apartment building",
    sourceUrl: "https://data.seattle.gov/example/one",
  };
  const { impactSummary } = areaSummary([
    project, { ...project, id: "two", sourceUrl: "https://data.seattle.gov/example/two" },
  ], { zip: "98103" });
  const byId = Object.fromEntries(impactSummary.items.map((item) => [item.id, item]));
  assert.equal(byId.housing.score, 5);
  assert.equal(byId.views.score, 5);
  assert.equal(byId.economy.score, 2);
  for (const id of ["transport", "zoning", "prices"]) assert.equal(byId[id].score, null);
  assert.match(impactSummary.scoreMethod, /not severity, benefit/);

  const limited = areaSummary([
    { ...project, stage: "early_proposal", sourceUrl: null },
  ], { zip: "98103" });
  assert.equal(limited.impactSummary.items.find((item) => item.id === "housing").score, 2);
});
