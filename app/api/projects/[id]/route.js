import { hasDatabaseConfig } from "../../../../lib/db.mjs";
import { projectDetail } from "../../../../lib/project-repository.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, context) {
  if (!hasDatabaseConfig())
    return Response.json(
      { error: "Persistent project evidence is not configured." },
      { status: 503 },
    );
  try {
    const { id } = await context.params;
    const project = await projectDetail(id, new URL(request.url).searchParams.get("generation"));
    return project
      ? Response.json(project, { headers: { "Cache-Control": "private, no-store" } })
      : Response.json({ error: "Project not found." }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error.status ? error.message : "Project lookup failed.", code: error.code || "UNAVAILABLE" }, { status: error.status || 503 });
  }
}
