// Conservative permit-description enrichment. Source activity dates are never
// completion targets, and apartment parking/amenities are not public projects.
export function civicProjectType(text = "") {
  const value = String(text);
  if (/\b(?:private|residents?[ -]only|apartment|condominium)\b.{0,60}\b(?:playground|play area|community cent(?:er|re)|recreation cent(?:er|re))\b/i.test(value)) return null;
  if (/\b(?:public park|playfield|playground|public play area|park (?:renovation|improvements?|restoration)|parks and recreation|community cent(?:er|re)|recreation cent(?:er|re)|public librar(?:y|ies))\b/i.test(value))
    return "parks_recreation";
  if (/\b(?:public school|public hospital|public plaza|public restroom|water quality project|stormwater (?:storage|tunnel)|public (?:trail|greenway))\b/i.test(value))
    return "public_facility";
  return null;
}

const DATE = "(?:(?:Q[1-4]|spring|summer|fall|autumn|winter|January|February|March|April|May|June|July|August|September|October|November|December)\\s+)?20\\d{2}";
const TARGET = new RegExp(`\\b(?:expected|estimated|anticipated|scheduled|target(?:ed)?)\\s+(?:project\\s+)?completion(?:\\s+(?:date|target))?\\s*(?::\\s*)?(?:is\\s+)?(?:(?:in|by|for)\\s+)?(${DATE})\\b|\\b(?:construction|project|building|work)\\s+(?:is\\s+)?(?:expected|scheduled|anticipated|planned)\\s+to\\s+(?:be\\s+)?(?:complete(?:d)?|finish|open)\\s+(?:by\\s+|in\\s+)?(${DATE})\\b`, "i");

export function completionTimeline(project, { now = new Date() } = {}) {
  const description = String(project.summary || project.description || "");
  const match = description.match(TARGET);
  if (!match) return null;
  if (/(?:\bno|\bnot|\bno longer)\s*$/i.test(description.slice(0, match.index))) return null;
  if (/^\s*[-–—/]\s*(?:20\d{2}|Q[1-4])/i.test(description.slice(match.index + match[0].length))) return null;
  const label = (match[1] || match[2]).replace(/\s+/g, " ");
  const year = Number(label.match(/20\d{2}/)[0]);
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const month = months.indexOf(label.split(" ")[0].toLowerCase());
  const quarter = label.match(/^Q([1-4])/i);
  // Compare the end of a stated month/quarter/year, without displaying an
  // invented exact finish day. Ambiguous seasonal targets use the full year.
  const lastMonth = month >= 0 ? month : quarter ? Number(quarter[1]) * 3 - 1 : 11;
  const periodEnd = Date.UTC(year, lastMonth + 1, 0, 23, 59, 59, 999);
  return {
    label,
    kind: "estimated_completion",
    pastTarget: new Date(now).getTime() > periodEnd,
    sourceUrl: project.sourceUrl || null,
  };
}

export function demolitionOnly(text = "") {
  return /^\s*(?:demolish|demolition)\b/i.test(text) && !/\b(?:construct|construction|new (?:building|apartments?|dwelling))\b/i.test(text);
}

// Read the proposed destination of a conversion, not the previous use. Remove
// retained/demolished buildings and explicit negations before matching uses.
export function commercialWork(text = "") {
  if (/\b(?:sign installation|install\w* (?:a |new )?sign|re-?roof|water heater|replace windows)\b/i.test(text) && !/\b(?:tenant improvements?|change\s+(?:of\s+)?use|convert\w*)\b/i.test(text))
    return { uses: [], hasWork: false, everyday: false, conversion: false, fitOut: false };
  const clauses = String(text).split(/[.;\n]/).map((clause) => {
    if (demolitionOnly(clause) || /\bto (?:remain|be demolished|be removed)\b/i.test(clause)) return "";
    clause = clause.replace(/\bno change (?:of|in|to) use\b/gi, "");
    const conversion = clause.match(/\b(?:change\s+(?:of\s+)?use|convert\w*)\b.{0,100}?\bfrom\b.{0,100}?\bto\b(.*)/i)
      || clause.match(/\bconvert\w*\b.{0,100}?\bto\b(.*)/i);
    const target = conversion ? conversion[1] : clause;
    return /\b(?:construct\w*|establish\w*|new|propos\w*|allow|tenant improvements?|alter\w*|renovat\w*|convert\w*|change\w*)\b/i.test(clause)
      ? target.replace(/\b(?:no|without|not including|not proposing)\s+(?:new\s+)?(?:retail|commercial|office|restaurant|caf[eé]|grocery)\b/gi, "") : "";
  }).join(". ");
  const uses = [
    ["Retail", /\bretail\b/i],
    ["Food & drink", /\b(?:restaurant|caf[eé]|coffee shop|bakery|tavern|wine bar|cocktail bar)\b/i],
    ["Groceries", /\b(?:grocery|supermarket)\b/i],
    ["Care & services", /\b(?:(?:medical|dental) (?:clinic|office)|daycare|child ?care|salon|fitness (?:studio|center)|gym)\b/i],
    ["Office", /\boffice\b/i],
    ["Industrial & storage", /\b(?:warehouse|industrial|laborator(?:y|ies))\b/i],
    ["Hotel", /\bhotel\b/i],
  ].filter(([, pattern]) => pattern.test(clauses)).map(([name]) => name);
  const generic = /\bcommercial\b/i.test(clauses);
  return {
    uses,
    hasWork: uses.length > 0 || generic,
    everyday: uses.some((use) => ["Retail", "Food & drink", "Groceries", "Care & services"].includes(use)),
    conversion: (uses.length > 0 || generic) && !/\bno change (?:of|in|to) use\b/i.test(text) && /\b(?:change\s+(?:of\s+)?use|convert\w*)\b/i.test(text),
    fitOut: (uses.length > 0 || generic) && /\b(?:tenant improvements?|alter\w*|renovat\w*|fit[ -]?out)\b/i.test(text),
  };
}

export function buildingUpgrades(text = "") {
  const value = String(text).replace(/\b(?:no|without)\s+(?:new\s+)?(?:seismic retrofit|accessibility upgrades?|sprinklers?)\b/gi, "");
  return [
    ["Seismic retrofit", /\b(?:seismic|earthquake) (?:retrofit|upgrade|strengthen)/i],
    ["Accessibility", /\b(?:ADA|accessibility) (?:upgrade|improvement|ramp)|\b(?:new|construct|install)\b.{0,35}\b(?:accessible ramp|wheelchair ramp|elevator)\b/i],
    ["Fire systems", /\b(?:install|replace|upgrade|new)\b.{0,30}\b(?:fire (?:alarm|sprinkler)|sprinkler system)\b/i],
  ].filter(([, pattern]) => pattern.test(value)).map(([label]) => label);
}

export function parkingPlan(text = "") {
  const value = String(text);
  if (/\b(?:no change|unchanged|existing parking to remain)\b/i.test(value) && !/\b(?:new|proposed|propose|add)\b/i.test(value)) return null;
  const explicitNone = /\bno\s+(?:(?:off[ -]street|on[ -]site|vehicle)\s+)?parking\s+(?:(?:is|will be)\s+)?(?:proposed|provided)\b|\bparking\s+(?:is\s+)?not\s+(?:proposed|provided)\b/i.test(value);
  const counts = [...value.matchAll(/\bparking\s+for\s+(\d{1,4})\s+(?:vehicles?|cars?)\b|\b(\d{1,4})\s+(?:vehicle\s+)?parking\s+(?:spaces?|stalls?)\b/gi)]
    .map((match) => Number(match[1] ?? match[2]));
  const removed = /\b(?:remove|removal|eliminate)\b.{0,35}\b(?:parking|garage)\b|\bparking\b.{0,25}\b(?:removed|eliminated)\b/i.test(value);
  if (!explicitNone && !counts.length && !removed) return null;
  return { spaces: counts.length ? Math.max(...counts) : explicitNone ? 0 : null, explicitNone, removed };
}

export function hasSiteWork(text = "") {
  const value = String(text)
    .replace(/\b(?:no|without|not proposing)\s+(?:building\s+)?(?:demolition|excavation|shoring)\b/gi, "")
    .replace(/\b(?:(?:were|was|already|previously)\s+demolished|(?:has|have)\s+been\s+demolished)\b/gi, "");
  return /\b(?:demolish(?:ed|ing)?|demolition|excavation|excavate|shoring|pile driving)\b/i.test(value);
}
