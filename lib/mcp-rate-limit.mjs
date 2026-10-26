import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getDatabase } from "./db.mjs";

export function clientBucket(request, { secret = process.env.MCP_RATE_LIMIT_SECRET, vercel = process.env.VERCEL === "1", production = process.env.NODE_ENV === "production" } = {}) {
  if (!secret || secret.length < 32) throw new Error("MCP rate limiting is not configured");
  if (production && !vercel) throw new Error("MCP requires the configured trusted Vercel proxy");
  const address = vercel ? request.headers.get("x-forwarded-for")?.trim() : "127.0.0.1";
  if (!address || !isIP(address)) throw new Error("Trusted client address is unavailable");
  return createHmac("sha256", secret).update(address).digest("hex");
}

export async function consumeMcpQuota(bucket, { sql = getDatabase().sql, perClient = 60, global = 300 } = {}) {
  return sql.begin(async (transaction) => {
    await transaction`DELETE FROM mcp_rate_limits WHERE window_start <= date_trunc('minute', now()) - interval '1 hour'`;
    const rows = [];
    for (const key of ["global", `client:${bucket}`]) {
      const [row] = await transaction`INSERT INTO mcp_rate_limits (bucket, window_start, requests)
        VALUES (${key}, date_trunc('minute', now()), 1)
        ON CONFLICT (bucket, window_start) DO UPDATE SET requests = LEAST(mcp_rate_limits.requests + 1, 1000000)
        RETURNING requests, EXTRACT(EPOCH FROM window_start + interval '1 minute' - now()) AS retry_after`;
      rows.push(row);
    }
    return { allowed: rows[0].requests <= global && rows[1].requests <= perClient, retryAfter: Math.max(1, Math.ceil(Number(rows[0].retry_after))) };
  });
}
