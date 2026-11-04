import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readdir,readFile} from "node:fs/promises";
import postgres from "postgres";
import {getDatabase,closeDatabase} from "../lib/db.mjs";
import {runIngestionBatch,publishArea,seedServiceAreas} from "../lib/ingestion.mjs";
import {arcgisPermitAdapter} from "../lib/arcgis-permits.mjs";
import {databaseAreaSummary,paginatedProjects,projectDetail} from "../lib/project-repository.mjs";
import {areaSummary} from "../lib/area-service.mjs";
import inventory from "../sources.json" with {type:"json"};

test("shared-ZIP partitions cannot erase neighboring projects, leak unreleased data or lose concurrent updates",{skip:!process.env.TEST_DATABASE_URL},async(t)=>{
  const name=`wa_test_${randomUUID().replaceAll("-","")}`,admin=postgres(process.env.TEST_DATABASE_URL,{max:1});
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url=new URL(process.env.TEST_DATABASE_URL);url.pathname=`/${name}`;process.env.DATABASE_URL=url.href;
  const {sql}=getDatabase();
  t.after(async()=>{await closeDatabase();delete process.env.DATABASE_URL;await admin.unsafe(`DROP DATABASE ${name}`);await admin.end();});
  for(const file of (await readdir(new URL("../drizzle/",import.meta.url))).filter((f)=>f.endsWith(".sql")).sort())await sql.unsafe(await readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
  await seedServiceAreas(sql);
  let version=1;
  const now=new Date("2026-11-03T18:00:00Z");
  const fetcher=async(request)=>{
    const u=new URL(request),empty=u.pathname.includes("ht3q-kdvx");
    return {ok:true,json:async()=>u.searchParams.get("$select")==="count(*) as count"?[{count:empty?"0":"1"}]:empty?[]:[{permitnum:"SEA-1",originalzip:"98133",originaladdress1:"100 Example St",description:`Construct new apartment building version ${version}`,statuscurrent:"Issued",applieddate:"2026-10-01",housingunitsadded:"20",latitude:"47.72",longitude:"-122.34"}]};
  };
  const run=()=>runIngestionBatch({sql,zips:["98133"],now,fetcher,maxAttempts:1});
  await run();await run();
  const before=await databaseAreaSummary("98133");
  const source={...inventory.jurisdiction_sources[0],id:"test-shoreline",jurisdictionId:"us-wa-shoreline"};
  const adapter=arcgisPermitAdapter(source);
  await sql`INSERT INTO sources (id,name,jurisdiction,dataset_id,jurisdiction_id,adapter) VALUES (${source.id},'Test source','Shoreline',${source.id},${source.jurisdictionId},'arcgis-permits')`;
  let fail=false;
  async function publish(releaseAllowed){
    const id=randomUUID();
    await sql`INSERT INTO ingestion_batches(id,jurisdiction_id,status,lease_until) VALUES (${id},${source.jurisdictionId},'running',now()+interval '10 minutes')`;
    const row={objectid:1,permit_number:"SHORE-1",zip:"98133",address_line_1:"100 Example St",description:`Construct new apartment building${fail?" FAIL":""}`,current_status:"Permit Issued",application_date:Date.parse("2026-10-01"),latitude:47.76,longitude:-122.34};
    await sql`INSERT INTO staged_source_records(batch_id,source_id,external_id,postal_code,raw_payload) VALUES (${id},${source.id},'SHORE-1','98133',${JSON.stringify(row)}::jsonb)`;
    try{return await publishArea(sql,"98133",[adapter],id,now,{releaseAllowed});}
    finally{await sql`UPDATE ingestion_batches SET status='succeeded',completed_at=now() WHERE id=${id}`;}
  }
  await publish(false);await publish(false);
  assert.equal((await databaseAreaSummary("98133")).generation,before.generation);
  assert.equal((await paginatedProjects("98133")).items.length,1);
  assert.equal((await paginatedProjects("98133",{includeHidden:true})).total,1);
  const [hidden]=await sql`SELECT id FROM projects WHERE jurisdiction_id=${source.jurisdictionId}`;
  assert.equal(await projectDetail(hidden.id),null);
  version=2;await run();
  assert.equal((await paginatedProjects("98133")).items.length,1);
  // Simulate an independently reviewed partition; this fixture tests isolation,
  // not Shoreline source/context approval. Ordinary ingestion cannot set this.
  await sql`UPDATE jurisdiction_report_partitions SET enabled=true WHERE jurisdiction_id=${source.jurisdictionId}`;
  await publish(true);
  const combined=await databaseAreaSummary("98133");
  assert.equal(combined.totalCurrentProjects,2);
  assert.deepEqual(combined.coveredJurisdictions.sort(),["us-wa-seattle","us-wa-shoreline"]);
  const cursor=(await paginatedProjects("98133",{limit:1})).nextCursor;
  await Promise.all([run(),publish(true)]);
  assert.equal((await databaseAreaSummary("98133")).totalCurrentProjects,2);
  assert.equal((await paginatedProjects("98133")).items.length,2);
  await assert.rejects(paginatedProjects("98133",{cursor}),(e)=>e.code==="REPORT_UPDATED");
  const stable=(await databaseAreaSummary("98133")).generation;
  await sql.unsafe("CREATE FUNCTION reject_wa_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.summary LIKE '%FAIL' THEN RAISE EXCEPTION 'Injected WA failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_wa_test BEFORE INSERT ON projects FOR EACH ROW EXECUTE FUNCTION reject_wa_test();");
  fail=true;await assert.rejects(publish(true),/Injected WA failure/);
  assert.equal((await databaseAreaSummary("98133")).generation,stable);
  assert.equal((await paginatedProjects("98133")).items.length,2);
  await sql`INSERT INTO area_baselines(postal_code,vintage,metrics,provenance,retrieved_at) VALUES ('98052','2024','{}','{}',now())`;
  assert.equal((await areaSummary("98052")).reportType,"baseline");
  for (let i=0;i<2;i++) await runIngestionBatch({sql,jurisdictionId:"us-wa-redmond",now,maxAttempts:1,fetcher:async()=>({ok:true,json:async()=>({objectIds:[]})})});
  const city=await sql`SELECT enabled,successful_refreshes FROM jurisdiction_report_partitions WHERE jurisdiction_id='us-wa-redmond'`;
  assert.equal(city.length,7);assert.ok(city.every((partition)=>!partition.enabled && partition.successful_refreshes===2));
  assert.equal(await databaseAreaSummary("98052"),null);
  assert.equal((await areaSummary("98052")).reportType,"baseline");
});

test("concurrent migration runners preserve existing Seattle publications and apply the partition backfill once",{skip:!process.env.TEST_DATABASE_URL},async(t)=>{
  const {promisify}=await import('node:util');
  const {execFile}=await import('node:child_process');
  const execute=promisify(execFile);
  const name=`wa_migration_${randomUUID().replaceAll('-','')}`, admin=postgres(process.env.TEST_DATABASE_URL,{max:1});
  await admin.unsafe(`CREATE DATABASE ${name}`);
  const url=new URL(process.env.TEST_DATABASE_URL);url.pathname=`/${name}`;
  const sql=postgres(url.href,{max:1});
  t.after(async()=>{await sql.end();await admin.unsafe(`DROP DATABASE ${name}`);await admin.end();});
  const files=(await readdir(new URL('../drizzle/',import.meta.url))).filter((file)=>file.endsWith('.sql') && file<'0004').sort();
  await sql`CREATE TABLE app_schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`;
  for (const file of files){await sql.unsafe(await readFile(new URL(`../drizzle/${file}`,import.meta.url),'utf8'));await sql`INSERT INTO app_schema_migrations(name) VALUES (${file})`;}
  await sql`UPDATE service_areas SET enabled=true,readiness='ready',successful_refreshes=4,generation='preserve-me',published_at=now() WHERE postal_code='98103'`;
  await sql`INSERT INTO zip_report_snapshots(postal_code,generation,summary,coverage,published_at) VALUES ('98103','preserve-me','{"totalCurrentProjects":0}','[]',now())`;
  await Promise.all([1,2].map(()=>execute(process.execPath,['scripts/db-migrate.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,DATABASE_URL:url.href},timeout:60000})));
  const [partition]=await sql`SELECT * FROM jurisdiction_report_partitions WHERE postal_code='98103'`;
  assert.equal(partition.generation,'preserve-me');assert.equal(partition.successful_refreshes,4);assert.equal(partition.enabled,true);
  assert.equal((await sql`SELECT generation FROM zip_report_snapshots WHERE postal_code='98103'`)[0].generation,'preserve-me');
  assert.equal((await sql`SELECT count(*)::integer AS count FROM app_schema_migrations WHERE name='0004_jurisdiction_partitions.sql'`)[0].count,1);
  assert.equal((await sql`SELECT enabled FROM service_areas WHERE postal_code='98052'`)[0].enabled,false);
});
