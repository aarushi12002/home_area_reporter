import { hasDatabaseConfig } from "../../../lib/db.mjs";
import { liveProjects } from "../../../lib/live-summary.mjs";
import { paginatedProjects } from "../../../lib/project-repository.mjs";
import { serviceArea, pendingReport, previewAllowed } from "../../../lib/area-service.mjs";
import { locationFrom } from "../../../lib/report-cursor.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const { searchParams } = new URL(request.url), zip = searchParams.get("zip") || "";
  if (!serviceArea(zip)) return Response.json({ error: "Project coverage for this ZIP is not available yet." }, { status: 400 });
  try {
    const options = { cursor: searchParams.get("cursor") || "0", generation: searchParams.get("generation"), limit: searchParams.get("limit") || "20", includeHidden: searchParams.get("include") === "historical", location: locationFrom(searchParams) };
    const result = hasDatabaseConfig() ? await paginatedProjects(zip, options) : previewAllowed(zip) ? await liveProjects(zip, options) : null;
    if (!result) return Response.json(pendingReport(zip), { status: 202, headers: { "Cache-Control": "no-store" } });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : "Project evidence is temporarily unavailable.", code: error.code || "UNAVAILABLE" }, { status: error.status || 503, headers: { "Cache-Control": "no-store" } });
  }
}
