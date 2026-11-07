import { config } from "dotenv";
import { closeDatabase, getDatabase } from "../lib/db.mjs";
config({ path: ".env.local", quiet: true }); config({ quiet: true });
try {
  const { sql } = getDatabase();
  const areas = await sql`SELECT postal_code, readiness, enabled, successful_refreshes, published_at FROM service_areas WHERE enabled=true OR successful_refreshes>0 ORDER BY postal_code`;
  const [size] = await sql`SELECT pg_database_size(current_database())::bigint AS bytes`;
  const batches = await sql`SELECT id, jurisdiction_id, status, started_at, completed_at, error FROM ingestion_batches ORDER BY started_at DESC LIMIT 5`;
  const [inventory] = await sql`SELECT count(*)::integer AS total_areas FROM service_areas`;
  const jurisdictions = await sql`SELECT j.id,j.name,j.source_status,count(part.postal_code)::integer AS backfilled_zips,
    count(part.postal_code) FILTER (WHERE part.enabled)::integer AS published_zips,min(part.published_at) AS oldest_partition
    FROM jurisdictions j LEFT JOIN jurisdiction_report_partitions part ON part.jurisdiction_id=j.id
    WHERE EXISTS (SELECT 1 FROM sources s WHERE s.jurisdiction_id=j.id AND s.enabled=true)
    GROUP BY j.id ORDER BY j.id`;
  console.log(JSON.stringify({ inventory, jurisdictions, areas, databaseBytes: Number(size.bytes), configuredStorageLimitBytes: Number(process.env.DATABASE_STORAGE_LIMIT_BYTES || 1000000000), batches }, null, 2));
} finally { await closeDatabase(); }
