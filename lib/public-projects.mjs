// Reviewed editorial facts from official project pages, independent of permit
// ingestion. Keep project/phase boundaries explicit and re-review after 90 days.
const projects = [
  {
    id: "spr-freeway-park", zip: "98101", title: "Freeway Park improvements",
    category: "Parks & recreation", stage: "Phased improvements",
    summary: "Restroom, benches and wayfinding upgrades; lighting and electrical work are in a later phase.",
    impact: "Improved park amenities and easier navigation.",
    sourceUrl: "https://www.seattle.gov/parks/about-us/projects/freeway-park-improvements",
    sourceUpdatedAt: "2026-03-13", timeline: { label: "Summer 2026", kind: "phase_target", phase: "Phase 1", targetEnd: "2026-09-30" },
  },
  {
    id: "spr-lower-woodland-field-1", zip: "98103", title: "Lower Woodland Playfield #1",
    category: "Parks & recreation", stage: "Completion update needed",
    summary: "Replacement turf for the ballfield and bullpens, with repairs beneath the playing surface.",
    impact: "A renewed playing surface; the city lists a field closure during work.",
    sourceUrl: "https://www.seattle.gov/parks/about-us/projects/lower-woodland-playfield-1",
    sourceUpdatedAt: "2026-10-20", timeline: { label: "September 2026", kind: "estimated_completion", targetEnd: "2026-09-30" },
  },
  {
    id: "spr-lower-woodland-landscape", zip: "98103", title: "Lower Woodland landscape restoration",
    category: "Parks & recreation", stage: "Planning",
    summary: "Planning for landscape improvements under the city’s Olmsted parks restoration program.",
    impact: "Potential landscape improvements; a construction date has not been announced.",
    sourceUrl: "https://www.seattle.gov/parks/about-us/projects/olmsted-parks-and-boulevards-restoration-project",
    sourceUpdatedAt: "2026-10-20", milestone: "Planning scheduled from summer 2026", timeline: null,
  },
  {
    id: "spu-ship-canal", zip: "98103", title: "Ship Canal Water Quality Project",
    category: "Water & infrastructure", stage: "Construction across multiple sites",
    summary: "Stormwater and wastewater storage tunnel connecting Ballard, Fremont and Wallingford.",
    impact: "Intended to reduce polluted overflows into local waterways.",
    sourceUrl: "https://www.seattle.gov/utilities/neighborhood-projects/ship-canal",
    sourceUpdatedAt: null, timeline: { label: "2027", kind: "program_target", phase: "System operational target", targetEnd: "2027-12-31" },
  },
  {
    id: "spr-hing-hay-restroom", zip: "98104", title: "Hing Hay Park restroom",
    category: "Parks & recreation", stage: "Phased construction",
    summary: "Public restroom, concierge space and storage within the Bush Hotel next to the park.",
    impact: "Public facilities at the park; restroom access is planned while a concierge is present.",
    sourceUrl: "https://www.seattle.gov/parks/about-us/projects/hing-hay-park-restroom-renovation",
    sourceUpdatedAt: "2026-09-09", timeline: { label: "October 2026", kind: "phase_target", phase: "Phase I only · final opening not announced", targetEnd: "2026-10-31" },
  },
];

export function getPublicProjects(zip, { now = new Date() } = {}) {
  const time = new Date(now).getTime();
  if (!Number.isFinite(time) || time < Date.parse("2026-10-21") || time >= Date.parse("2027-01-19")) return [];
  return projects.filter((project) => project.zip === zip).map((project) => ({
    ...project, reviewedAt: "2026-10-21", reviewUntil: "2027-01-19",
    timeline: project.timeline ? {
      ...project.timeline,
      pastTarget: time >= Date.parse(`${project.timeline.targetEnd}T23:59:59.999Z`),
    } : null,
  }));
}
