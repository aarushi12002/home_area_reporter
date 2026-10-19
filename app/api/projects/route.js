import { hasDatabaseConfig } from "../../../lib/db.mjs";
import { liveProjects } from "../../../lib/live-summary.mjs";
import { INITIAL_SERVICE_AREAS } from "../../../lib/project-pipeline.mjs";
import {
  areaCoverage,
  areaIngested,
  paginatedProjects,
  supportedArea,
} from "../../../lib/project-repository.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestOptions(searchParams) {
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lng"));
  const location =
    searchParams.has("lat") &&
    searchParams.has("lng") &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  return {
    cursor: searchParams.get("cursor") || "0",
    limit: searchParams.get("limit") || "20",
    includeHidden: searchParams.get("include") === "historical",
    location,
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const zip = url.searchParams.get("zip") || "";
  if (!INITIAL_SERVICE_AREAS.includes(zip))
    return Response.json({ error: "Unsupported preview ZIP code." }, { status: 400 });
  const options = requestOptions(url.searchParams);
  try {
    if (
      hasDatabaseConfig() &&
      (await supportedArea(zip)) &&
      (await areaIngested(zip))
    ) {
      const result = await paginatedProjects(zip, options);
      return Response.json({
        ...result,
        dataSource: "database",
        coverage: await areaCoverage(zip),
      });
    }
    const result = await liveProjects(zip, options);
    return Response.json({ ...result, dataSource: "live_fallback" });
  } catch (error) {
    return Response.json(
      { error: "Project evidence is temporarily unavailable.", detail: error.message },
      { status: 503 },
    );
  }
}
