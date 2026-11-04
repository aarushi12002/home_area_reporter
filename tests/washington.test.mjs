import test from "node:test";
import assert from "node:assert/strict";
import {SERVICE_AREAS,JURISDICTIONS,SEATTLE_ZIPS,jurisdictionAreas,sectionAvailability} from "../lib/service-areas.mjs";
import {coverageDirectory} from "../lib/area-service.mjs";
import {insideJurisdiction,zipAtPoint,parcelLabelPoint,containsPoint} from "../lib/jurisdiction-geography.mjs";
import {fetchArcgisPermits,arcgisPermitAdapter,latestPermitRevisions,coalesceParcelRecords} from "../lib/arcgis-permits.mjs";
import {partitionSourceRecords,runIngestionBatch} from "../lib/ingestion.mjs";
import inventory from "../sources.json" with {type:"json"};

const tacoma=inventory.jurisdiction_sources.find((source)=>source.id==="wa-tacoma-accela");
test("state inventory covers every Census place/county candidate without enabling them",()=>{
  assert.equal(SERVICE_AREAS.length,642);assert.equal(JURISDICTIONS.length,320);assert.equal(SEATTLE_ZIPS.length,31);
  assert.equal(new Set(SERVICE_AREAS.map((a)=>a.zip)).size,642);
  for(const name of ["Bellevue","Redmond","Kirkland","Tacoma","Spokane","Vancouver"]){
    const item=JURISDICTIONS.find((j)=>j.name===name);assert.ok(item);assert.equal(item.wave,1);assert.ok(item.zips.length>1);
    assert.ok(jurisdictionAreas(item.id).every((area)=>area.reviewStatus==="pending_review"||SEATTLE_ZIPS.includes(area.zip)));
  }
  assert.equal(JURISDICTIONS.filter((j)=>j.type==="county_unincorporated").length,39);
  assert.equal(sectionAvailability("98052").transit,"ready");
  assert.equal(sectionAvailability("98052",{jurisdictionId:"us-wa-redmond"}).geography,"reviewed");
  assert.equal(sectionAvailability("98405").transit,"not_connected");
  assert.equal(sectionAvailability("98052").geography,"pending_review");
});

test("Washington directory is bounded, distinguishable from ready project coverage and never fetches sources",async(t)=>{
  t.mock.method(globalThis,"fetch",()=>assert.fail("Coverage discovery must not crawl sources"));
  const first=await coverageDirectory({state:"WA",limit:10});
  const next=await coverageDirectory({state:"WA",limit:10,cursor:first.nextCursor});
  assert.equal(first.areas.length,10);assert.equal(first.total,642);assert.equal(first.jurisdictions.length,320);
  assert.equal(new Set([...first.areas,...next.areas].map((a)=>a.zip)).size,20);
  assert.equal((await coverageDirectory()).areas.length,31);
  const selected=await coverageDirectory({state:"WA",zip:"98103"});
  assert.equal(selected.total,642);assert.equal(selected.areas.length,1);assert.equal(selected.nextCursor,null);
  await assert.rejects(coverageDirectory({state:"WA",zip:"02139"}),/selected state/);
  await assert.rejects(coverageDirectory({state:"OR"}),/state/);
  await assert.rejects(coverageDirectory({state:"WA",cursor:"-1"}),/cursor/);
});

test("geometry rejects other jurisdictions and Vancouver BC; postal assignment uses polygons",()=>{
  assert.equal(insideJurisdiction("us-wa-tacoma",-122.44,47.25),true);
  assert.equal(insideJurisdiction("us-wa-tacoma",-122.34,47.65),false);
  assert.equal(insideJurisdiction("us-wa-vancouver",-123.12,49.28),false);
  assert.equal(zipAtPoint(-122.44,47.25,jurisdictionAreas("us-wa-tacoma").map((a)=>a.zip)),"98402");
  assert.equal(zipAtPoint(0,0,["98405"]),null);
});

test("ArcGIS download verifies exact IDs, handles long queries through POST and rejects incomplete snapshots",async()=>{
  const source={...tacoma,select:"objectid,permit_number",latestRevisionField:null,lookbackField:null};
  const fetcher=async(url,options)=>{
    assert.equal(options.method,"POST");assert.ok(url.endsWith("/query"));
    const params=new URLSearchParams(options.body);
    if(params.get("returnIdsOnly"))return {ok:true,json:async()=>({objectIds:[2,1]})};
    const ids=params.get("objectIds").split(",").map(Number);
    return {ok:true,json:async()=>({features:ids.map((id)=>({attributes:{objectid:id,permit_number:String(id)}}))})};
  };
  assert.equal((await fetchArcgisPermits(source,{fetcher,pageSize:1})).records.length,2);
  await assert.rejects(fetchArcgisPermits(source,{fetcher,pageSize:1,maxPages:1}),/ceiling/);
  await assert.rejects(fetchArcgisPermits(source,{fetcher:async(url,options)=>({ok:true,json:async()=>new URLSearchParams(options.body).get("returnIdsOnly")?{objectIds:[1]}:{features:[]}})}),/Incomplete/);
  let count=0;
  await assert.rejects(fetchArcgisPermits(source,{fetcher:async(url,options)=>({ok:true,json:async()=>new URLSearchParams(options.body).get("returnIdsOnly")?{objectIds:++count===1?[1]:[1,2]}:{features:[{attributes:{objectid:1}}]}})}),/changed/);
});

test("latest permit revisions retire older active versions before terminal-status filtering",()=>{
  const old={objectid:1,permit_number:"ONE",current_status:"Permit Issued",pull_date:Date.parse("2026-10-01")};
  const closed={...old,objectid:2,current_status:"Canceled",pull_date:Date.parse("2026-10-02")};
  const result=latestPermitRevisions([old,closed],tacoma);
  assert.equal(result.length,1);assert.equal(result[0].current_status,"Canceled");
  assert.throws(()=>latestPermitRevisions([old,{...old,objectid:3,current_status:"Canceled"}],tacoma),/Conflicting/);
  assert.throws(()=>latestPermitRevisions([{...old,pull_date:null}],tacoma),/update date/);
});

test("unapproved reuse fails closed and non-Seattle records retain their real status/link without invented unit additions",()=>{
  assert.throws(()=>arcgisPermitAdapter({...tacoma,reuseStatus:"permission_required"}),/reuse/);
  const adapter=arcgisPermitAdapter(tacoma);
  const row={objectid:1,permit_number:"BLD-1",zip:"98405",address_line_1:"100 Example St",description:"Construct new apartment building",current_status:"Permit Issued",application_date:Date.parse("2026-10-01"),housing_units:200,link:"https://evil.example/"};
  const project=adapter.normalize(row,"98405",new Date("2026-11-03"));
  assert.equal(project.originalStatus,"Permit Issued");assert.equal(project.stage,"permitted");assert.equal(project.unitsAdded,null);
  assert.ok(project.url.startsWith(tacoma.url));
  assert.equal(adapter.normalize({...row,current_status:"Finaled"},"98405"),null);
  assert.equal(adapter.normalize({...row,current_status:"Unknown"},"98405"),null);
  assert.ok(!tacoma.select.includes("applicant_name"));
});

test("parcel label points stay inside concave shapes and outside holes",()=>{
  const rings=[[[0,0],[6,0],[6,6],[0,6],[0,0]],[[2,2],[4,2],[4,4],[2,4],[2,2]]];
  const point=parcelLabelPoint(rings);
  assert.ok(point);
  assert.equal(containsPoint({type:"Polygon",coordinates:rings},point.longitude,point.latitude),true);
  const concave=[[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4],[0,0]]];
  const other=parcelLabelPoint(concave);
  assert.equal(containsPoint({type:"Polygon",coordinates:concave},other.longitude,other.latitude),true);
  assert.equal(parcelLabelPoint([[[0,0],[null,2],[0,0]]]),null);
});

test("Redmond parcel joins preserve distinct permits and coalesce only identical permit attributes",async()=>{
  const source=inventory.jurisdiction_sources.find((s)=>s.id==="wa-redmond-permits");
  assert.ok(!source.select.includes("ProjectName"));assert.ok(!source.select.includes("EMAIL"));
  const row={ObjectID:1,PERMITNUMBER:"ONE",ProjectStatus:"Under Review",Address:"100 Example St",ZIPCODE:"98052",__latitude:47.67,__longitude:-122.12};
  const combined=coalesceParcelRecords([row,{...row,ObjectID:2,__latitude:47.671},{...row,PERMITNUMBER:"TWO"}],source);
  assert.equal(combined.length,2);assert.deepEqual(combined[0].__sourceObjectIds,[1,2]);
  assert.throws(()=>coalesceParcelRecords([row,{...row,ProjectStatus:"Completed"}],source),/Conflicting/);
  const fetched=await fetchArcgisPermits(source,{pageSize:2,fetcher:async(url,options)=>{
    const params=new URLSearchParams(options.body);
    return {ok:true,json:async()=>params.get("returnIdsOnly")?{objectIds:[1,1]}:{features:[{attributes:{...row}},{attributes:{...row,PERMITNUMBER:"TWO"}}]}};
  }});
  assert.equal(fetched.records.length,2);assert.equal(fetched.upstreamReceived,2);
});

test("new-city records need jurisdiction geometry and unknown ZIPs fail before download",async(t)=>{
  const adapter=arcgisPermitAdapter(tacoma);
  const row={permit_number:"ONE",zip:"98405"};
  assert.equal(partitionSourceRecords(adapter,[row]).quarantine.missing_geometry,1);
  assert.equal(partitionSourceRecords(adapter,[{...row,latitude:47.65,longitude:-122.34}]).quarantine.outside_jurisdiction,1);
  t.mock.method(globalThis,"fetch",()=>assert.fail("ZIP validation must precede download"));
  await assert.rejects(runIngestionBatch({jurisdictionId:"us-wa-redmond",zips:["00000"]}),/Unreviewed ZIP/);
});
