"use client";
import {useEffect,useState} from "react";
import CityCoverage from "../../components/CityCoverage";

export default function Coverage(){
  const [data,setData]=useState(null),[error,setError]=useState(""),[search,setSearch]=useState(""),[visibleCount,setVisibleCount]=useState(20);
  useEffect(()=>{const controller=new AbortController();fetch("/api/service-areas?state=WA&limit=20",{signal:controller.signal}).then(async(response)=>{
    if(!response.ok)throw new Error("Coverage status is temporarily unavailable.");setData(await response.json());
  }).catch((error)=>{if(error.name!=="AbortError")setError(error.message);});return()=>controller.abort();},[]);
  const jurisdictions=data?.jurisdictions.filter((item)=>item.name.toLowerCase().includes(search.toLowerCase()))||[];
  return <main>
    <a href="/">← Check a ZIP</a>
    <CityCoverage />
    <section className="hero">
      <p className="eyebrow">Washington coverage</p><h1>Growing across Washington.</h1>
      <p className="intro">Bellevue, Redmond, Kirkland and every other Washington city and county area are in the expansion register. A place on this list does not mean its project report is ready.</p>
      <p>Census snapshots remain available where imported. Full project reports require verified sources, local highlights, medical care, transit context and two successful refreshes.</p>
      {error&&<p role="alert">{error}</p>}
      {!data&&!error&&<p role="status">Checking coverage…</p>}
      {data&&<p>{data.progress.projectReports} published project-report ZIPs · {data.progress.totalZips} ZIP-area intersection candidates · {data.progress.jurisdictions} city/county review entries</p>}
      <p className="muted">Census ZIP areas approximate postal geography. Shared boundaries and unincorporated, tribal or federal permitting authority require review before activation. This register is not a claim of completed statewide coverage.</p>
    </section>
    {data&&<section>
      <label htmlFor="coverage-search">Find a city or county area</label>
      <input id="coverage-search" value={search} onChange={(event)=>{setSearch(event.target.value);setVisibleCount(20);}} placeholder="Bellevue, Redmond, Spokane…"/>
      <p>{jurisdictions.length} matching review entries</p>
      <div className="grid">{jurisdictions.slice(0,visibleCount).map((item)=><article key={item.id}>
        <h2>{item.name}</h2><span className="tag">{item.readyZips===item.totalZips&&item.totalZips?"Reports published":({permission_required:"Permission needed",context_review:"Preparing local details",approved:"Preparing local details",connected:"Reports available",source_review:"Checking data sources",needs_source_review:"Finding data sources"}[item.sourceStatus]||"Under review")}</span>
        <p>{item.readyZips} of {item.totalZips} candidate ZIP areas have published project coverage from this jurisdiction.</p>
        <p>{item.nextAction}</p>
      </article>)}</div>
      {jurisdictions.length>visibleCount&&<button onClick={()=>setVisibleCount((count)=>count+20)}>Show more places</button>}
    </section>}
  </main>;
}
