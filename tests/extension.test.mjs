import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const script = readFileSync(new URL("../extension/popup.js", import.meta.url), "utf8");

function element(initial = {}) {
  return {
    disabled: false,
    hidden: false,
    textContent: "",
    value: "",
    href: "",
    children: [],
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    ...initial,
  };
}

async function popup({
  url = "https://www.redfin.com/example",
  listing = { zip: "98103", address: "1 Example St", latitude: 47.6, longitude: -122.3 },
  zip,
  origin = "http://localhost:3000",
  decisionSignals = [],
} = {}) {
  const ids = [
    "research",
    "error",
    "origin",
    "zip",
    "context",
    "results",
    "headline",
    "signals",
    "permitted",
    "review",
    "proposal",
    "project-map",
    "highlights",
    "full-report",
    "refresh",
  ];
  const el = Object.fromEntries(ids.map((id) => [id, element()]));
  el.research.disabled = true;
  el.origin.value = origin;
  if (zip) el.zip.value = zip;
  const requests = [];
  const context = {
    URL,
    URLSearchParams,
    console,
    document: {
      getElementById: (id) => el[id],
      createElement: () => element(),
    },
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set: async () => {},
        },
      },
      tabs: { query: async () => [{ id: 7, url }] },
      scripting: { executeScript: async () => [{ result: listing }] },
    },
    fetch: async (requestUrl) => {
      requests.push(String(requestUrl));
      return {
        ok: true,
        json: async () => ({
          headline: "3 current documented projects in 98103",
          decisionSignals,
          counts: { permitted: 1, inReview: 2, earlyProposal: 0 },
          highlights: [
            {
              address: "2 Example Ave",
              summary: "New apartment building",
              reasons: ["0.4 miles away", "In review"],
            },
          ],
          refreshedAt: "2026-10-18T00:00:00.000Z",
        }),
      };
    },
  };
  await vm.runInNewContext(script, context);
  return { el, requests };
}

test("Redfin and Zillow fetch a compact summary without sending the listing URL", async () => {
  for (const host of ["www.redfin.com", "www.zillow.com"]) {
    const state = await popup({ url: `https://${host}/home?private=discard` });
    await state.el.research.onclick();
    assert.equal(state.requests.length, 1);
    assert.match(state.requests[0], /\/api\/area-summary\?/);
    assert.match(state.requests[0], /zip=98103/);
    assert.doesNotMatch(state.requests[0], /private|redfin|zillow/);
    assert.equal(state.el.results.hidden, false);
    assert.match(state.el["full-report"].href, /\/report\?/);
    assert.match(state.el["project-map"].src, /\/map\?/);
    assert.equal(state.el["project-map"].hidden, false);
    assert.doesNotMatch(state.el["project-map"].src, /private|redfin|zillow/);
  }
});

test("popup renders four compact decision signals safely and clears them on repeat searches", async () => {
  const state = await popup({ decisionSignals: Array.from({ length: 6 }, (_, index) => ({ title: index === 0 ? "<script>unsafe</script>" : `Signal ${index}`, metric: `${index + 1} matching plans` })) });
  await state.el.research.onclick();
  assert.equal(state.el.signals.hidden, false);
  assert.equal(state.el.signals.children.length, 4);
  assert.equal(state.el.signals.children[0].children[0].textContent, "<script>unsafe</script>");
  await state.el.research.onclick();
  assert.equal(state.el.signals.children.length, 4);
  const empty = await popup();
  await empty.el.research.onclick();
  assert.equal(empty.el.signals.hidden, true);
});

test("rejects lookalike domains and unsupported ZIPs", async () => {
  const lookalike = await popup({ url: "https://zillow.com.evil.example/" });
  assert.equal(lookalike.el.research.disabled, true);
  const unsupported = await popup({ listing: { zip: "98109" }, zip: "98109" });
  await unsupported.el.research.onclick();
  assert.equal(unsupported.requests.length, 0);
  assert.match(unsupported.el.error.textContent, /98101 through 98105/);
});

test("rejects unsafe reporter origins", async () => {
  for (const origin of [
    "javascript:alert(1)",
    "http://evil.example",
    "https://user:pass@example.com",
    "https://example.com/some-path",
  ]) {
    const state = await popup({ origin });
    await state.el.research.onclick();
    assert.equal(state.requests.length, 0);
  }
});
