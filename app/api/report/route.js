import { buildReport, validZip } from "../../../lib/report.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
// Best-effort per-instance cache and deduplication; not durable storage or quotas.
const cache = new Map();
const pending = new Map();
const TTL = 15 * 60 * 1000;
export async function GET(request) {
  if (process.env.NODE_ENV === "production") return Response.json({ error: "Use /api/area-summary for stored reports." }, { status: 410 });
  const zip = new URL(request.url).searchParams.get("zip") || "";
  if (!validZip(zip))
    return Response.json(
      { error: "Enter a five-digit Seattle-area ZIP beginning with 98." },
      { status: 400 },
    );
  const existing = cache.get(zip);
  if (existing && existing.expires > Date.now())
    return Response.json(
      { ...existing.report, cached: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    if (!pending.has(zip)) pending.set(zip, buildReport(zip));
    const report = await pending.get(zip);
    if (report.status === "ready") {
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(zip, { report, expires: Date.now() + TTL });
    }
    return Response.json(
      { ...report, cached: false },
      {
        status: report.status === "unavailable" ? 503 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { error: "Report generation failed. Please retry." },
      { status: 500 },
    );
  } finally {
    pending.delete(zip);
  }
}
