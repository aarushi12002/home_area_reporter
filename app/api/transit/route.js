import { getTransitOverlay, TRANSIT_BOUNDS } from "../../../lib/transit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const zip = new URL(request.url).searchParams.get("zip") || "";
  if (!Object.hasOwn(TRANSIT_BOUNDS, zip)) return Response.json({ error: "Unsupported ZIP" }, { status: 400 });
  try {
    return Response.json(await getTransitOverlay(zip), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", error: "Bus routes are temporarily unavailable." }, { status: 503 });
  }
}
