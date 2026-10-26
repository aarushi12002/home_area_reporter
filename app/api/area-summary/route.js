import { validPostalCode } from "../../../lib/service-areas.mjs";
import { areaSummary } from "../../../lib/area-service.mjs";
import { locationFrom } from "../../../lib/report-cursor.mjs";
import { getZipProfile } from "../../../lib/zip-profile.mjs";
import { getPublicProjects } from "../../../lib/public-projects.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request) {
  const url = new URL(request.url), zip = url.searchParams.get("zip") || "";
  if (!validPostalCode(zip)) return Response.json({ error: "Enter a five-digit ZIP code." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  let location;
  try { location = locationFrom(url.searchParams); }
  catch (error) { return Response.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "private, no-store" } }); }
  const zipProfile = getZipProfile(zip), publicProjects = getPublicProjects(zip);
  const cacheControl = !location && [...url.searchParams.keys()].every((key) => key === "zip") ? "public, max-age=300, s-maxage=300" : "private, no-store";
  try {
    const summary = await areaSummary(zip, { location, allowPreview: true });
    const status = summary.status === "preparing" ? 202 : summary.status === "unavailable" ? 503 : 200;
    return Response.json(summary, {
      status,
      headers: { "Cache-Control": summary.dataSource !== "database" || status !== 200 ? "private, no-store" : cacheControl },
    });
  } catch (error) {
    if (error.status) return Response.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    return Response.json({ error: "Area summary is temporarily unavailable.", status: "unavailable", zipProfile, publicProjects }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
