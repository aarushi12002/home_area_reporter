import {normalizeSourceRow,normalizeAddress,usableDate} from "./project-pipeline.mjs";
import {jurisdictionAreas,sourcePostalCode} from "./service-areas.mjs";
import {zipAtPoint} from "./jurisdiction-geography.mjs";

export function mappedPermitAdapter(source,{fetchRecords,evidenceUrl}){
  if(source.reuseStatus!=="approved")throw new Error(`Source reuse has not been approved: ${source.id}`);
  const fields=source.fields;
  const number=(value)=>value===null||value===undefined||value===""?null:Number(value);
  const coordinates=(row)=>({latitude:number(row[fields.latitude]??row.__latitude),longitude:number(row[fields.longitude]??row.__longitude)});
  const postalCode=(row)=>sourcePostalCode(String(row[fields.zip]||""))||zipAtPoint(Number(coordinates(row).longitude),Number(coordinates(row).latitude),jurisdictionAreas(source.jurisdictionId).map((a)=>a.zip));
  const externalId=(row)=>String(row[fields.id]||"").trim().toUpperCase()||null;
  return {source,coordinates,postalCode,externalId,
    evidence:(row,now)=>({normalizedAddress:normalizeAddress(row[fields.address])||null,sourceStatus:row[fields.status]||null,sourceEventAt:usableDate(row[fields.issued]||row[fields.applied],now),sourceUpdatedAt:usableDate(row[fields.updated],now)}),
    normalize:(row,zip,now)=>{
      if(fields.completed && usableDate(row[fields.completed],now))return null;
      const expiry=fields.expires && usableDate(row[fields.expires]);
      if(expiry && Date.parse(expiry)<new Date(now||Date.now()).getTime())return null;
      const originalStatus=String(row[fields.status]||"").trim();
      let stage=source.statusMap[originalStatus];
      if(stage==="issued_if_dated")stage=usableDate(row[fields.issued],now)?"permitted":null;
      if(!stage || !["permitted","in_review","early_proposal"].includes(stage))return null;
      const common={permitnum:externalId(row),originalzip:postalCode(row),originaladdress1:row[fields.address],description:row[fields.description],permittypedesc:row[fields.type],
        statuscurrent:{permitted:"Issued",in_review:"Reviews In Process",early_proposal:"Initiated"}[stage],issueddate:row[fields.issued],applieddate:row[fields.applied],...coordinates(row)};
      const normalized=normalizeSourceRow(source,common,zip,now);
      if(!normalized)return null;
      let url=evidenceUrl(row,externalId(row));
      try{const link=new URL(row[fields.link]?.url||row[fields.link]);if(link.protocol==="https:"&&source.evidenceHosts.includes(link.hostname))url=link.href;}catch{}
      return {...normalized,originalStatus,stage,url,raw:row,references:[]};
    },
    fetch:fetchRecords,
  };
}
