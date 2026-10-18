import test from "node:test";
import assert from "node:assert/strict";
import {
  classify,
  normalize,
  buildReport,
  validZip,
  SOURCES,
  fetchSource,
} from "../lib/report.mjs";
const row = {
  permitnum: "100-LU",
  statuscurrent: "Reviews In Process",
  description: "New construction, eight story apartment building",
  originalzip: "98109",
  originaladdress1: "1 Example St",
};
test("rejects malformed ZIPs and query injection", () => {
  assert.equal(validZip("98109' OR 1=1"), false);
  assert.equal(validZip("98109"), true);
  assert.equal(validZip("10001"), false);
});
test("does not call cancelled, completed, administrative or missing-status records upcoming", () => {
  for (const status of [
    "Canceled",
    "Completed",
    "Expired",
    "Withdrawn",
    "Closed",
    "Denied",
    "Finaled",
    "",
  ])
    assert.equal(classify({ ...row, statuscurrent: status }), null);
  assert.equal(
    classify({
      ...row,
      description: "Administrative Permit only - no work authorized.",
    }),
    null,
  );
  assert.equal(classify({ ...row, completeddate: "2020-01-01" }), null);
});
test("issued does not imply construction started", () =>
  assert.equal(
    classify({ ...row, statuscurrent: "Issued" }).stage,
    "Permit / decision recorded",
  ));
test("groups explicitly related permits and never sums units", () => {
  const a = { ...row, housingunitsadded: "20" };
  const b = {
    ...row,
    permitnum: "200-CN",
    relatedmup: "100-LU",
    housingunitsadded: "20",
  };
  const x = normalize(
    [
      { source: SOURCES[0], records: [b] },
      { source: SOURCES[1], records: [a] },
    ],
    "98109",
  );
  assert.equal(x.projects.length, 1);
  assert.equal(x.projects[0].records.length, 2);
  assert.equal(x.projects[0].primary.id, "100-LU");
  assert.equal(x.projects[0].primary.added, "20");
});
test("does not group unrelated permits solely by street address", () => {
  assert.equal(
    normalize(
      [{ source: SOURCES[1], records: [row, { ...row, permitnum: "101-LU" }] }],
      "98109",
    ).projects.length,
    2,
  );
});
test("untrusted source links cannot become report links", () => {
  const x = normalize(
    [
      {
        source: SOURCES[0],
        records: [{ ...row, link: { url: "javascript:alert(1)" } }],
      },
    ],
    "98109",
  );
  assert.match(x.projects[0].primary.url, /^https:\/\/data.seattle.gov/);
});
test("one failed source yields partial coverage with usable findings", async () => {
  const fetcher = async (url) => {
    if (url.includes("ht3q-kdvx")) throw Error("offline");
    return { ok: true, json: async () => [row] };
  };
  const r = await buildReport("98109", { fetcher });
  assert.equal(r.status, "partial");
  assert.equal(r.projects.length, 1);
  assert.equal(r.coverage[1].status, "failed");
});
test("two failed sources are not an empty successful search", async () => {
  const r = await buildReport("98109", {
    fetcher: async () => {
      throw Error("offline");
    },
  });
  assert.equal(r.status, "unavailable");
});
test("pagination cap is explicitly incomplete", async () => {
  const r = await fetchSource(SOURCES[0], "98109", {
    fetcher: async () => ({ ok: true, json: async () => [row] }),
    pageSize: 1,
    maxPages: 1,
  });
  assert.equal(r.status, "limited");
});
test("empty successful searches preserve unsupported ZIP limitation", async () => {
  const r = await buildReport("98109", {
    fetcher: async () => ({ ok: true, json: async () => [] }),
  });
  assert.equal(r.status, "ready");
  assert.equal(r.projects.length, 0);
  assert.ok(r.limits.some((x) => x.includes("unsupported")));
});
test("dated records sort before undated records even with larger IDs", () => {
  const r = normalize(
    [
      {
        source: SOURCES[1],
        records: [
          { ...row, permitnum: "900-LU" },
          { ...row, permitnum: "101-LU", applieddate: "2026-10-01" },
          { ...row, permitnum: "102-LU", applieddate: "2026-10-15" },
        ],
      },
    ],
    "98109",
  );
  assert.deepEqual(
    r.projects.map((x) => x.id),
    ["102-LU", "101-LU", "900-LU"],
  );
});
test("not approved must not be presented as approval", () =>
  assert.equal(
    classify({ ...row, statuscurrent: "Not Approved" }).stage,
    "Status needs interpretation",
  ));

test("pagination advances offsets and preserves earlier evidence on later HTTP failure", async () => {
  const offsets = [];
  const result = await fetchSource(SOURCES[0], "98109", {
    pageSize: 1,
    maxPages: 3,
    fetcher: async (url) => {
      const query = new URL(url).searchParams;
      offsets.push(query.get("$offset"));
      assert.equal(query.get("$limit"), "1");
      assert.match(query.get("$order"), /permitnum/);
      return offsets.length === 1
        ? { ok: true, json: async () => [row] }
        : { ok: false, status: 429 };
    },
  });
  assert.deepEqual(offsets, ["0", "1"]);
  assert.equal(result.status, "failed");
  assert.equal(result.truncated, true);
  assert.deepEqual(result.records, [row]);
});

test("malformed source payloads and invalid JSON are failures, not empty coverage", async () => {
  for (const json of [
    async () => ({ error: "bad query" }),
    async () => {
      throw SyntaxError("bad JSON");
    },
  ]) {
    const result = await fetchSource(SOURCES[0], "98109", {
      fetcher: async () => ({ ok: true, json }),
    });
    assert.equal(result.status, "failed");
    assert.equal(result.records.length, 0);
    assert.ok(result.error);
  }
});

test("source deadline aborts retrieval and reports a timeout", async () => {
  const result = await fetchSource(SOURCES[0], "98109", {
    deadlineMs: 5,
    fetcher: async (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      }),
  });
  assert.equal(result.status, "failed");
  assert.equal(result.error, "Source request timed out");
});

test("only the requested ZIP survives normalization; ZIP+4 stays usable", () => {
  const result = normalize(
    [
      {
        source: SOURCES[0],
        records: [
          { ...row, permitnum: "MATCH", originalzip: "98109-1234" },
          { ...row, permitnum: "OTHER", originalzip: "98101" },
          { ...row, permitnum: "MISSING", originalzip: null },
        ],
      },
    ],
    "98109",
  );
  assert.deepEqual(
    result.projects.map((p) => p.id),
    ["MATCH"],
  );
  assert.equal(result.excluded, 2);
});
