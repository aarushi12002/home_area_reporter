import { databaseAreaSummary } from "../../../lib/project-repository.mjs";
import { liveAreaSummary } from "../../../lib/live-summary.mjs";
import { validPostalCode, sectionAvailability } from "../../../lib/service-areas.mjs";
import { serviceArea, pendingReport, previewAllowed, storedBaseline } from "../../../lib/area-service.mjs";
import { hasDatabaseConfig } from "../../../lib/db.mjs";
import { locationFrom } from "../../../lib/report-cursor.mjs";
import { getZipProfile } from "../../../lib/zip-profile.mjs";
import { getPublicProjects } from "../../../lib/public-projects.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request) {
  const url = new URL(request.url), zip = url.searchParams.get("zip") || "";
  if (!validPostalCode(zip)) return Response.json({ error: "Enter a five-digit ZIP code." }, { status: 400 });
  let location;
  try { location = locationFrom(url.searchParams); }
  catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  const zipProfile = getZipProfile(zip), publicProjects = getPublicProjects(zip);
  const cacheControl = !location && [...url.searchParams.keys()].every((key) => key === "zip") ? "public, max-age=300, s-maxage=300" : "private, no-store";
  try {
    if (!serviceArea(zip)) {
      const baseline = await storedBaseline(zip);
      if (!baseline) return Response.json({ error: "Reports for this ZIP are not available yet.", code: "UNSUPPORTED_AREA" }, { status: 400 });
      return Response.json({ zip, reportType: "baseline", status: "ready", headline: `Neighborhood snapshot for ${zip}`, baseline, highlights: [], decisionSignals: [], counts: { permitted: 0, inReview: 0, earlyProposal: 0 }, coverage: [], sourceStatus: "baseline_only", dataSource: "database", fullReportUrl: `/report?zip=${zip}`, refreshedAt: baseline.retrievedAt, coveredJurisdictions: [], sections: { permits: "not_connected", baseline: "ready" } }, { headers: { "Cache-Control": cacheControl } });
    }
    let summary = hasDatabaseConfig() ? await databaseAreaSummary(zip, { location }) : null;
    if (!summary && previewAllowed(zip)) summary = await liveAreaSummary(zip, { location });
    if (!summary) return Response.json(pendingReport(zip), { status: 202, headers: { "Cache-Control": "no-store" } });
    const query = new URLSearchParams({ zip });
    if (location) { query.set("lat", String(location.latitude)); query.set("lng", String(location.longitude)); }
    const unavailable = summary.sourceStatus === "unavailable";
    return Response.json({ ...summary, reportType: "local_projects", zipProfile, publicProjects, sections: sectionAvailability(zip, { profile: zipProfile, publicProjects }), status: unavailable ? "unavailable" : "ready", sharedZip: serviceArea(zip).shared, fullReportUrl: `/report?${query}` }, {
      status: unavailable ? 503 : 200,
      headers: { "Cache-Control": summary.dataSource !== "database" || unavailable ? "private, no-store" : cacheControl },
    });
  } catch {
    return Response.json({ error: "Area summary is temporarily unavailable.", status: "unavailable", zipProfile, publicProjects }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
