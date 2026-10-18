import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const script = readFileSync(
  new URL("../extension/popup.js", import.meta.url),
  "utf8",
);
async function popup(url, zip = "98109", origin = "http://localhost:3000") {
  const el = {
    research: { disabled: true },
    context: {},
    zip: { value: zip },
    origin: { value: origin },
    error: {},
  };
  const opened = [];
  const context = {
    URL,
    document: { getElementById: (id) => el[id] },
    chrome: {
      tabs: { query: async () => [{ url }], create: (x) => opened.push(x) },
    },
  };
  await vm.runInNewContext(script, context);
  return { el, opened };
}
test("Redfin and Zillow use the same ZIP report route without sending listing URL", async () => {
  for (const host of ["www.redfin.com", "www.zillow.com"]) {
    const { el, opened } = await popup(`https://${host}/home?private=discard`);
    el.research.onclick();
    assert.equal(opened[0].url, "http://localhost:3000/report?zip=98109");
  }
});
test("rejects lookalike domains and malformed ZIP", async () => {
  const r = await popup("https://zillow.com.evil.example/");
  assert.equal(r.el.research.disabled, true);
  const x = await popup("https://www.redfin.com/", "9810");
  x.el.research.onclick();
  assert.equal(x.opened.length, 0);
});
test("rejects unsafe reporter origins", async () => {
  for (const origin of [
    "javascript:alert(1)",
    "http://evil.example",
    "https://user:pass@example.com",
    "https://example.com/some-path",
  ]) {
    const r = await popup("https://www.redfin.com/", "98109", origin);
    r.el.research.onclick();
    assert.equal(r.opened.length, 0);
  }
});
