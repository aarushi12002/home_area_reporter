"use client";
import { useEffect, useState } from "react";

export default function Soundscore({ location }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setResult(null); setLoading(false); }, [location]);

  async function checkScore() {
    setLoading(true);
    try {
      const response = await fetch(`/api/soundscore?${new URLSearchParams({ lat: location.latitude, lng: location.longitude })}`, { cache: "no-store" });
      const body = await response.json();
      setResult({ ...body, location });
    } catch { setResult({ status: "unavailable", location }); }
    finally { setLoading(false); }
  }
  const current = result?.location === location ? result : null;
  return (
    <section className="soundscore-section" aria-labelledby="soundscore-title">
      <div className="section-heading">
        <h2 id="soundscore-title">Sound & surroundings</h2><span className="tag">Free report</span>
      </div>
      <div className="soundscore-content">
        <div>
          <h3>Soundscore™</h3>
          <p className="muted">{location ? "Check noise at the selected map location." : "Choose “Pick noise location” on the map to check a specific spot."}</p>
          <a href="https://howloud.com/" target="_blank" rel="noreferrer">HowLoud ↗</a>
        </div>
        {current?.status === "ready" ? (
          <div className="soundscore-result" role="status">
            <strong>{current.score}<small>/ 100</small></strong><span>{current.label}</span>
            <p>{[["Traffic", current.traffic], ["Local activity", current.local], ["Airports", current.airports]].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" · ")}</p>
          </div>
        ) : (
          <div className="soundscore-action">
            <button className="secondary" disabled={!location || loading} onClick={checkScore}>{loading ? "Checking noise…" : "Check Soundscore"}</button>
            {current && <p role="status">{current.status === "not_configured" ? "Noise scores are not connected yet. Free access is planned here." : current.status === "limit_reached" ? "The noise service has reached its request limit. Try again later." : "No noise score is available right now."}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
