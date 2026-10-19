import { hasDatabaseConfig } from "../../../lib/db.mjs";
import { liveAreaSummary } from "../../../lib/live-summary.mjs";
import { INITIAL_SERVICE_AREAS } from "../../../lib/project-pipeline.mjs";
import {
  areaIngested,
  databaseAreaSummary,
  supportedArea,
} from "../../../lib/project-repository.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function locationFrom(searchParams) {
  if (!searchParams.has("lat") || !searchParams.has("lng")) return null;
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lng"));
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    throw new Error("Invalid listing coordinates.");
  return { latitude, longitude };
}

export async function GET(request) {
  const url = new URL(request.url);
  const zip = url.searchParams.get("zip") || "";
  if (!INITIAL_SERVICE_AREAS.includes(zip))
    return Response.json(
      { error: "This preview currently supports Seattle ZIP codes 98101 through 98105." },
      { status: 400 },
    );
  let location;
  try {
    location = locationFrom(url.searchParams);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  try {
    let summary;
    if (
      hasDatabaseConfig() &&
      (await supportedArea(zip)) &&
      (await areaIngested(zip))
    )
      summary = await databaseAreaSummary(zip, { location });
    else summary = await liveAreaSummary(zip, { location });
    const query = new URLSearchParams({ zip });
    if (location) {
      query.set("lat", String(location.latitude));
      query.set("lng", String(location.longitude));
    }
    return Response.json(
      {
        ...summary,
        status: summary.sourceStatus === "unavailable" ? "unavailable" : "ready",
        fullReportUrl: `/report?${query}`,
      },
      {
        status: summary.sourceStatus === "unavailable" ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return Response.json(
      { error: "Area summary is temporarily unavailable.", detail: error.message },
      { status: 503 },
    );
  }
}
