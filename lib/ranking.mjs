import { buildingUpgrades, civicProjectType, commercialWork, completionTimeline, demolitionOnly, hasSiteWork, parkingPlan } from "./project-details.mjs";

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
            latitude: project.latitude,
            longitude: project.longitude,
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
        timeline: completionTimeline(project),
        distanceMiles,
        displayPriority: Number(project.basePriority) + proximityWeight(distanceMiles),
        reasons,
      };
    })
    .sort(
      (a, b) =>
        b.displayPriority - a.displayPriority ||
        String(b.lastActivityAt || "").localeCompare(String(a.lastActivityAt || "")) || String(a.id).localeCompare(String(b.id)),
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
    timeline: project.timeline,
  }));
  const headline = ranked.length
    ? `${highlights.length} project${highlights.length === 1 ? "" : "s"} to explore in ${zip}`
    : `No recent building plans found for ${zip}`;
  return {
    zip,
    headline,
    impactSummary: neighborhoodImpacts(ranked),
    decisionSignals: decisionSignals(ranked),
    counts,
    highlights,
    civicProjects: ranked.filter((project) => civicProjectType(project.summary)).slice(0, 6),
    totalCurrentProjects: ranked.length,
    moreCount: Math.max(0, ranked.length - highlights.length),
  };
}

function decisionSignals(projects) {
  const eligible = projects.filter((project) => ["permitted", "in_review", "early_proposal"].includes(project.stage));
  const details = eligible.map((project) => ({
    project,
    commercial: commercialWork(project.summary),
    parking: parkingPlan(project.summary),
    upgrades: buildingUpgrades(project.summary),
    demolitionOnly: demolitionOnly(project.summary) || (project.category === "demolition" && !/\b(?:construct|new)\b/i.test(project.summary || "")),
  }));
  const housing = details.filter((item) => !item.demolitionOnly && Number(item.project.unitsAdded) > 0).sort((a, b) => Number(b.project.unitsAdded) - Number(a.project.unitsAdded));
  const largest = Math.max(0, ...housing.map(({ project }) => Number(project.unitsAdded)));
  const heights = details.filter((item) => !item.demolitionOnly).map((item) => ({ ...item, stories: Math.max(Number(item.project.stories) || 0, ...[...String(item.project.summary || "").matchAll(/\b(\d{1,2})[ -]stor(?:y|ies|ey|eys)\b/gi)].map((match) => Number(match[1]))) })).filter((item) => item.stories >= 3).sort((a, b) => b.stories - a.stories);
  const shops = details.filter((item) => !item.demolitionOnly && item.commercial.everyday);
  const commercial = details.filter((item) => !item.demolitionOnly && item.commercial.hasWork);
  const parking = details.filter((item) => !item.demolitionOnly && item.parking).sort((a, b) => (b.parking.spaces || 0) - (a.parking.spaces || 0));
  const siteWork = details.filter((item) => hasSiteWork(item.project.summary));
  const upgrades = details.filter((item) => item.upgrades.length);
  const labels = (items, get) => [...new Set(items.flatMap(get))].slice(0, 4).join(" · ");
  const plans = (items) => `${items.length} matching plan${items.length === 1 ? "" : "s"}`;
  const countPhrase = (n, label) => `${n} ${label}${n === 1 ? "" : "s"}`;
  const cards = [];
  const add = (id, title, items, metric, fact, resident, business, audience = ["home", "business"]) => {
    if (!items.length) return;
    cards.push({ id, title, count: items.length, metric, fact, audience, takeaways: { home: resident, business },
      examples: items.slice(0, 3).map(({ project }) => ({ projectId: project.id, address: project.displayAddress, stage: STAGE_LABELS[project.stage], sourceUrl: project.sourceUrl || project.records?.[0]?.url || null, description: project.summary })),
    });
  };
  add("housing", "Homes & local activity", housing, `${largest.toLocaleString("en-US")} homes`, `Largest individual plan · ${plans(housing)}`, "More housing choices and potentially a busier neighborhood.", "More occupied homes could expand the nearby customer base; demand is unverified.");
  add("views", "Building height", heights, `Up to ${Math.max(0, ...heights.map((item) => item.stories))} stories`, plans(heights), "Check the building’s position against your views, privacy and daylight.", "Check neighboring building scale when assessing visibility and frontage.");
  add("shops", "Shops & everyday services", shops, plans(shops), labels(shops, (item) => item.commercial.uses.filter((use) => ["Retail", "Food & drink", "Groceries", "Care & services"].includes(use))), "Plans may change nearby shopping and services; openings are unconfirmed.", "Review potential destinations, complementary uses and competing businesses.");
  const conversions = commercial.filter((item) => item.commercial.conversion).length;
  const fitOuts = commercial.filter((item) => item.commercial.fitOut).length;
  add("commercial", "Commercial space & reuse", commercial, plans(commercial), [labels(commercial, (item) => item.commercial.uses), conversions ? countPhrase(conversions, "use change") : "", fitOuts ? countPhrase(fitOuts, "fit-out / alteration") : ""].filter(Boolean).join(" · "), "Workspace and business-use plans may change the area’s daily activity.", "Investigate permitted uses and fit-out work; permits do not establish vacant or leasable space.", ["business"]);
  const noParking = parking.filter((item) => item.parking.explicitNone).length;
  const removed = parking.filter((item) => item.parking.removed).length;
  const maxParking = Math.max(0, ...parking.map((item) => item.parking.spaces || 0));
  add("parking", "On-site parking", parking, maxParking ? `Up to ${maxParking} spaces` : plans(parking), [maxParking ? "In one plan" : "", noParking ? `${noParking} plan${noParking === 1 ? " proposes" : "s propose"} no parking` : "", removed ? `${removed} mention parking removal` : ""].filter(Boolean).join(" · ") || "Parking scope stated in plans", "Check on-site provision; these plans don’t measure street-parking availability.", "Check customer and staff access; parking mentions do not establish loading rights.");
  add("disruption", "Demolition & site work", siteWork, plans(siteWork), "Demolition, excavation or shoring mentioned", "If work proceeds, noise, dust and truck activity could affect daily life.", "If work proceeds, check how deliveries and storefront access may be affected.");
  add("upgrades", "Access & building upgrades", upgrades, plans(upgrades), labels(upgrades, (item) => item.upgrades), "Upgrade work is recorded; completed safety or accessibility is unverified.", "Check the scope of retrofits and access work before planning a fit-out.");
  return cards;
}

// Permit evidence supports conditional implications, not forecasts. Use the same
// visible project set for both persisted reports and the live fallback.
function neighborhoodImpacts(projects) {
  const eligible = projects.filter(
    (project) =>
      ["permitted", "in_review", "early_proposal"].includes(project.stage) &&
      project.category !== "demolition" &&
      !/^demolish\b/i.test(project.summary || ""),
  );
  const housing = eligible
    .filter((project) => Number(project.unitsAdded) > 0)
    .sort((a, b) => Number(b.unitsAdded) - Number(a.unitsAdded));
  const heights = eligible
    .map((project) => {
      const mentions = [...String(project.summary || "").matchAll(/\b(\d{1,2})[ -]stor(?:y|ies|ey|eys)\b/gi)]
        .map((match) => Number(match[1]));
      return { project, stories: Math.max(Number(project.stories) || 0, ...mentions) };
    })
    .filter(({ stories }) => stories >= 3)
    .sort((a, b) => b.stories - a.stories);
  const evidence = (items) => items.slice(0, 2).map((project) => ({
    projectId: project.id,
    address: project.displayAddress,
    stage: STAGE_LABELS[project.stage],
    description: project.summary,
    sourceUrl: project.sourceUrl || project.records?.[0]?.url || null,
  }));
  const largest = housing[0];
  const tallest = heights[0];
  const heightProjects = heights.map(({ project }) => project);
  // An ordinal record-support rubric, not impact severity or a confidence %.
  const score = (items, quantified) => items.length ?
    1 + Number(items.some((project) => project.sourceUrl || project.records?.[0]?.url)) +
    Number(quantified) + Number(items.length > 1) +
    Number(items.some((project) => project.stage === "permitted")) : null;
  return {
    changesSummary: largest
      ? `Housing plans include up to ${Number(largest.unitsAdded).toLocaleString("en-US")} homes in one project${tallest ? `; some plans mention buildings up to ${tallest.stories} stories` : ""}.`
      : tallest
        ? `City records describe buildings of up to ${tallest.stories} stories.`
        : projects.length
          ? "Building proposals and permits appear in the city records. See the projects below for details."
          : "No recent building plans were found in the available city records.",
    overview: largest
      ? `More homes could mean a denser, busier neighborhood${tallest ? "; taller buildings could affect nearby views" : ""}.`
      : "Too little evidence to assess the overall change. Missing data does not mean no change.",
    basis: "Based on current projects in connected permit sources across this ZIP, rather than a property-specific assessment. Proposals can change; permits do not confirm construction or completion.",
    scoreMethod: "Record signal, 1–5: one point each for a project, an official source link, a numeric housing or height field, multiple projects, and a permitted project. Economic implications are indirect and capped at 2. An em dash means missing evidence. Scores describe record support, not severity, benefit, confidence percentages or price direction.",
    items: [
      {
        id: "housing",
        title: "Density",
        score: score(housing, true),
        takeaway: largest ? "More homes → potentially higher density." : "Housing impact is not established.",
        assessment: largest ? "Possible impact" : "Needs more evidence",
        text: largest
          ? "If the recorded housing is built and occupied, the neighborhood could have more residents and activity. Units recorded are proposed additions, not a net housing gain; timing and occupancy are unverified."
          : "No sufficiently supported housing addition is identified in the current project set. This does not establish that no new homes are planned.",
        evidence: evidence(housing),
      },
      {
        id: "views",
        title: "Views & daylight",
        score: score(heightProjects, true),
        takeaway: tallest ? "Taller buildings → check views & daylight." : "View impact needs a site-specific check.",
        assessment: tallest ? "Possible impact" : "Needs more evidence",
        text: tallest
          ? `Records mention buildings of up to ${tallest.stories} stories. Proposed building form could affect nearby sightlines or daylight, but blocked views require site plans, elevation, orientation and a specific home's position to assess.`
          : "Blocked views or changes to daylight cannot be assessed from these records. Building dimensions, site plans and the home's floor and orientation are needed.",
        evidence: evidence(heightProjects),
      },
      {
        id: "economy",
        title: "Local economy",
        score: largest ? Math.min(2, score(housing, true)) : null,
        takeaway: largest ? "More residents could support local shops." : "Economic impact is not established.",
        assessment: largest ? "Possible impact" : "Needs more evidence",
        text: largest
          ? "Additional occupied homes could support local shops and services. The housing pipeline signals development interest; it does not establish committed funding, new businesses, jobs or economic growth."
          : "Permit activity alone does not establish new investment, jobs or business growth. Confirm proposed uses, committed funding and delivery before drawing an economic conclusion.",
        evidence: evidence(housing),
      },
      {
        id: "transport",
        title: "Transport & access",
        score: null,
        takeaway: "Travel improvements are not verified yet.",
        assessment: "Not assessed",
        text: "Easier journeys, improved service and construction-related closures are not established. Current bus-route geometry does not establish future transit or street improvements, so travel-time and access changes remain unknown.",
        evidence: [],
      },
      {
        id: "zoning",
        title: "Zoning",
        score: null,
        takeaway: "Zoning changes need additional evidence.",
        assessment: "Not assessed",
        text: "Land-use applications do not establish an area-wide zoning change. Adopted zoning maps, effective dates and parcel rules are needed to assess additional development capacity or investment opportunities.",
        evidence: [],
      },
      {
        id: "prices",
        title: "Prices, rents & rates",
        score: null,
        takeaway: "Price direction is not established.",
        assessment: "Direction unknown",
        text: "These records do not establish whether property prices, rents, taxes or parking rates will rise or fall. Market, assessment and policy data are needed; no percentage or appreciation forecast is available.",
        evidence: [],
      },
    ],
  };
}
