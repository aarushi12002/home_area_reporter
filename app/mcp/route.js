import { createReportMcpEndpoint } from "../../lib/mcp.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const endpoint = createReportMcpEndpoint();
export const POST = endpoint.fetch;
export const GET = endpoint.fetch;
export const DELETE = endpoint.fetch;
export const OPTIONS = endpoint.fetch;
