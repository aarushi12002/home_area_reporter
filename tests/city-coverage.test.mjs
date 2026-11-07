import test from "node:test";
import assert from "node:assert/strict";
import {buildCityDirectory,coverageDirectory} from "../lib/area-service.mjs";
import {SERVICE_AREAS,JURISDICTIONS,jurisdictionAreas,serviceArea} from "../lib/service-areas.mjs";
import {GET} from "../app/api/service-areas/route.js";
import {REGISTERED_SOURCES} from "../lib/source-adapters.mjs";

// Shared ZIPs and Census snapshots must never make a neighboring city look live.
test("city launch badges require an enabled publication from that municipal authority",()=>{
  const cities=[{id:"one",name:"One",state:"WA",type:"city",zips:["00001","00002","00003"],previewZip:"00003"},{id:"two",name:"Two",state:"WA",type:"city",zips:["00001"]}];
  const result=buildCityDirectory([
    {postal_code:"00001",enabled:true,generation:"g",covered_jurisdictions:["one"],baseline_vintage:"2024"},
    {postal_code:"00002",enabled:false,generation:"private",covered_jurisdictions:["one"]},
    {postal_code:"00003",enabled:true,generation:null,baseline_vintage:"2024"},
  ],cities);
  assert.equal(result[0].status,"live");assert.deepEqual(result[0].reportZips,["00001"]);
  assert.equal(result[1].status,"coming_soon");assert.equal(result[1].baselineZipCount,1);
  assert.deepEqual(result[0].baselineExamples,["00003"]);
  assert.equal(buildCityDirectory([],cities).every((city)=>city.status==="coming_soon"&&city.baselineExamples.length===0),true);
});

test("20 city inventories preserve Washington gates and leading-zero ZIPs without publishing new project coverage",()=>{
  const national=JURISDICTIONS.filter((city)=>city.state!=="WA");
  assert.equal(national.length,20);
  assert.equal(SERVICE_AREAS.filter((area)=>area.state!=="WA").length,1437);
  for(const city of national){
    assert.ok(city.zips.includes(city.previewZip));
    assert.ok(jurisdictionAreas(city.id).length>0);
    for(const zip of city.zips)assert.ok(serviceArea(zip).jurisdictionIds.includes(city.id));
  }
  assert.equal(serviceArea("02110").state,"MA");
  assert.equal(REGISTERED_SOURCES.filter((source)=>!source.jurisdictionId.startsWith("us-wa-")).map((source)=>source.id).join(","),"tx-austin-building-78701");
  assert.equal(serviceArea("98052").reviewedJurisdictionIds.includes("us-wa-redmond"),true);
});

test("city and state discovery are bounded local reads; selected states cannot leak WA totals",async(t)=>{
  t.mock.method(globalThis,"fetch",()=>assert.fail("Coverage must never download sources"));
  const tx=await coverageDirectory({state:"TX",limit:2});
  assert.equal(tx.areas.length,2);assert.equal(tx.jurisdictions.length,5);
  assert.ok(tx.areas.every((area)=>area.state==="TX"));
  assert.equal(tx.progress.jurisdictions,5);
  const cities=await coverageDirectory({view:"cities",state:"MA"});
  assert.equal(cities.cities.length,1);assert.equal(cities.cities[0].name,"Boston");
  assert.equal(cities.cities[0].status,"coming_soon");
  assert.ok(Buffer.byteLength(JSON.stringify(await coverageDirectory({view:"cities"})))<200000);
  const response=await GET(new Request("https://example.test/api/service-areas?view=cities&state=NY"));
  assert.equal(response.status,200);assert.equal((await response.json()).cities[0].name,"New York");
  assert.equal((await GET(new Request("https://example.test/api/service-areas?view=invalid"))).status,400);
  await assert.rejects(coverageDirectory({view:"cities",zip:"10001"}),/does not accept/);
});

test("Austin pilot fetches only its declared scope, maps dates/statuses and rejects publication outside 78701",async(t)=>{
  const {sourceAdapter}=await import("../lib/source-adapters.mjs");
  const {partitionSourceRecords,runIngestionBatch}=await import("../lib/ingestion.mjs");
  const source=REGISTERED_SOURCES.find((s)=>s.id==="tx-austin-building-78701"),adapter=sourceAdapter(source);
  const row={permit_number:"2026-1-BP",original_zip:"78701",original_address1:"100 Example St",description:"Construct new apartment building",status_current:"Active",issue_date:"2026-10-01",applieddate:"2026-09-01",latitude:"30.27",longitude:"-97.74",link:{url:"https://abc.austintexas.gov/permit"},housing_units:100};
  const now=new Date("2026-11-06");
  const record=adapter.normalize(row,"78701",now);
  assert.equal(record.stage,"permitted");assert.equal(record.originalStatus,"Active");
  assert.equal(record.unitsAdded,null);assert.equal(record.url,"https://abc.austintexas.gov/permit");
  for(const change of [{status_current:"Final"},{issue_date:null},{expiresdate:"2026-10-02"},{completed_date:"2026-10-02"}])assert.equal(adapter.normalize({...row,...change},"78701",now),null);
  assert.equal(partitionSourceRecords(adapter,[row]).acceptedCount,1);
  assert.equal(partitionSourceRecords(adapter,[{...row,latitude:"47.6",longitude:"-122.3"}]).quarantine.outside_jurisdiction,1);
  assert.doesNotMatch(source.select,/contractor|phone|owner|applicant|housing_units/);
  const seen=[];
  const fetched=await adapter.fetch({fetcher:async(url)=>{
    const u=new URL(url);seen.push(u);assert.equal(u.hostname,"data.austintexas.gov");assert.equal(u.searchParams.get("$where"),source.where);
    return {ok:true,json:async()=>u.searchParams.get("$select")==="count(*) as count"?[{count:"1"}]:[row]};
  }});
  assert.equal(fetched.complete,true);assert.equal(seen.length,3);
  t.mock.method(globalThis,"fetch",()=>assert.fail("Scope validation must happen before fetching"));
  const other=jurisdictionAreas(source.jurisdictionId).find((area)=>area.zip!=="78701").zip;
  await assert.rejects(runIngestionBatch({jurisdictionId:source.jurisdictionId,zips:[other]}),/pilot scope/);
});
