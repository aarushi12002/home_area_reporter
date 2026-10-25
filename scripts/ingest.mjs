import { config } from "dotenv";
import { closeDatabase } from "../lib/db.mjs";
import { SEATTLE_ZIPS } from "../lib/service-areas.mjs";
import { runIngestionBatch } from "../lib/ingestion.mjs";
config({ path: ".env.local", quiet: true }); config({ quiet: true });
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
try {
  const region = option("region") || "seattle";
  if (region !== "seattle") throw new Error("This jurisdiction has no verified connector yet.");
  const zips = option("zips") ? option("zips").split(",").map((zip) => zip.trim()) : SEATTLE_ZIPS;
  console.log(JSON.stringify(await runIngestionBatch({ jurisdictionId: "us-wa-seattle", zips }), null, 2));
} finally { await closeDatabase(); }
