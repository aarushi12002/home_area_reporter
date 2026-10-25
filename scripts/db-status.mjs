import { config } from "dotenv";
import { closeDatabase, getDatabase } from "../lib/db.mjs";
config({ path: ".env.local", quiet: true }); config({ quiet: true });
try {
  const { sql } = getDatabase();
  const areas = await sql`SELECT postal_code, readiness, enabled, successful_refreshes, published_at FROM service_areas ORDER BY postal_code`;
  const [size] = await sql`SELECT pg_database_size(current_database())::bigint AS bytes`;
  const batches = await sql`SELECT id, status, started_at, completed_at, error FROM ingestion_batches ORDER BY started_at DESC LIMIT 5`;
  console.log(JSON.stringify({ areas, databaseBytes: Number(size.bytes), configuredStorageLimitBytes: Number(process.env.DATABASE_STORAGE_LIMIT_BYTES || 1000000000), batches }, null, 2));
} finally { await closeDatabase(); }
