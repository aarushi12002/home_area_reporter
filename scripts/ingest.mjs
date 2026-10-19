import { config } from "dotenv";
import { closeDatabase } from "../lib/db.mjs";
import {
  INITIAL_SERVICE_AREAS,
} from "../lib/project-pipeline.mjs";
import { ingestArea } from "../lib/ingestion.mjs";

config({ path: ".env.local" });
config();

const argument = process.argv.find((value) => value.startsWith("--zips="));
const zips = argument
  ? argument.slice("--zips=".length).split(",").map((value) => value.trim())
  : INITIAL_SERVICE_AREAS;

try {
  for (const zip of zips) {
    const result = await ingestArea(zip);
    console.log(JSON.stringify(result));
  }
} finally {
  await closeDatabase();
}
