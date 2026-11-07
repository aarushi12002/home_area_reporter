import inventory from "../sources.json" with {type:"json"};
import {appendFileSync} from "node:fs";
const region=process.env.REQUESTED_REGION||"wa";
if(!["wa","seattle"].includes(region))throw new Error("Unregistered region");
let ids=region==="seattle" ? ["us-wa-seattle"] : [...new Set(["us-wa-seattle",...(inventory.jurisdiction_sources||[]).filter((source)=>source.enabled&&source.reuseStatus==="approved").map((source)=>source.jurisdictionId)])];
const selected=process.env.REQUESTED_JURISDICTION;
if(region==="wa" && process.env.REQUESTED_ZIPS && !selected)throw new Error("Select a jurisdiction when requesting ZIPs in the Washington region");
if(selected){if(!ids.includes(selected))throw new Error("Jurisdiction has no approved enabled source");ids=[selected];}
const matrix=JSON.stringify({jurisdiction:ids});
if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`matrix=${matrix}\n`);
else console.log(matrix);
