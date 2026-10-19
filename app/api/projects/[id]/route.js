import { hasDatabaseConfig } from "../../../../lib/db.mjs";
import { projectDetail } from "../../../../lib/project-repository.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, context) {
  if (!hasDatabaseConfig())
    return Response.json(
      { error: "Persistent project evidence is not configured." },
      { status: 503 },
    );
  try {
    const { id } = await context.params;
    const project = await projectDetail(id);
    return project
      ? Response.json(project)
      : Response.json({ error: "Project not found." }, { status: 404 });
  } catch {
    return Response.json({ error: "Project lookup failed." }, { status: 503 });
  }
}
