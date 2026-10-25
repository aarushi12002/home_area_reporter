import { readdir, readFile } from "node:fs/promises";
import { config } from "dotenv";
import { closeDatabase, getDatabase } from "../lib/db.mjs";
import { seedServiceAreas } from "../lib/ingestion.mjs";

config({ path: ".env.local" });
config();

const { sql } = getDatabase();
try {
  await sql`
    CREATE TABLE IF NOT EXISTS app_schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  const applied = new Set(
    (await sql`SELECT name FROM app_schema_migrations`).map((row) => row.name),
  );
  const migrations = (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    if (applied.has(name)) continue;
    const statement = await readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
    await sql.begin(async (transaction) => {
      await transaction.unsafe(statement);
      await transaction`
        INSERT INTO app_schema_migrations (name) VALUES (${name})
      `;
    });
    console.log(`Applied ${name}`);
  }
  console.log("Database schema is current.");
  await seedServiceAreas(sql);
} finally {
  await closeDatabase();
}
