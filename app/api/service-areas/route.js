import { coverageDirectory } from "../../../lib/area-service.mjs";
import { validPostalCode } from "../../../lib/service-areas.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const params=new URL(request.url).searchParams, zip = params.get("zip");
  if (zip !== null && !validPostalCode(zip)) return Response.json({ error: "Enter a five-digit ZIP code." }, { status: 400 });
  try {
    return Response.json(await coverageDirectory({zip,state:params.get("state"),view:params.get("view"),limit:params.get("limit"),cursor:params.get("cursor")||"0"}), { headers: { "Cache-Control": "public, max-age=60" } });
  } catch(error) { return Response.json({ error: error.status?error.message:"Coverage status is temporarily unavailable." }, { status: error.status||503, headers: { "Cache-Control": "no-store" } }); }
}
