import { normalizeSourceRow, normalizeAddress, usableDate } from "./project-pipeline.mjs";
import { jurisdictionAreas, sourcePostalCode } from "./service-areas.mjs";
import { zipAtPoint, parcelLabelPoint } from "./jurisdiction-geography.mjs";

export async function fetchArcgisPermits(source,{fetcher=fetch,pageSize=500,maxPages=100,deadlineMs=20000,now=new Date()}={}) {
  const cutoff=new Date(now);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-(source.lookbackYears||3));
  const where=source.lookbackField?`(${source.where||"1=1"}) AND ${source.lookbackField} >= DATE '${cutoff.toISOString().slice(0,10)}'`:source.where||"1=1";
  async function request(params){
    const response=await fetcher(`${source.url}/query`,{method:"POST",body:new URLSearchParams({f:"json",where,...params}),headers:{"Content-Type":"application/x-www-form-urlencoded"},cache:"no-store",signal:AbortSignal.timeout(deadlineMs)});
    if(!response.ok)throw new Error(`Source returned HTTP ${response.status}`);
    const body=await response.json();
    if(body.error)throw new Error("ArcGIS source rejected the query");
    return body;
  }
  const initial=await request({returnIdsOnly:"true"});
  if(!Array.isArray(initial.objectIds))throw new Error("ArcGIS source did not return a complete ID set");
  const snapshotIds=[...initial.objectIds].sort((a,b)=>a-b);
  if (!snapshotIds.every(Number.isSafeInteger)) throw new Error("Invalid source IDs");
  const multiplicities=new Map();
  for (const id of snapshotIds) multiplicities.set(id,(multiplicities.get(id)||0)+1);
  if (!source.joinedObjectIds && multiplicities.size!==snapshotIds.length) throw new Error("Duplicate source IDs");
  const pages=[];
  let page=[], expected=0;
  for (const [id,count] of multiplicities) {
    if(count>pageSize) throw new Error("A joined parcel exceeds the page size; complete retrieval requires review");
    if(expected+count>pageSize){pages.push(page);page=[];expected=0;}
    page.push(id);expected+=count;
  }
  if(page.length)pages.push(page);
  if(pages.length>maxPages)throw new Error("Incomplete source pagination: page ceiling reached");
  const records=[];
  for(const selected of pages){
    const expectedCount=selected.reduce((sum,id)=>sum+multiplicities.get(id),0);
    const body=await request({objectIds:selected.join(","),outFields:source.select,returnGeometry:"true",outSR:"4326",resultRecordCount:String(pageSize)});
    if(!Array.isArray(body.features)||body.exceededTransferLimit||body.features.length!==expectedCount)throw new Error("Incomplete ArcGIS page");
    const returned=body.features.map((feature)=>feature.attributes?.[source.objectIdField]).sort((a,b)=>a-b);
    const expectedIds=selected.flatMap((id)=>Array(multiplicities.get(id)).fill(id));
    if(JSON.stringify(returned)!==JSON.stringify(expectedIds))throw new Error("ArcGIS page ID mismatch");
    records.push(...body.features.map((feature)=>{
      const label=source.geometryMethod === "parcel_label_point" ? parcelLabelPoint(feature.geometry?.rings) : null;
      return {...feature.attributes,__latitude:label?.latitude??feature.geometry?.y??null,__longitude:label?.longitude??feature.geometry?.x??null,
        ...(source.geometryMethod?{__geometryMethod:source.geometryMethod}:{})};
    }));
  }
  const final=await request({returnIdsOnly:"true"});
  if(!Array.isArray(final.objectIds)||JSON.stringify([...final.objectIds].sort((a,b)=>a-b))!==JSON.stringify(snapshotIds))throw new Error("Source changed during pagination; restart complete download");
  const reconciled=source.latestRevisionField?latestPermitRevisions(records,source):source.parcelDuplicates?coalesceParcelRecords(records,source):records;
  return {records:reconciled,complete:true,upstreamReceived:records.length,superseded:records.length-reconciled.length};
}

// Parcel joins may repeat one permit. Coalesce only identical public attributes;
// a status or scope conflict is not resolved by guessing which parcel is newer.
export function coalesceParcelRecords(records,source) {
  const grouped=new Map();
  const comparable=(row)=>JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key])=>key!==source.objectIdField&&!key.startsWith("__")).sort(([a],[b])=>a.localeCompare(b))));
  for (const row of records) {
    const id=String(row[source.fields.id]||"").trim().toUpperCase();
    if (!id) throw new Error("Parcel source has a missing permit ID");
    const prior=grouped.get(id);
    if (prior && comparable(prior)!==comparable(row)) throw new Error("Conflicting parcel records for one permit; source review required");
    if (!prior) grouped.set(id,{...row,__sourceObjectIds:[row[source.objectIdField]]});
    else {
      if (!prior.__sourceObjectIds.includes(row[source.objectIdField])) prior.__sourceObjectIds.push(row[source.objectIdField]);
      if (prior.__latitude===null && row.__latitude!==null) {prior.__latitude=row.__latitude;prior.__longitude=row.__longitude;}
    }
  }
  return [...grouped.values()];
}

export function latestPermitRevisions(records,source){
  const latest=new Map();
  for(const row of records){
    const key=String(row[source.fields.id]||"").trim().toUpperCase();
    if(!key)throw new Error("Revision source has a missing permit ID");
    const timestamp=Date.parse(usableDate(row[source.latestRevisionField])||"");
    if(!Number.isFinite(timestamp))throw new Error("Revision source has no usable update date");
    const prior=latest.get(key);
    if(!prior||timestamp>prior.timestamp)latest.set(key,{row,timestamp});
    else if(timestamp===prior.timestamp){
      const comparable=(value)=>JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key])=>key!==source.objectIdField).sort(([a],[b])=>a.localeCompare(b))));
      if(comparable(prior.row)!==comparable(row))throw new Error("Conflicting permit revisions have the same update time");
    }
  }
  return [...latest.values()].map(({row})=>row);
}

export function arcgisPermitAdapter(source){
  if(source.reuseStatus!=="approved")throw new Error(`Source reuse has not been approved: ${source.id}`);
  const fields=source.fields;
  const coordinates=(row)=>({latitude:row[fields.latitude]??row.__latitude??null,longitude:row[fields.longitude]??row.__longitude??null});
  const postalCode=(row)=>sourcePostalCode(String(row[fields.zip]||""))||zipAtPoint(Number(coordinates(row).longitude),Number(coordinates(row).latitude),jurisdictionAreas(source.jurisdictionId).map((a)=>a.zip));
  const externalId=(row)=>String(row[fields.id]||"").trim().toUpperCase()||null;
  return {source,coordinates,postalCode,externalId,
    evidence:(row,now)=>({normalizedAddress:normalizeAddress(row[fields.address])||null,sourceStatus:row[fields.status]||null,sourceEventAt:usableDate(row[fields.issued]||row[fields.applied],now),sourceUpdatedAt:usableDate(row[fields.updated],now)}),
    normalize:(row,zip,now)=>{
      const originalStatus=String(row[fields.status]||"").trim();
      let stage=source.statusMap[originalStatus];
      if(stage==="issued_if_dated")stage=usableDate(row[fields.issued],now)?"permitted":null;
      if(!stage || !["permitted","in_review","early_proposal"].includes(stage))return null;
      const common={permitnum:externalId(row),originalzip:postalCode(row),originaladdress1:row[fields.address],description:row[fields.description],permittypedesc:row[fields.type],
        statuscurrent:{permitted:"Issued",in_review:"Reviews In Process",early_proposal:"Initiated"}[stage],issueddate:row[fields.issued],applieddate:row[fields.applied],...coordinates(row)};
      const normalized=normalizeSourceRow(source,common,zip,now);
      if(!normalized)return null;
      let url=`${source.url}/query?${new URLSearchParams({f:"json",where:`${fields.id}='${externalId(row).replaceAll("'","''")}'`,objectIds:(row.__sourceObjectIds||[row[source.objectIdField]]).join(","),outFields:source.select,returnGeometry:"false"})}`;
      try{const link=new URL(row[fields.link]);if(link.protocol==="https:"&&source.evidenceHosts.includes(link.hostname))url=link.href;}catch{}
      return {...normalized,originalStatus,stage,url,raw:row,references:[]};
    },
    fetch:(options)=>fetchArcgisPermits(source,options),
  };
}
