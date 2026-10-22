import { fetchSoundscore, soundscoreLocation } from "../../../lib/soundscore.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const location = soundscoreLocation(new URL(request.url).searchParams);
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  if (!location) return Response.json({ status: "location_required" }, { status: 400, headers });
  try { return Response.json(await fetchSoundscore(location), { headers }); }
  catch { return Response.json({ status: "unavailable" }, { status: 503, headers }); }
}
