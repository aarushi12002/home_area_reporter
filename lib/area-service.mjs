import { getDatabase, hasDatabaseConfig } from "./db.mjs";
import { SERVICE_AREAS, LEGACY_PREVIEW_ZIPS, serviceArea, sectionAvailability } from "./service-areas.mjs";
import { getZipProfile } from "./zip-profile.mjs";
import { getPublicProjects } from "./public-projects.mjs";
import { databaseAreaSummary } from "./project-repository.mjs";
import { ReportRequestError } from "./report-cursor.mjs";
import { validPostalCode } from "./service-areas.mjs";

export async function serviceAreaCoverage(zip = null) {
  let published = [];
  if (hasDatabaseConfig()) {
    const { sql } = getDatabase();
    published = await sql`SELECT a.postal_code, a.enabled, a.readiness, a.published_at, a.successful_refreshes, s.generation
      FROM service_areas a LEFT JOIN zip_report_snapshots s ON s.postal_code = a.postal_code`;
  }
  return SERVICE_AREAS.filter((area) => !zip || area.zip === zip).map((area) => {
    const row = published.find((item) => item.postal_code === area.zip);
    const profile = getZipProfile(area.zip);
    return {
      ...area,
      status: row?.enabled && row.generation ? "ready" : !hasDatabaseConfig() && process.env.NODE_ENV !== "production" && LEGACY_PREVIEW_ZIPS.includes(area.zip) ? "preview" : row?.readiness || "pending",
      generation: row?.enabled ? row?.generation || null : null,
      publishedAt: row?.published_at || null,
      successfulRefreshes: row?.successful_refreshes || 0,
      coverageScope: "municipal_records_only",
      sections: sectionAvailability(area.zip, { profile, publicProjects: getPublicProjects(area.zip) }),
    };
  });
}

export async function storedBaseline(zip) {
  if (!hasDatabaseConfig()) return null;
  const { sql } = getDatabase();
  const [row] = await sql`SELECT * FROM area_baselines WHERE postal_code = ${zip}`;
  return row ? { zip, geographyType: row.geography_type, vintage: row.vintage, metrics: row.metrics, provenance: row.provenance, retrievedAt: row.retrieved_at } : null;
}

export function pendingReport(zip) {
  return { zip, status: "preparing", code: "REPORT_PREPARING", error: "This ZIP’s report is being prepared. Please check back soon.", zipProfile: getZipProfile(zip), publicProjects: getPublicProjects(zip), coverageScope: "municipal_records_only" };
}
export function previewAllowed(zip) {
  return !hasDatabaseConfig() && process.env.NODE_ENV !== "production" && LEGACY_PREVIEW_ZIPS.includes(zip);
}

export async function areaSummary(zip, { location = null, allowPreview = false } = {}) {
  if (!validPostalCode(zip)) throw new ReportRequestError("Enter a five-digit ZIP code.");
  if (!serviceArea(zip)) {
    const baseline = await storedBaseline(zip);
    if (!baseline) throw new ReportRequestError("Reports for this ZIP are not available yet.", 400, "UNSUPPORTED_AREA");
    return { zip, reportType: "baseline", status: "ready", headline: `Neighborhood snapshot for ${zip}`, baseline, highlights: [], decisionSignals: [], counts: { permitted: 0, inReview: 0, earlyProposal: 0 }, coverage: [], sourceStatus: "baseline_only", dataSource: "database", fullReportUrl: `/report?zip=${zip}`, refreshedAt: baseline.retrievedAt, coveredJurisdictions: [], sections: { permits: "not_connected", baseline: "ready" } };
  }
  let summary = hasDatabaseConfig() ? await databaseAreaSummary(zip, { location }) : null;
  if (!summary && allowPreview && previewAllowed(zip)) {
    const { liveAreaSummary } = await import("./live-summary.mjs");
    summary = await liveAreaSummary(zip, { location });
  }
  if (!summary) return pendingReport(zip);
  const zipProfile = getZipProfile(zip), publicProjects = getPublicProjects(zip);
  const query = new URLSearchParams({ zip });
  if (location) { query.set("lat", String(location.latitude)); query.set("lng", String(location.longitude)); }
  return { ...summary, reportType: "local_projects", zipProfile, publicProjects, sections: sectionAvailability(zip, { profile: zipProfile, publicProjects }), status: summary.sourceStatus === "unavailable" ? "unavailable" : "ready", sharedZip: serviceArea(zip).shared, fullReportUrl: `/report?${query}` };
}
export { serviceArea };
