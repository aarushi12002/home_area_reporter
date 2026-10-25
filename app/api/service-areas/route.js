import { serviceAreaCoverage, storedBaseline } from "../../../lib/area-service.mjs";
import { validPostalCode } from "../../../lib/service-areas.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const zip = new URL(request.url).searchParams.get("zip");
  if (zip !== null && !validPostalCode(zip)) return Response.json({ error: "Enter a five-digit ZIP code." }, { status: 400 });
  try {
    const areas = await serviceAreaCoverage(zip);
    const baseline = zip && !areas.length ? await storedBaseline(zip) : null;
    return Response.json({ areas, baseline: baseline ? { zip, status: "ready", geographyType: baseline.geographyType, vintage: baseline.vintage } : null, scope: "Seattle municipal permits; national baseline where connected" }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch { return Response.json({ error: "Coverage status is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
