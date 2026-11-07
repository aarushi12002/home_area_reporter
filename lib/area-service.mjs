import { composeImpactSummary } from "./ranking.mjs";
import { getDatabase, hasDatabaseConfig } from "./db.mjs";
import { SERVICE_AREAS, LEGACY_PREVIEW_ZIPS, JURISDICTIONS, serviceArea, sectionAvailability } from "./service-areas.mjs";
import { getZipProfile } from "./zip-profile.mjs";
import { getPublicProjects } from "./public-projects.mjs";
import { databaseAreaSummary } from "./project-repository.mjs";
import { ReportRequestError } from "./report-cursor.mjs";
import { validPostalCode } from "./service-areas.mjs";

async function storedCoverageRows() {
  let published = [];
  if (hasDatabaseConfig()) {
    const { sql } = getDatabase();
    published = await sql`SELECT a.postal_code, a.enabled, a.readiness, a.published_at, a.successful_refreshes, s.generation,s.summary->'coveredJurisdictions' AS covered_jurisdictions,b.vintage AS baseline_vintage
      FROM service_areas a LEFT JOIN zip_report_snapshots s ON s.postal_code = a.postal_code LEFT JOIN area_baselines b ON b.postal_code=a.postal_code`;
  }
  return published;
}

export async function serviceAreaCoverage(zip = null, {state = null} = {}) {
  const published = await storedCoverageRows();
  return SERVICE_AREAS.filter((area) => zip ? area.zip === zip : state ? area.state===state : area.reviewStatus === "reviewed" || published.some((row)=>row.postal_code===area.zip && row.enabled && row.generation)).map((area) => {
    const row = published.find((item) => item.postal_code === area.zip);
    const profile = getZipProfile(area.zip);
    return {
      ...area,
      status: row?.enabled && row.generation || row?.baseline_vintage ? "ready" : !hasDatabaseConfig() && process.env.NODE_ENV !== "production" && LEGACY_PREVIEW_ZIPS.includes(area.zip) ? "preview" : row?.readiness || "pending",
      reportType:row?.enabled && row.generation ? "local_projects" : row?.baseline_vintage ? "baseline" : null,
      projectStatus:row?.enabled && row.generation ? "ready" : row?.readiness || "pending",
      coveredJurisdictions:row?.covered_jurisdictions||[],
      generation: row?.enabled ? row?.generation || null : null,
      publishedAt: row?.published_at || null,
      successfulRefreshes: row?.successful_refreshes || 0,
      coverageScope: "municipal_records_only",
      sections: sectionAvailability(area.zip, { profile, publicProjects: getPublicProjects(area.zip),jurisdictionId:row?.covered_jurisdictions?.[0] }),
    };
  });
}

// Publication, rather than registry membership or a Census import, controls the live badge.
export function buildCityDirectory(rows, jurisdictions = JURISDICTIONS) {
  const known = new Map(rows.map((row)=>[row.postal_code,row]));
  return jurisdictions.filter((item)=>item.type==="city").map((item)=>{
    const reportZips=item.zips.filter((zip)=>{
      const row=known.get(zip);
      return row?.enabled && row.generation && row.covered_jurisdictions?.includes(item.id);
    });
    const baselineZips=item.zips.filter((zip)=>known.get(zip)?.baseline_vintage);
    const examples=item.previewZip && baselineZips.includes(item.previewZip)?[item.previewZip]:[];
    return {id:item.id,name:item.name,state:item.state,status:reportZips.length?"live":"coming_soon",
      reportZips,projectZipCount:reportZips.length,baselineZipCount:baselineZips.length,
      baselineExamples:examples,priority:item.homePriority??100,sourceStatus:item.sourceStatus};
  }).sort((a,b)=>a.priority-b.priority || a.name.localeCompare(b.name) || a.state.localeCompare(b.state));
}

export async function coverageDirectory({zip=null,state=null,view=null,limit=50,cursor="0"}={}) {
  if(view!==null && view!=="cities")throw new ReportRequestError("Unknown coverage view.");
  if(state!==null && !JURISDICTIONS.some((item)=>item.state===state)) throw new ReportRequestError("This state is not registered in the expansion inventory.",400,"UNSUPPORTED_STATE");
  if(view==="cities") {
    if(zip || cursor!=="0")throw new ReportRequestError("The cities view does not accept ZIP or cursor filters.");
    const cities=buildCityDirectory(await storedCoverageRows()).filter((city)=>!state || city.state===state);
    return {cities,states:[...new Set(JURISDICTIONS.map((item)=>item.state))].sort(),
      scope:"Local project reports are live only for listed published ZIPs. Census snapshots are historical context. Coming soon has no announced release date."};
  }
  if(!/^\d+$/.test(String(cursor)) || !Number.isSafeInteger(Number(cursor)))throw new ReportRequestError("Invalid coverage cursor.");
  const size=Math.min(100,Math.max(1,Math.trunc(Number(limit))||50)),start=Number(cursor);
  if(state && zip && serviceArea(zip)?.state!==state)throw new ReportRequestError("This ZIP is not in the selected state inventory.",400,"UNSUPPORTED_AREA");
  const all=await serviceAreaCoverage(state?null:zip,{state});
  const areas=state ? zip ? all.filter((area)=>area.zip===zip) : all.slice(start,start+size) : all;
  const baseline=zip ? await storedBaseline(zip) : null;
  const known=new Map(all.map((area)=>[area.zip,area]));
  const registered=JURISDICTIONS.filter((item)=>item.state===state);
  const jurisdictions=state ? registered.map((item)=>{
    const ready=item.zips.filter((code)=>known.get(code)?.projectStatus==="ready" && known.get(code).coveredJurisdictions.includes(item.id)).length;
    return {id:item.id,name:item.name,state:item.state,type:item.type,wave:item.wave,totalZips:item.zips.length,readyZips:ready,sourceStatus:item.sourceStatus,nextAction:item.nextAction};
  }) : undefined;
  return {areas,baseline:baseline?{zip,status:"ready",geographyType:baseline.geographyType,vintage:baseline.vintage}:null,
    ...(state?{state,total:all.length,nextCursor:!zip && start+size<all.length?String(start+size):null,progress:{totalZips:all.length,projectReports:all.filter((a)=>a.projectStatus==="ready").length,baselineOnly:all.filter((a)=>a.reportType==="baseline").length,jurisdictions:registered.length},jurisdictions}:{}),
    scope:"Published municipal project reports; national Census baselines; expansion inventory is not completed coverage"};
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
  const baselineResponse = async () => {
    const baseline = await storedBaseline(zip);
    if (!baseline) return null;
    return { zip, reportType: "baseline", status: "ready", headline: `Neighborhood snapshot for ${zip}`, baseline, zipProfile:getZipProfile(zip),publicProjects:getPublicProjects(zip), highlights: [], decisionSignals: [], counts: { permitted: 0, inReview: 0, earlyProposal: 0 }, coverage: [], sourceStatus: "baseline_only", dataSource: "database", fullReportUrl: `/report?zip=${zip}`, refreshedAt: baseline.retrievedAt, coveredJurisdictions: [], sections: { permits: "not_connected", baseline: "ready" } };
  };
  let summary = serviceArea(zip) && hasDatabaseConfig() ? await databaseAreaSummary(zip, { location }) : null;
  if (!summary && allowPreview && previewAllowed(zip)) {
    const { liveAreaSummary } = await import("./live-summary.mjs");
    summary = await liveAreaSummary(zip, { location });
  }
  if (!summary) {
    const baseline=await baselineResponse();
    if(baseline)return baseline;
    if(serviceArea(zip))return pendingReport(zip);
    throw new ReportRequestError("Reports for this ZIP are not available yet.",400,"UNSUPPORTED_AREA");
  }
  const coveredJurisdictions = summary.coveredJurisdictions?.length ? summary.coveredJurisdictions : ["us-wa-seattle"];
  const coveredJurisdictionNames = coveredJurisdictions.map((id)=>JURISDICTIONS.find((item)=>item.id===id)?.name||id);
  const zipProfile = getZipProfile(zip), publicProjects = getPublicProjects(zip);
  const query = new URLSearchParams({ zip });
  if (location) { query.set("lat", String(location.latitude)); query.set("lng", String(location.longitude)); }
  return { ...summary, coveredJurisdictions, coveredJurisdictionNames, impactSummary: composeImpactSummary(summary.impactSummary, publicProjects), reportType: "local_projects", zipProfile, publicProjects, sections: sectionAvailability(zip, { profile: zipProfile, publicProjects, jurisdictionId:coveredJurisdictions[0] }), status: summary.sourceStatus === "unavailable" ? "unavailable" : "ready", sharedZip: serviceArea(zip).shared, fullReportUrl: `/report?${query}` };
}
export { serviceArea };
