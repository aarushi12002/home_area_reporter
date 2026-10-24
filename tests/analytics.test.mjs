import test from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_ORIGIN, CONSENT_KEY, analyticsPage, createAnalyticsClient, eventParameters } from "../lib/analytics.mjs";

function fixture({ consent, origin = ANALYTICS_ORIGIN, pathname = "/report", embedded = false, ...options } = {}) {
  const stored = new Map(consent ? [[CONSENT_KEY, consent]] : []);
  const scripts = [], removed = [], cleared = [];
  const browser = {
    location: { origin, pathname, href: `${origin}${pathname}?zip=98103&address=PRIVATE_ADDRESS&lat=47.6&lng=-122.3#private`, reload() { browser.reloaded = true; } },
    document: {
      title: "PRIVATE_ADDRESS", referrer: "https://www.redfin.com/PRIVATE_LISTING",
      createElement() { return {}; },
      head: { appendChild(script) { scripts.push(script); } },
      getElementById(id) { return scripts.find(s => s.id === id) ? { remove() { removed.push(id); } } : null; },
      get cookie() { return "_ga=example; _ga_TEST123456=example; essential=yes"; },
      set cookie(value) { cleared.push(value); },
    },
    localStorage: { getItem(key) { return stored.get(key) || null; }, setItem(key, value) { stored.set(key, value); } },
  };
  browser.self = browser;
  browser.top = embedded ? {} : browser;
  const client = createAnalyticsClient(browser, { measurementId: "G-TEST123456", enabled: "true", production: true, ...options });
  return { client, browser, scripts, removed, cleared, commands: () => (browser.dataLayer || []).map(x => Array.from(x)) };
}

test("GA makes no requests or queues before consent, and does not replay declined actions", () => {
  const f = fixture();
  assert.equal(f.client.start(), false);
  assert.equal(f.client.event("pro_interest"), false);
  f.client.choose("denied");
  assert.equal(f.scripts.length, 0);
  assert.deepEqual(f.commands(), []);
  f.client.choose("granted");
  assert.equal(f.scripts.length, 1);
  assert.equal(f.commands().filter(x => x[1] === "pro_interest").length, 0);
  assert.equal(f.commands().filter(x => x[1] === "page_view").length, 1);
});

test("configured GA requires production, exact live origin, a valid ID and top-level page", () => {
  for (const options of [{ production: false }, { enabled: "false" }, { measurementId: "" }, { measurementId: 'G-TEST\"<script>' }, { origin: "http://localhost:3000" }, { origin: "https://preview.vercel.app" }, { embedded: true }, { pathname: "/map" }]) {
    const f = fixture({ consent: "granted", ...options });
    assert.equal(f.client.start(), false, JSON.stringify(options));
    assert.equal(f.scripts.length, 0);
  }
});

test("manual pageviews and events strip identifying URLs, titles, referrers and extra values", () => {
  const f = fixture({ consent: "granted" });
  assert.equal(f.client.start(), true);
  f.client.event("report_loaded", { zip: "98103", coverage: "partial", address: "PRIVATE_ADDRESS", lat: 47.6, url: "PRIVATE_LISTING" });
  f.client.event("audience_selected", { audience: "PRIVATE_ADDRESS" });
  f.client.event("arbitrary_event", { url: "PRIVATE_LISTING" });
  const payload = JSON.stringify(f.commands());
  assert.doesNotMatch(payload, /PRIVATE_|lat=|lng=|zip=|address|redfin/);
  const config = f.commands().find(x => x[0] === "config")[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.page_location, ANALYTICS_ORIGIN + "/report");
  assert.equal(config.page_referrer, "");
  assert.equal(f.scripts[0].referrerPolicy, "origin");
  assert.deepEqual(f.commands().find(x => x[1] === "report_loaded")[2], { ...analyticsPage("/report"), zip: "98103", coverage: "partial", send_to: "G-TEST123456" });
});

test("route changes emit one manual view per transition and never instrument unknown paths", () => {
  const f = fixture({ consent: "granted" });
  f.client.start();
  f.client.start();
  f.client.page("/report");
  f.browser.location.pathname = "/privacy";
  f.client.page("/privacy");
  f.client.page("/privacy");
  f.browser.location.pathname = "/report";
  f.client.page("/report");
  f.browser.location.pathname = "/private-property-address";
  assert.equal(f.client.event("pro_interest"), false);
  assert.equal(f.client.page("/private-property-address"), false);
  assert.equal(f.commands().filter(x => x[1] === "page_view").length, 3);
});

test("withdrawal disables GA, removes its tag/cookies and reloads to unload vendor code", () => {
  const f = fixture({ consent: "granted" });
  f.client.start();
  const previous = f.commands().length;
  f.client.choose("denied");
  assert.equal(f.client.consent(), "denied");
  assert.equal(f.browser["ga-disable-G-TEST123456"], true);
  assert.equal(f.browser.reloaded, true);
  assert.deepEqual(f.removed, ["har-google-analytics"]);
  assert.equal(f.cleared.length, 2);
  assert.ok(f.cleared.every(x => x.startsWith("_ga")));
  assert.equal(f.client.event("pro_interest"), false);
  assert.equal(f.commands().length, previous);
});

test("blocked preference storage keeps GA off", () => {
  const f = fixture();
  f.browser.localStorage.getItem = () => { throw Error("blocked"); };
  f.browser.localStorage.setItem = () => { throw Error("blocked"); };
  assert.doesNotThrow(() => f.client.choose("granted"));
  assert.equal(f.scripts.length, 0);
});

test("only documented event names and fixed categorical/coarse ZIP parameters survive", () => {
  assert.deepEqual(eventParameters("zip_search", { zip: "98103", email: "secret@example.test" }), { zip: "98103" });
  assert.deepEqual(eventParameters("zip_search", { zip: "98103?address=private" }), {});
  assert.equal(eventParameters("__proto__", {}), null);
  assert.equal(analyticsPage("/map?address=private"), null);
  assert.deepEqual(analyticsPage("/report?address=private#private"), analyticsPage("/report"));
});
