import test from "node:test";
import assert from "node:assert/strict";
import { getZipProfile } from "../lib/zip-profile.mjs";
import { INITIAL_SERVICE_AREAS } from "../lib/project-pipeline.mjs";

const now = new Date("2026-10-21T20:00:00Z");

test("each supported ZIP has named workplaces, transport, shopping and medical care with official links", () => {
  for (const zip of INITIAL_SERVICE_AREAS) {
    const profile = getZipProfile(zip, { now });
    assert.equal(profile.zip, zip);
    assert.deepEqual(profile.groups.map((group) => group.id), ["work", "transport", "shopping", "medical"]);
    for (const group of profile.groups) {
      assert.ok(group.places.length > 0);
      for (const item of group.places) {
        const link = new URL(item.url);
        assert.equal(link.protocol, "https:");
        assert.doesNotMatch(link.hostname, /redfin|zillow|wikipedia/);
        assert.ok(item.name);
        assert.ok(["in_zip", "nearby", "serves_area"].includes(item.relation));
        if (item.relation === "in_zip") assert.equal(item.postalCode, zip);
        if (item.relation === "nearby") assert.notEqual(item.postalCode, zip);
      }
    }
  }
});

test("medical directory keeps current Fremont address and labels outside-ZIP care nearby", () => {
  const medical = getZipProfile("98103", { now }).groups.find((group) => group.id === "medical");
  assert.equal(medical.places[0].address, "459 N 35th St, Suite 203");
  const nearby = getZipProfile("98102", { now }).groups.find((group) => group.id === "medical").places[0];
  assert.equal(nearby.relation, "nearby");
  assert.equal(nearby.postalCode, "98122");
});

test("outside-ZIP institutions are clearly nearby rather than local employers", () => {
  const profile = getZipProfile("98102", { now });
  const hutch = profile.groups[0].places.find((item) => item.name === "Fred Hutch Cancer Center");
  assert.equal(hutch.postalCode, "98109");
  assert.equal(hutch.relation, "nearby");
  const uw = getZipProfile("98105", { now }).groups[0].places.find((item) => item.name.startsWith("University of Washington"));
  assert.equal(uw.postalCode, "98195");
  assert.equal(uw.relation, "nearby");
});

test("unknown ZIPs and expired or future reviews do not become current profiles", () => {
  for (const zip of ["98109", "__proto__", "constructor", "98103 OR 1=1", 98103, null]) {
    assert.equal(getZipProfile(zip, { now }), null);
  }
  assert.equal(getZipProfile("98103", { now: new Date("2027-01-19T00:00:00Z") }), null);
  assert.equal(getZipProfile("98103", { now: new Date("2026-10-20T23:59:59Z") }), null);
  assert.equal(getZipProfile("98103", { now: new Date("invalid") }), null);
  assert.ok(getZipProfile("98103", { now: new Date("2027-01-18T23:59:59Z") }));
});

test("profile responses cannot mutate the shared directory", () => {
  const first = getZipProfile("98103", { now });
  first.groups[0].places[0].name = "Incorrect employer";
  first.groups[1].places.length = 0;
  const next = getZipProfile("98103", { now });
  assert.equal(next.groups[0].places[0].name, "Adobe");
  assert.equal(next.groups[1].places.length, 2);
});
