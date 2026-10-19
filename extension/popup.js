"use strict";

const SUPPORTED_ZIP = /^9810[1-5]$/;

function extractListingContext() {
  const result = { zip: "", address: "", latitude: null, longitude: null };
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    const address = value.address;
    if (address && typeof address === "object") {
      result.zip ||= String(address.postalCode || "").slice(0, 5);
      result.address ||=
        [address.streetAddress, address.addressLocality, address.addressRegion]
          .filter(Boolean)
          .join(", ");
    }
    const geo = value.geo;
    if (geo && typeof geo === "object") {
      const latitude = Number(geo.latitude);
      const longitude = Number(geo.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        result.latitude = latitude;
        result.longitude = longitude;
      }
    }
    Object.values(value).forEach(visit);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(script.textContent));
    } catch {}
  }
  const pageText = `${document.title} ${document.body?.innerText || ""}`;
  result.zip ||= pageText.match(/\b9810[1-5]\b/)?.[0] || "";
  return result;
}

function validOrigin(value) {
  const origin = new URL(value);
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  )
    throw new Error("Enter the website origin only, without a path or credentials.");
  if (
    origin.protocol !== "https:" &&
    !(
      origin.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname)
    )
  )
    throw new Error("Use HTTPS, or localhost for development.");
  return origin.origin;
}

function appendHighlight(container, project) {
  const article = document.createElement("article");
  article.className = "highlight";
  const title = document.createElement("h3");
  title.textContent = project.address;
  const summary = document.createElement("p");
  summary.textContent = project.summary;
  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = project.reasons.join(" · ");
  article.append(title, summary, meta);
  container.append(article);
}

(async () => {
  const button = document.getElementById("research");
  const error = document.getElementById("error");
  const originInput = document.getElementById("origin");
  let listing = { zip: "", address: "", latitude: null, longitude: null };
  try {
    const saved = await chrome.storage.local.get("reporterOrigin");
    if (saved.reporterOrigin) originInput.value = saved.reporterOrigin;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    if (
      url.protocol !== "https:" ||
      !/(^|\.)(redfin|zillow)\.com$/.test(url.hostname)
    )
      throw new Error("Open a Redfin or Zillow property listing first.");
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractListingContext,
    });
    listing = injection?.result || listing;
    if (SUPPORTED_ZIP.test(listing.zip)) {
      document.getElementById("zip").value = listing.zip;
      document.getElementById("context").textContent = listing.address
        ? `Listing detected: ${listing.address}`
        : `Listing ZIP detected: ${listing.zip}`;
    } else {
      document.getElementById("context").textContent =
        "Confirm one of the initial Seattle ZIP codes: 98101–98105.";
    }
    button.disabled = false;
    button.onclick = async () => {
      error.textContent = "";
      document.getElementById("results").hidden = true;
      try {
        const zip = document.getElementById("zip").value.trim();
        if (!SUPPORTED_ZIP.test(zip))
          throw new Error("Enter a ZIP code from 98101 through 98105.");
        const origin = validOrigin(originInput.value);
        await chrome.storage.local.set({ reporterOrigin: origin });
        const query = new URLSearchParams({ zip });
        if (
          Number.isFinite(listing.latitude) &&
          Number.isFinite(listing.longitude) &&
          listing.zip === zip
        ) {
          query.set("lat", String(listing.latitude));
          query.set("lng", String(listing.longitude));
        }
        button.disabled = true;
        button.textContent = "Checking official records…";
        const response = await fetch(`${origin}/api/area-summary?${query}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Area summary unavailable.");
        document.getElementById("headline").textContent = body.headline;
        document.getElementById("permitted").textContent = body.counts.permitted;
        document.getElementById("review").textContent = body.counts.inReview;
        document.getElementById("proposal").textContent = body.counts.earlyProposal;
        const highlights = document.getElementById("highlights");
        highlights.replaceChildren();
        body.highlights.forEach((project) => appendHighlight(highlights, project));
        const report = new URL("/report", origin);
        report.search = query;
        if (listing.address && listing.zip === zip)
          report.searchParams.set("address", listing.address);
        document.getElementById("full-report").href = report.href;
        const map = new URL("/map", origin);
        map.search = query;
        const mapFrame = document.getElementById("project-map");
        mapFrame.src = map.href;
        mapFrame.hidden = false;
        document.getElementById("refresh").textContent = body.refreshedAt
          ? `Official records refreshed ${new Date(body.refreshedAt).toLocaleString()}.`
          : "Based on connected official records.";
        document.getElementById("results").hidden = false;
      } catch (requestError) {
        error.textContent = requestError.message;
      } finally {
        button.disabled = false;
        button.textContent = "Check this area";
      }
    };
  } catch (setupError) {
    error.textContent = setupError.message;
  }
})();
