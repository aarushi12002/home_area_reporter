import { config } from "dotenv";
import { closeDatabase, getDatabase } from "../lib/db.mjs";
import { fetchBaseline } from "../lib/baseline.mjs";
config({ path: ".env.local", quiet: true }); config({ quiet: true });
try {
  const vintage = process.argv.find((arg) => arg.startsWith("--vintage="))?.slice(10) || "2024";
  const result = await fetchBaseline({ apiKey: process.env.CENSUS_API_KEY, vintage });
  const { sql } = getDatabase();
  const [usage] = await sql`SELECT pg_database_size(current_database())::bigint AS bytes`;
  const limit = Number(process.env.DATABASE_STORAGE_LIMIT_BYTES || 1000000000);
  if (!Number.isFinite(limit) || limit <= 0 || Number(usage.bytes) >= limit * 0.8) throw new Error("Storage capacity gate reached");
  const now = new Date().toISOString();
  let imported = 0;
  await sql.begin(async (transaction) => {
    for (let i = 0; i < result.records.length; i += 250) {
      const rows = result.records.slice(i, i + 250).map((record) => ({ postal_code: record.zip, geography_type: "zcta", vintage: result.vintage, metrics: JSON.stringify(record.metrics), provenance: JSON.stringify(result.provenance), retrieved_at: now }));
      const updated = await transaction`INSERT INTO area_baselines ${transaction(rows, "postal_code", "geography_type", "vintage", "metrics", "provenance", "retrieved_at")}
        ON CONFLICT (postal_code) DO UPDATE SET vintage = EXCLUDED.vintage, metrics = EXCLUDED.metrics, provenance = EXCLUDED.provenance, retrieved_at = EXCLUDED.retrieved_at
        WHERE area_baselines.vintage <= EXCLUDED.vintage RETURNING postal_code`;
      imported += updated.length;
    }
    const [after] = await transaction`SELECT pg_database_size(current_database())::bigint AS bytes`;
    if (Number(after.bytes) >= limit * 0.8) throw new Error("Import exceeds storage gate; transaction rolled back");
  });
  console.log(JSON.stringify({ imported, received: result.records.length, vintage: result.vintage, geographyType: "zcta", localPermitCoverage: "unchanged" }));
} finally { await closeDatabase(); }
