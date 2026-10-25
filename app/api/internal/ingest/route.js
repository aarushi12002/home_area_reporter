import { runIngestionBatch } from "../../../../lib/ingestion.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await runIngestionBatch();
    return Response.json({ ok: true, results });
  } catch (error) {
    return Response.json(
      { ok: false, error: "Scheduled ingestion failed.", detail: error.message },
      { status: 500 },
    );
  }
}
