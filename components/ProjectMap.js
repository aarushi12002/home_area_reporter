"use client";

import { useEffect, useRef } from "react";

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

export default function ProjectMap({ projects = [], location = null, compact = false }) {
  const container = useRef(null);
  const visibleProjects = projects.filter(
    (project) =>
      coordinate(project.latitude) !== null && coordinate(project.longitude) !== null,
  );
  const signature = visibleProjects
    .map((project) => `${project.id}:${project.latitude}:${project.longitude}`)
    .join("|");

  useEffect(() => {
    if (!container.current || !visibleProjects.length) return undefined;
    let cancelled = false;
    let map;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, {
        attributionControl: true,
        scrollWheelZoom: false,
        zoomControl: true,
      });
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

      map.fitBounds(L.latLngBounds(bounds), {
        animate: false,
        maxZoom: 15,
        padding: compact ? [18, 18] : [34, 34],
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [signature, location?.latitude, location?.longitude, compact]);

  if (!visibleProjects.length)
    return (
      <div className="map-unavailable">
        Map unavailable because these records do not include usable coordinates.
      </div>
    );

  return (
    <figure className={compact ? "project-map compact" : "project-map"}>
      <div ref={container} className="project-map-canvas" aria-label="Project map" />
      {!compact && (
        <figcaption>
          Numbered markers match the ranked results. The home marker is shown only
          when the listing supplies coordinates.
        </figcaption>
      )}
    </figure>
  );
}
