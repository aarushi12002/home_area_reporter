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
    // The story stays ZIP-wide even when private listing coordinates reorder highlights.
    impactSummary: neighborhoodImpacts(location ? rankProjects(projects.filter((project) => project.visible)) : ranked),
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

const CLOSED_STATUS = /\b(?:cancelled|canceled|completed|finaled|expired|withdrawn|void|closed|denied)\b/i;
const wordCount = (text) => String(text).trim().split(/\s+/).filter(Boolean).length;
const normalizedText = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Compact, evidence-linked candidates are materialized once during ingestion.
// One per category preserves diversity without storing the full project list.
function standoutCandidates(projects) {
  const candidates = [], categories = new Set();
  for (const project of projects) {
    if (!project.visible || !["permitted", "in_review", "early_proposal"].includes(project.stage) || CLOSED_STATUS.test(project.originalStatus || "")) continue;
    const address = String(project.displayAddress || "").trim();
    if (!address || wordCount(address) > 12) continue;
    const timeline = project.timeline || completionTimeline(project);
    if (timeline?.pastTarget) continue;
    const text = String(project.summary || "");
    // Minor rooftop equipment changes are not neighborhood-level standouts.
    if (/\bminor\b.{0,60}\b(?:telecommunicat\w*|communication|antenna)/i.test(text) || /\b(?:telecommunicat\w*|communication|antenna)\b.{0,100}\b(?:rooftop|roof)\b/i.test(text)) continue;
    const commercial = commercialWork(text), upgrades = buildingUpgrades(text);
    const demolition = demolitionOnly(text) || (project.category === "demolition" && !/\b(?:construct|new)\b/i.test(text));
    let category, work, implication;
    if (demolition) {
      category = "disruption"; work = "demolition";
      implication = "Demolition could bring noise, dust and truck activity if work proceeds.";
    } else if (upgrades.length) {
      category = "upgrades";
      work = upgrades.includes("Seismic retrofit") ? "a seismic retrofit" : upgrades.includes("Accessibility") ? "accessibility upgrades" : "fire-system upgrades";
      implication = "The upgrade scope is recorded; completion still needs confirmation.";
    } else if (civicProjectType(text)) {
      category = "public_facility";
      work = /public librar/i.test(text) ? "library improvements" : /school/i.test(text) ? "school facility work" : /(?:restroom|comfort station)/i.test(text) ? "public restroom work" : "park or public-facility work";
      implication = "The plans concern public amenities; delivery and access remain unconfirmed.";
    } else if (commercial.uses.includes("Hotel")) {
      category = "commercial"; work = commercial.fitOut ? "work on existing hotel space" : "hotel building plans";
      implication = "Hotel plans concern visitor accommodation; an opening is unconfirmed.";
    } else if (Number(project.unitsAdded) > 0 || /\b(?:new|construct\w*|proposed)\b.{0,35}\b(?:apartments?|multifamily|dwelling|townhouse)/i.test(text)) {
      category = "housing";
      const units = Number(project.unitsAdded).toLocaleString("en-US");
      work = Number(project.unitsAdded) > 0 ? `${/^8|^(?:11|18)(?:,|$)/.test(units) ? "an" : "a"} ${units}-home housing plan` : "housing building plans";
      implication = "Housing plans could add choices if built and occupied.";
      if (hasSiteWork(text)) implication = "Housing plans include site work that could bring noise and trucks.";
    } else if (/\bparking (?:area|garage|lot)\b/i.test(text)) {
      category = "parking"; work = "parking-area work";
      implication = "Parking work concerns this site; street-parking availability is unknown.";
    } else if (/\brepair\b.{0,30}\b(?:column|damage|structur)/i.test(text)) {
      category = "upgrades"; work = "building repairs";
      implication = "Repairs address recorded building damage; completion remains unconfirmed.";
    } else if (commercial.hasWork) {
      category = commercial.everyday ? "shops_services" : "commercial";
      const primaryUse = commercial.uses[0];
      const destination = text.match(/\b(?:change\s+(?:of\s+)?use|convert\w*)\b[^.;]{0,100}?\bfrom\b[^.;]{0,100}?\bto\s+(custom and craft work|indoor (?:participant sports|sports and recreation)|woodworking shop)\b/i)?.[1];
      const use = destination ? /craft/i.test(destination) ? "craft-work" : /woodworking/i.test(destination) ? "woodworking-shop" : "indoor-recreation" : primaryUse === "Care & services" ? /\bmedical clinic\b/i.test(text) ? "medical clinic" : /\bdental\b/i.test(text) ? "dental clinic" : /\b(?:daycare|child ?care)\b/i.test(text) ? "childcare" : /\bgym\b/i.test(text) ? "gym" : "service" : primaryUse === "Industrial & storage" && /laborator/i.test(text) ? "laboratory" : ({ "Food & drink": "restaurant", Groceries: "grocery", Retail: "retail", Office: "office", "Industrial & storage": "industrial or storage" })[primaryUse] || "commercial";
      const existingUse = new RegExp(`\\bexisting\\s+(?:[\\w-]+\\s+){0,2}${use}\\b`, "i").test(text);
      work = commercial.conversion ? `a change to ${use} use` : commercial.fitOut ? existingUse ? `alterations to existing ${use} space` : `${use} fit-out work` : `${use} space plans`;
      const conversionImpacts = {
        restaurant: "Restaurant use could add dining options if it opens.",
        grocery: "Grocery use could add shopping options if it opens.",
        retail: "Retail use could change nearby shopping options; opening is unconfirmed.",
        childcare: "Childcare use could add local care options if it opens.",
      };
      const alterationImpacts = {
        restaurant: "Work prepares or alters restaurant space; an opening is unconfirmed.",
        "medical clinic": "Work prepares or alters clinic space; services and opening remain unconfirmed.",
        "dental clinic": "Work prepares or alters dental space; services and opening remain unconfirmed.",
        gym: "Work prepares or alters fitness space; services and opening remain unconfirmed.",
        retail: "Retail alterations concern shop premises; a new tenant is unconfirmed.",
        office: "Office alterations concern workspace layouts; they do not establish new jobs.",
        laboratory: "Laboratory alterations concern research space; expanded operations are unconfirmed.",
      };
      implication = commercial.conversion ? conversionImpacts[use] || "Changed business use could alter nearby activity; final occupancy is unconfirmed." : commercial.fitOut ? alterationImpacts[use] || "Work prepares or alters business space; a new tenant is unconfirmed." : "Business-space plans are recorded; occupancy and openings remain unconfirmed.";
      if (commercial.conversion && commercial.uses.includes("Retail") && /\bfor a music school\b/i.test(text)) {
        work = "work for a music school";
        implication = "Music-school plans concern lesson space; an opening is unconfirmed.";
      } else if (/\b(?:install|construct)\b.{0,40}\bportable office trailer\b/i.test(text)) {
        const temporary = /\btemporary\b|\bfor \d+ months\b/i.test(text);
        work = temporary ? "a temporary office trailer" : "office trailer plans";
        implication = temporary ? "The plans provide temporary on-site workspace; wider business growth is unverified." : "Office-trailer plans concern on-site workspace; wider business growth is unverified.";
      } else if (/\b(?:expand restaurant|restaurant expansion)\b/i.test(text)) {
        work = "a restaurant expansion";
        implication = "Plans could expand dining space if delivered; opening details are unconfirmed.";
      }
    } else if (hasSiteWork(text)) {
      category = "disruption"; work = "demolition or site work";
      implication = "Site work could bring noise, dust and trucks if it proceeds.";
    } else if (project.category === "institutional") {
      category = "institutional"; work = /laborator/i.test(text) ? "laboratory work" : /school/i.test(text) ? "school facility work" : "institutional building work";
      implication = "The plans concern institutional facilities; delivery and access remain unconfirmed.";
    } else if (/\b(?:proposed|new|construct)\b.{0,25}\b\d{1,2}[ -]stor(?:y|ies) building/i.test(text)) {
      category = "building_scale"; work = `a ${text.match(/\b(\d{1,2})[ -]stor(?:y|ies)/i)[1]}-story building plan`;
      implication = "Building scale is recorded; effects on views need a property-specific check.";
    } else continue;
    if (categories.has(category)) continue;
    categories.add(category);
    const shortFact = `${STAGE_LABELS[project.stage]}: ${work} at ${address}.`;
    candidates.push({
      projectId: project.id, category, address, stage: STAGE_LABELS[project.stage],
      fact: timeline ? `${shortFact.slice(0, -1)} (completion target: ${timeline.label}).` : shortFact,
      shortFact, implication, targetEnd: timeline?.targetEnd || null,
      sourceUrl: project.sourceUrl || project.records?.[0]?.url || null,
      description: text.slice(0, 600),
    });
  }
  return candidates;
}

function publicStandout(project, now) {
  const time = new Date(now).getTime();
  if (!project.snapshotWork || !project.snapshotImpact || !project.sourceUrl ||
      !(time >= Date.parse(project.reviewedAt) && time < Date.parse(project.reviewUntil)) ||
      CLOSED_STATUS.test(project.stage || "") || project.timeline?.pastTarget ||
      (project.timeline?.targetEnd && time > Date.parse(`${project.timeline.targetEnd}T23:59:59.999Z`))) return null;
  const target = project.timeline?.label ? `; ${project.timeline.kind === "program_target" ? "program target" : project.timeline.kind === "phase_target" ? "phase target" : "target"}: ${project.timeline.label}` : "";
  const fact = `${project.title}: ${project.snapshotWork} (${project.stage}${target}).`;
  const shortFact = `${project.title}: ${project.snapshotWork} (${project.stage}).`;
  if (wordCount(shortFact) > 45 || wordCount(project.snapshotImpact) > 35) return null;
  return { referenceId: project.id, category: "public_improvement", title: project.title, stage: project.stage, fact,
    shortFact, implication: project.snapshotImpact, sourceUrl: project.sourceUrl };
}

function sameStandout(permit, reference) {
  const title = normalizedText(reference.title);
  return permit.sourceUrl === reference.sourceUrl ||
    (title.length >= 12 && normalizedText(permit.description).includes(title));
}

// Recompose only compact stored candidates and current reviewed references.
// Legacy snapshots remain readable until their next successful batch publication.
export function composeImpactSummary(impact, publicProjects = [], { now = new Date() } = {}) {
  if (!Array.isArray(impact?.standoutCandidates)) return impact;
  const publicCandidates = publicProjects.map((project) => publicStandout(project, now)).filter(Boolean)
    .sort((a, b) => Number(/construction/i.test(b.stage)) - Number(/construction/i.test(a.stage)));
  const reference = publicCandidates[0];
  const permits = impact.standoutCandidates.filter((permit) =>
    (!permit.targetEnd || new Date(now).getTime() <= Date.parse(`${permit.targetEnd}T23:59:59.999Z`)) &&
    (!reference || !sameStandout(permit, reference)));
  let selected = [permits[0], reference || permits.find((permit) => permit.category !== permits[0]?.category)].filter(Boolean);
  if (wordCount(selected.map((item) => item.fact).join(" ")) > 45) {
    selected = selected.map((item) => item.shortFact ? { ...item, fact: item.shortFact } : item);
  }
  if (selected.length === 2 && (wordCount(selected.map((item) => item.fact).join(" ")) > 45 || wordCount(selected.map((item) => item.implication).join(" ")) > 35)) selected = [selected.find((item) => item.referenceId) || selected[0]];
  return { ...impact, standouts: selected,
    changesSummary: selected.length ? selected.map((item) => item.fact).join(" ") : impact.hasCurrentPlans ? "No standout change could be summarized from the available plans." : "No recent building plans were found in the available city records.",
    overview: selected.length ? [...new Set(selected.map((item) => item.implication))].join(" ") : "Missing data does not mean no change. There is not enough detail to describe a specific local impact.",
  };
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
  return composeImpactSummary({
    hasCurrentPlans: projects.some((project) => project.visible && ["permitted", "in_review", "early_proposal"].includes(project.stage) && !CLOSED_STATUS.test(project.originalStatus || "")),
    standoutCandidates: standoutCandidates(projects),
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
  });
}
