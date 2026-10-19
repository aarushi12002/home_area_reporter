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
