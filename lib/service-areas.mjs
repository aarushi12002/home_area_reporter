import registry from "../data/service-areas.json" with { type: "json" };

export const LEGACY_PREVIEW_ZIPS = Object.freeze(["98101", "98102", "98103", "98104", "98105"]);
export const SERVICE_AREAS = Object.freeze(registry.areas.map((area) => Object.freeze(area)));
export const SEATTLE_ZIPS = Object.freeze(SERVICE_AREAS.filter((area) => area.jurisdictionId === "us-wa-seattle").map((area) => area.zip));
export const GEOGRAPHY_PROVENANCE = Object.freeze(registry.provenance);

export function validPostalCode(value) {
  return typeof value === "string" && /^\d{5}$/.test(value);
}

export function serviceArea(zip) {
  return validPostalCode(zip) ? SERVICE_AREAS.find((area) => area.zip === zip) || null : null;
}

export function sourcePostalCode(value) {
  const match = typeof value === "string" ? value.trim().match(/^(\d{5})(?:-\d{4})?$/) : null;
  return match?.[1] || null;
}

export function sectionAvailability(zip, { profile = null, publicProjects = [], now = new Date() } = {}) {
  const area = serviceArea(zip);
  const groups = new Set(profile?.groups.filter((group) => group.places.length).map((group) => group.id));
  return {
    neighborhood: groups.has("work") && groups.has("shopping") && groups.has("transport") && groups.has("medical") ? "ready" : "pending_review",
    transit: area?.bounds ? "ready" : "not_connected",
    publicImprovements: publicProjects.length ? "ready" : "selected_permits_only",
    soundscore: "requires_provider_access",
    reviewedAt: profile?.reviewedAt || null,
    reviewCurrent: Boolean(profile && Date.parse(profile.reviewUntil) > new Date(now).getTime()),
  };
}
