"use client";
import {useEffect,useState} from "react";

export default function CityCoverage(){
  const [data,setData]=useState(null),[error,setError]=useState(false),[search,setSearch]=useState(""),[region,setRegion]=useState("all"),[limit,setLimit]=useState(8);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/service-areas?view=cities",{signal:controller.signal}).then(async(response)=>{
      if(!response.ok)throw new Error("Coverage unavailable");
      setData(await response.json());
    }).catch((error)=>{if(error.name!=="AbortError")setError(true);});
    return()=>controller.abort();
  },[]);
  const cities=data?.cities||[],live=cities.filter((city)=>city.status==="live");
  const upcoming=cities.filter((city)=>city.status!=="live" && (region==="all"||region==="wa"&&city.state==="WA"||region==="usa"&&city.state!=="WA") && `${city.name} ${city.state}`.toLowerCase().includes(search.trim().toLowerCase()));
  function card(city){return <article key={city.id} className="city-card">
    <div className="city-heading"><h3>{city.name}<span className="muted">, {city.state}</span></h3><span className={`tag ${city.status==="live"?"city-live":""}`}>{city.status==="live"?"Project reports live":"Coming soon"}</span></div>
    {city.status==="live"?<>
      <p>{city.projectZipCount} ZIP{city.projectZipCount===1?"":"s"} with local project reports</p>
      <div className="city-zip-links">{city.reportZips.slice(0,3).map((zip)=><a key={zip} href={`/report?zip=${zip}`}>{zip} →</a>)}</div>
      {city.reportZips.length>3&&<details><summary>All {city.projectZipCount} ZIPs</summary><div className="city-zip-links">{city.reportZips.slice(3).map((zip)=><a key={zip} href={`/report?zip=${zip}`}>{zip} →</a>)}</div></details>}
    </>:<>
      <p>Local project coverage is planned.</p>
      {city.baselineExamples.length>0?<a href={`/report?zip=${city.baselineExamples[0]}`}>View Census snapshot · {city.baselineExamples[0]} →</a>:<p className="muted">Check back for available reports.</p>}
    </>}
  </article>;}
  return <section className="city-coverage" aria-labelledby="cities-title">
    <h2 id="cities-title">Find your city.</h2>
    <p className="muted">Local project reports in selected ZIPs today. More Washington cities and major US cities are next.</p>
    {!data&&!error&&<p role="status">Checking available cities…</p>}
    {error&&<p role="status">City coverage is temporarily unavailable. You can still search a ZIP above or <a href="/coverage">check Washington coverage</a>.</p>}
    {data&&<>
      <h3>Project reports available</h3>
      {live.length?<div className="grid">{live.map(card)}</div>:<p>Published project coverage is being checked. Search a ZIP to see its current report.</p>}
      <h3 className="upcoming-heading">Local project reports coming soon</h3>
      <p className="muted">Census snapshots are available now where linked below. They show historical housing and community data; local building plans are still coming. No release dates announced.</p>
      <div className="city-filters">
        <div><label htmlFor="city-search">Find a city</label><input id="city-search" type="search" placeholder="Austin, Tacoma, New York…" value={search} onChange={(event)=>{setSearch(event.target.value);setLimit(8);}}/></div>
        <div><label htmlFor="city-region">Explore</label><select id="city-region" value={region} onChange={(event)=>{setRegion(event.target.value);setLimit(8);}}><option value="all">Washington + major US cities</option><option value="wa">Washington</option><option value="usa">Major US cities</option></select></div>
      </div>
      <p className="muted" role="status">{upcoming.length} {upcoming.length===1?"city":"cities"} in the rollout list</p>
      <div className="grid">{upcoming.slice(0,limit).map(card)}</div>
      {!upcoming.length&&<p>No matching city in this rollout list. Try the ZIP search above for a nationwide Census snapshot.</p>}
      {limit<upcoming.length&&<button className="secondary" onClick={()=>setLimit(limit+12)}>Show more cities</button>}
      <p className="muted">A live city badge covers only its listed ZIPs and municipal records. Shared ZIPs may include other cities. <a href="/coverage">Washington source and release progress →</a></p>
    </>}
  </section>;
}
