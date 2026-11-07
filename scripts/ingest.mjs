import { config } from "dotenv";
import { closeDatabase } from "../lib/db.mjs";
import { jurisdictionAreas } from "../lib/service-areas.mjs";
import { REGISTERED_SOURCES } from "../lib/source-adapters.mjs";
import { runIngestionBatch } from "../lib/ingestion.mjs";
config({ path: ".env.local", quiet: true }); config({ quiet: true });
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
try {
  const region = option("region") || "seattle";
  if (!["seattle","wa"].includes(region)) throw new Error("This region is not registered.");
  const selected=option("jurisdiction");
  if(region==="wa" && option("zips") && !selected)throw new Error("Select a jurisdiction when requesting ZIPs in the Washington region");
  const ids=selected ? [selected] : region==="seattle" ? ["us-wa-seattle"] : [...new Set(REGISTERED_SOURCES.map((source)=>source.jurisdictionId))];
  if(region==="seattle" && ids.some((id)=>id!=="us-wa-seattle"))throw new Error("Jurisdiction does not match region");
  const results=[];
  for(const jurisdictionId of ids){
    const zips=option("zips")?option("zips").split(",").map((zip)=>zip.trim()):jurisdictionAreas(jurisdictionId).map((area)=>area.zip);
    results.push(await runIngestionBatch({jurisdictionId,zips}));
  }
  console.log(JSON.stringify(results.length===1?results[0]:results,null,2));
} finally { await closeDatabase(); }
