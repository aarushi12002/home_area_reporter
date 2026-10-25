"use client";

import { useEffect, useRef, useState } from "react";
import { serviceArea } from "../lib/service-areas.mjs";

const STAGE_LABEL = {
  permitted: "Permitted",
  in_review: "In review",
  early_proposal: "Early proposal",
  uncertain: "Status needs review",
};

function coordinate(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ProjectMap({ projects = [], location = null, compact = false, zip = "", noiseLocation = null, onLocationSelect }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [showTransit, setShowTransit] = useState(Boolean(zip) && !compact);
  const [transit, setTransit] = useState(null);
  const [transitStatus, setTransitStatus] = useState("loading");
  const [transitAttempt, setTransitAttempt] = useState(0);
  const [pickingNoise, setPickingNoise] = useState(false);
  const visibleProjects = projects.slice(0, 100).filter(
    (project) =>
      coordinate(project.latitude) !== null && coordinate(project.longitude) !== null,
  );
  const signature = visibleProjects
    .map((project) => `${project.id}:${project.latitude}:${project.longitude}`)
    .join("|");

  useEffect(() => {
    if (!zip || !showTransit || transit?.zip === zip) return;
    const controller = new AbortController();
    setTransitStatus("loading");
    fetch(`/api/transit?${new URLSearchParams({ zip })}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Transit unavailable");
        const body = await response.json();
        if (!controller.signal.aborted) { setTransit(body); setTransitStatus("ready"); }
      })
      .catch(() => { if (!controller.signal.aborted) setTransitStatus("unavailable"); });
    return () => controller.abort();
  }, [zip, showTransit, transitAttempt]);

  useEffect(() => {
    if (!container.current || (!visibleProjects.length && !zip)) return undefined;
    let cancelled = false;
    let map;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, {
        attributionControl: true,
        scrollWheelZoom: false,
        zoomControl: true,
      });
      mapRef.current = map;
      leafletRef.current = L;
      L.tileLayer(
        process.env.NEXT_PUBLIC_MAP_TILE_URL ||
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution:
            process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        },
      ).addTo(map);

      const bounds = [];
      visibleProjects.forEach((project, index) => {
        const point = [coordinate(project.latitude), coordinate(project.longitude)];
        bounds.push(point);
        const marker = L.marker(point, {
          title: `${index + 1}. ${project.address || project.displayAddress}`,
          icon: L.divIcon({
            className: `project-map-marker stage-${project.stage || "uncertain"}`,
            html: String(index + 1),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(map);
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = project.address || project.displayAddress;
        const detail = document.createElement("p");
        detail.textContent = project.summary;
        const stage = document.createElement("small");
        stage.textContent = STAGE_LABEL[project.stage] || "Documented activity";
        popup.append(title, detail, stage);
        marker.bindPopup(popup);
      });

      const propertyLatitude = coordinate(location?.latitude);
      const propertyLongitude = coordinate(location?.longitude);
      if (propertyLatitude !== null && propertyLongitude !== null) {
        const propertyPoint = [propertyLatitude, propertyLongitude];
        bounds.push(propertyPoint);
        L.marker(propertyPoint, {
          title: "Listing location",
          zIndexOffset: 1000,
          icon: L.divIcon({
            className: "property-map-marker",
            html: "⌂",
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        })
          .addTo(map)
          .bindPopup("Listing location");
      }

      if (bounds.length) {
        map.fitBounds(L.latLngBounds(bounds), {
          animate: false,
          maxZoom: 15,
          padding: compact ? [18, 18] : [34, 34],
        });
      } else {
        const vicinity = serviceArea(zip)?.bounds;
        if (vicinity) map.fitBounds([[vicinity[1], vicinity[0]], [vicinity[3], vicinity[2]]], { maxZoom: 15 });
        else map.setView([47.65, -122.33], 12);
      }
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [signature, location?.latitude, location?.longitude, compact, zip]);

  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current;
    if (!mapReady || !map || !L || !showTransit || transit?.zip !== zip) return;
    const layer = L.geoJSON(transit.geojson, {
      style: { color: "#7250b5", weight: 3, opacity: 0.8 },
      onEachFeature(feature, item) {
        const label = document.createElement("strong");
        label.textContent = feature.properties.name;
        item.bindPopup(label);
      },
    }).addTo(map);
    if (!visibleProjects.length) {
      const [west, south, east, north] = transit.bounds;
      map.fitBounds([[south, west], [north, east]]);
    }
    return () => { if (mapRef.current === map) map.removeLayer(layer); };
  }, [mapReady, showTransit, transit, zip, signature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !pickingNoise || !onLocationSelect) return;
    const pick = (event) => {
      onLocationSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      setPickingNoise(false);
    };
    map.on("click", pick);
    return () => { if (mapRef.current === map) map.off("click", pick); };
  }, [mapReady, pickingNoise, onLocationSelect, signature]);

  useEffect(() => {
    const map = mapRef.current, L = leafletRef.current;
    if (!mapReady || !map || !L || !noiseLocation) return;
    const marker = L.circleMarker([noiseLocation.latitude, noiseLocation.longitude], { radius: 8, color: "#b34377", fillOpacity: 0.8 }).addTo(map).bindTooltip("Noise check location");
    return () => { if (mapRef.current === map) map.removeLayer(marker); };
  }, [mapReady, noiseLocation, signature]);

  if (!visibleProjects.length && !zip)
    return (
      <div className="map-unavailable">
        Map unavailable because these records do not include usable coordinates.
      </div>
    );

  return (
    <figure className={compact ? "project-map compact" : "project-map"}>
      {zip && !compact && (
        <div className="map-toolbar">
          <label><input type="checkbox" checked={showTransit} onChange={(event) => setShowTransit(event.target.checked)} />Bus routes</label>
          {showTransit && <span className="transit-legend"><i aria-hidden="true" />Metro · ZIP vicinity</span>}
          {showTransit && transitStatus === "loading" && <span role="status">Loading…</span>}
          {showTransit && transitStatus === "unavailable" && <button className="map-retry secondary" onClick={() => setTransitAttempt((value) => value + 1)}>Retry bus routes</button>}
          {onLocationSelect && <button className="map-retry secondary" aria-pressed={pickingNoise} onClick={() => setPickingNoise((value) => !value)}>{pickingNoise ? "Cancel selection" : "Pick noise location"}</button>}
        </div>
      )}
      {pickingNoise && <p className="map-selection-hint" role="status">Click a spot on the map, then check its Soundscore below.</p>}
      <div ref={container} className="project-map-canvas" aria-label="Project map" />
      {!compact && (
        <figcaption>
          Numbered markers match the ranked results. The home marker is shown only
          when the listing supplies coordinates.
          {showTransit && transit?.zip === zip && <span className="transit-attribution">{transit.attribution}. Routes shown in and around this ZIP; no live arrivals.</span>}
        </figcaption>
      )}
    </figure>
  );
}
