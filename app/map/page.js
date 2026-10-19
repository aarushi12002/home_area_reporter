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
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
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
          location={state.location}
          compact
        />
      ) : (
        <div className="map-unavailable">Map temporarily unavailable.</div>
      )}
    </main>
  );
}
