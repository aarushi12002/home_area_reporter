"use client";

import { useEffect, useState } from "react";
import ProjectMap from "../../components/ProjectMap";

export default function CompactMapPage() {
  const [state, setState] = useState({ loading: true, summary: null, location: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lng"));
    const location =
      params.has("lat") &&
      params.has("lng") &&
      params.get("lat")?.trim() !== "" && params.get("lng")?.trim() !== "" &&
      Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
      Number.isFinite(longitude) && Math.abs(longitude) <= 180
        ? { latitude, longitude }
        : null;
    const controller = new AbortController();
    fetch(`/api/area-summary?${params}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((summary) => setState({ loading: false, summary, location }))
      .catch((error) => {
        if (error?.name !== "AbortError")
          setState({ loading: false, summary: null, location });
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="compact-map-page">
      {state.loading ? (
        <div className="map-unavailable">Loading map…</div>
      ) : state.summary ? (
        <ProjectMap
          projects={state.summary.highlights}
          locationNotes={(state.summary.coverage || []).map((source)=>source.locationNote).filter(Boolean)}
          location={state.location}
          compact
        />
      ) : (
        <div className="map-unavailable">Map temporarily unavailable.</div>
      )}
    </main>
  );
}
