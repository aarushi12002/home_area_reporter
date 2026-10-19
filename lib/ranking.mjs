const STAGE_LABELS = {
  permitted: "Permitted",
  in_review: "In review",
  early_proposal: "Early proposal",
  uncertain: "Status needs review",
};

export function haversineMiles(a, b) {
  if (![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite))
    return null;
  const radians = (value) => (value * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function proximityWeight(distanceMiles) {
  if (distanceMiles === null) return 0;
  if (distanceMiles <= 0.25) return 30;
  if (distanceMiles <= 0.5) return 24;
  if (distanceMiles <= 1) return 17;
  if (distanceMiles <= 2) return 8;
  return 0;
}

export function rankProjects(projects, location = null) {
  return projects
    .map((project) => {
      const distanceMiles = location
        ? haversineMiles(location, {
            latitude: Number(project.latitude),
            longitude: Number(project.longitude),
          })
        : null;
      const reasons = [];
      if (distanceMiles !== null) reasons.push(`${distanceMiles.toFixed(1)} miles away`);
      if (project.unitsAdded) reasons.push(`${project.unitsAdded} homes recorded`);
      reasons.push(STAGE_LABELS[project.stage] || "Documented activity");
      if (project.lastActivityAt)
        reasons.push(
          `activity ${new Date(project.lastActivityAt).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}`,
        );
      return {
        ...project,
        distanceMiles,
        displayPriority: Number(project.basePriority) + proximityWeight(distanceMiles),
        reasons,
      };
    })
    .sort(
      (a, b) =>
        b.displayPriority - a.displayPriority ||
        String(b.lastActivityAt || "").localeCompare(String(a.lastActivityAt || "")),
    );
}

export function areaSummary(projects, { zip, location = null, limit = 15 } = {}) {
  const ranked = rankProjects(projects.filter((project) => project.visible), location);
  const counts = {
    permitted: ranked.filter((x) => x.stage === "permitted").length,
    inReview: ranked.filter((x) => x.stage === "in_review").length,
    earlyProposal: ranked.filter((x) => x.stage === "early_proposal").length,
  };
  const highlights = ranked.slice(0, limit).map((project) => ({
    id: project.id,
    address: project.displayAddress,
    category: project.category,
    stage: project.stage,
    status: project.originalStatus,
    lastActivityAt: project.lastActivityAt,
    unitsAdded: project.unitsAdded,
    scaleBand: project.scaleBand,
    summary: project.summary,
    latitude: project.latitude,
    longitude: project.longitude,
    distanceMiles: project.distanceMiles,
    reasons: project.reasons,
    evidenceCount: project.evidenceCount ?? project.records?.length ?? 0,
    sourceUrl: project.sourceUrl || project.records?.[0]?.url || null,
  }));
  const headline = ranked.length
    ? `${highlights.length} documented change${highlights.length === 1 ? "" : "s"} worth investigating in ${zip}`
    : `No current project highlights available for ${zip}`;
  return {
    zip,
    headline,
    counts,
    highlights,
    totalCurrentProjects: ranked.length,
    moreCount: Math.max(0, ranked.length - highlights.length),
  };
}
