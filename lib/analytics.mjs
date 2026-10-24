// Website-only GA4 boundary. Never pass arbitrary event properties or URLs.
export const ANALYTICS_ORIGIN = "https://home-area-reporter.vercel.app";
// Public stream identifier, not a credential. Environment settings can override/disable it.
export const DEFAULT_GA_MEASUREMENT_ID = "G-4R4PJRD22N";
export const CONSENT_KEY = "har-analytics-consent-v1";
const PAGES = {
  "/": "Home Area Reporter",
  "/report": "Neighborhood report",
  "/privacy": "Privacy",
};
const EVENTS = {
  zip_search: { zip: /^981\d{2}$/ },
  report_loaded: { zip: /^981\d{2}$/, coverage: /^(complete|partial|unavailable)$/ },
  audience_selected: { audience: /^(all|home|business)$/ },
  full_report_opened: {},
  pro_interest: {},
};

export function analyticsPage(pathname) {
  // Accept a path, not location.href: query/hash/title/referrer never enter GA.
  const path = String(pathname).split(/[?#]/)[0];
  if (!Object.hasOwn(PAGES, path)) return null;
  return { page_location: ANALYTICS_ORIGIN + path, page_title: PAGES[path], page_referrer: "" };
}

export function eventParameters(name, values = {}) {
  if (!Object.hasOwn(EVENTS, name)) return null;
  const result = {};
  for (const [key, pattern] of Object.entries(EVENTS[name])) {
    if (typeof values[key] === "string" && pattern.test(values[key])) result[key] = values[key];
  }
  return result;
}

export function createAnalyticsClient(browser, { measurementId, enabled, production }) {
  let started = false;
  let lastPage = null;
  const eligible = production && enabled === "true" && /^G-[A-Z0-9]{4,20}$/.test(measurementId || "")
    && browser.location.origin === ANALYTICS_ORIGIN && browser.self === browser.top;
  function command() { browser.dataLayer.push(arguments); }
  function consent() {
    try {
      const value = browser.localStorage.getItem(CONSENT_KEY);
      return ["granted", "denied"].includes(value) ? value : null;
    } catch { return null; }
  }
  function canSend() {
    return eligible && consent() === "granted" && !!analyticsPage(browser.location.pathname);
  }
  function page(pathname) {
    const details = analyticsPage(pathname);
    if (!started || !canSend() || !details || lastPage === details.page_location) return false;
    command("set", details);
    command("event", "page_view", { ...details, send_to: measurementId });
    lastPage = details.page_location;
    return true;
  }
  return {
    eligible,
    consent,
    start() {
      if (!canSend()) return false;
      if (started) return true;
      browser[`ga-disable-${measurementId}`] = false;
      browser.dataLayer = browser.dataLayer || [];
      const details = analyticsPage(browser.location.pathname);
      command("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
      command("consent", "update", { analytics_storage: "granted" });
      command("set", details);
      command("js", new Date());
      command("config", measurementId, {
        ...details, send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_domain: "none",
        cookie_expires: 7776000, cookie_flags: "SameSite=Lax;Secure",
      });
      const script = browser.document.createElement("script");
      script.id = "har-google-analytics";
      script.async = true;
      script.referrerPolicy = "origin";
      script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
      browser.document.head.appendChild(script);
      started = true;
      page(browser.location.pathname);
      return true;
    },
    page,
    event(name, values) {
      const details = analyticsPage(browser.location.pathname);
      const safe = eventParameters(name, values);
      if (!started || !canSend() || !details || !safe) return false;
      command("event", name, { ...details, ...safe, send_to: measurementId });
      return true;
    },
    choose(value) {
      if (!["granted", "denied"].includes(value)) return;
      try { browser.localStorage.setItem(CONSENT_KEY, value); } catch { /* No persistent permission: keep analytics off. */ }
      if (value === "granted") this.start();
      else {
        browser[`ga-disable-${measurementId}`] = true;
        browser.document.getElementById("har-google-analytics")?.remove();
        for (const cookie of browser.document.cookie.split(";")) {
          const name = cookie.split("=")[0].trim();
          if (/^_ga(?:_|$)/.test(name)) browser.document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
        }
        if (started) {
          started = false;
          lastPage = null;
          // Unload the already-executing Google tag; removal alone cannot do so.
          browser.location.reload();
        }
      }
    },
  };
}

let activeClient = null;
export function setAnalyticsClient(client) { activeClient = client; }
export function trackAnalyticsEvent(name, values) { return activeClient?.event(name, values) || false; }
