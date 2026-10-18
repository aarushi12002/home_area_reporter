import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/report/route.js";

// Exercise the real route, including its module-local cache, without upstream I/O.
// Each scenario owns a distinct ZIP; global fetch/clock mocks are restored by Node.
const request = (zip) =>
  new Request(`https://report.example/api/report?zip=${zip}`);
const ok = () => ({ ok: true, json: async () => [] });

test("invalid input is rejected before any source lookup", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return ok();
  });
  for (const zip of ["", "9810", "10001", "98109%27%20OR%201=1"]) {
    assert.equal((await GET(request(zip))).status, 400);
  }
  assert.equal(calls, 0);
});

test("ready reports are cached, then refreshed after the TTL", async (t) => {
  let calls = 0;
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return ok();
  });
  const first = await GET(request("98101"));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");
  assert.equal((await first.json()).cached, false);
  assert.equal((await (await GET(request("98101"))).json()).cached, true);
  assert.equal(calls, 2);
  now += 15 * 60 * 1000 + 1;
  assert.equal((await (await GET(request("98101"))).json()).cached, false);
  assert.equal(calls, 4);
});

test("concurrent requests for one ZIP share source retrieval", async (t) => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    await gate;
    return ok();
  });
  const first = GET(request("98102"));
  const second = GET(request("98102"));
  assert.equal(calls, 2);
  release();
  const responses = await Promise.all([first, second]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  assert.equal(calls, 2);
});

test("partial coverage remains HTTP 200 and retries rather than caching failure", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    calls++;
    if (url.includes("ht3q-kdvx")) throw Error("upstream unavailable");
    return ok();
  });
  for (let i = 0; i < 2; i++) {
    const response = await GET(request("98103"));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "partial");
    assert.equal(body.cached, false);
    assert.equal(body.coverage[1].status, "failed");
  }
  assert.equal(calls, 4);
});

test("total source outage returns 503 with coverage and permits recovery", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => {
    throw Error("offline");
  });
  const failed = await GET(request("98104"));
  assert.equal(failed.status, 503);
  const body = await failed.json();
  assert.equal(body.status, "unavailable");
  assert.ok(body.coverage.every((source) => source.status === "failed"));
  mock.mock.mockImplementation(async () => ok());
  const recovered = await GET(request("98104"));
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).status, "ready");
});
