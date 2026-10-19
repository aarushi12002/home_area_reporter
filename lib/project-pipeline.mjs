import { createHash } from "node:crypto";
import { classify, relevant } from "./report.mjs";

export const INITIAL_SERVICE_AREAS = [
  "98101",
  "98102",
  "98103",
  "98104",
  "98105",
];

const ACTIVE_STAGE_WEIGHT = {
  permitted: 34,
  in_review: 25,
  early_proposal: 17,
  uncertain: 6,
};

export function normalizeAddress(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function usableDate(value, now = new Date()) {
  if (!value) return null;
  const date = new Date(value);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(date.getTime()) || year < 1990 || year > now.getUTCFullYear() + 2)
    return null;
  return date.toISOString();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function coordinates(row) {
  const latitude = Number(row.latitude ?? row.location1?.latitude);
  const longitude = Number(row.longitude ?? row.location1?.longitude);
  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

export function projectCategory(row) {
  const text = `${row.description || ""} ${row.permittypedesc || ""}`;
  if (/demolish|demolition/i.test(text)) return "demolition";
  if (/mixed.use|retail|commercial|live.work/i.test(text)) return "mixed_use";
  if (/apartment|multi.family|multifamily|condominium|hotel/i.test(text))
    return "multifamily";
  if (/townhome|townhouse|two.family|duplex|dwelling|residen/i.test(text))
    return "small_housing";
  if (/subdivis|short plat|unit lot/i.test(text)) return "subdivision";
  if (/school|park|zoo|institution|hospital|community/i.test(text))
    return "institutional";
  return "other_development";
}

function normalizedStage(status) {
  if (/^(issued|approved|decision issued|approved with conditions)$/i.test(status))
    return "permitted";
  if (/review|additional info|correction|routing|pending|accepted|ready for issuance/i.test(status))
    return "in_review";
  if (/initiated|scheduled|intake|screen|ready for intake|published/i.test(status))
    return "early_proposal";
  return "uncertain";
}

function sourceLink(row, source) {
  try {
    const raw = typeof row.link === "string" ? row.link : row.link?.url;
    const url = new URL(raw);
    if (
      url.protocol === "https:" &&
      ["services.seattle.gov", "data.seattle.gov", "cos-data.seattle.gov"].includes(
        url.hostname,
      )
    )
      return url.href;
  } catch {}
  return `https://data.seattle.gov/resource/${source.id}.json?${new URLSearchParams({ permitnum: String(row.permitnum) })}`;
}

function referencedIds(row) {
  const values = [row.relatedmup, row.parentpermitnum];
  const matches = String(row.description || "").match(/\b\d{7}-(?:CN|LU|DM|EG)\b/gi) || [];
  return [...new Set([...values, ...matches].filter(Boolean).map((x) => String(x).toUpperCase()))];
}

export function normalizeSourceRow(source, row, postalCode, now = new Date()) {
  if (String(row.originalzip || "").slice(0, 5) !== postalCode || !row.permitnum)
    return null;
  const classification = classify(row);
  if (!classification || !relevant(row)) return null;
  const status = String(row.statuscurrent || "").trim();
  const eventAt = usableDate(
    row.statusdate || row.decisiondate || row.issueddate || row.applieddate,
    now,
  );
  return {
    sourceId: source.id,
    sourceName: source.name,
    externalId: String(row.permitnum).toUpperCase(),
    postalCode,
    displayAddress: String(row.originaladdress1 || "Address not supplied").trim(),
    normalizedAddress: normalizeAddress(row.originaladdress1),
    description: String(row.description || "No description supplied").trim(),
    originalStatus: status,
    stage: normalizedStage(status),
    category: projectCategory(row),
    eventAt,
    unitsAdded: number(row.housingunitsadded),
    unitsRemoved: number(row.housingunitsremoved),
    stories: number(row.numberofstories || row.stories),
    ...coordinates(row),
    references: referencedIds(row),
    url: sourceLink(row, source),
    raw: row,
  };
}

function wordSet(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z0-9]{3,}/g)
      ?.filter((x) => !["the", "and", "for", "with", "per", "plan"].includes(x)) || [],
  );
}

function similarity(a, b) {
  const left = wordSet(a);
  const right = wordSet(b);
  if (!left.size || !right.size) return 0;
  const shared = [...left].filter((x) => right.has(x)).length;
  return shared / new Set([...left, ...right]).size;
}

function freshness(eventAt, now) {
  if (!eventAt) return "unknown";
  const days = (now.getTime() - new Date(eventAt).getTime()) / 86400000;
  if (days <= 730) return "current";
  if (days <= 1095) return "aging";
  return "stale";
}

function scaleBand(units, description) {
  if ((units ?? 0) >= 50 || /(?:[6-9]|\d{2})[ -]?stor/i.test(description)) return "major";
  if ((units ?? 0) >= 10 || /mixed.use|apartment|commercial|institution/i.test(description))
    return "notable";
  return "local";
}

function priority(stage, freshnessValue, scale, confidence, category) {
  const freshnessWeight = { current: 28, aging: 12, unknown: 2, stale: 0 }[freshnessValue];
  const scaleWeight = { major: 25, notable: 16, local: 6 }[scale];
  const categoryWeight = category === "demolition" ? -14 : 0;
  return Math.round(
    (ACTIVE_STAGE_WEIGHT[stage] || 0) +
      freshnessWeight +
      scaleWeight +
      confidence * 12 +
      categoryWeight,
  );
}

function projectId(records) {
  return `project_${createHash("sha1")
    .update(records.map((x) => `${x.sourceId}:${x.externalId}`).sort().join("|"))
    .digest("hex")
    .slice(0, 16)}`;
}

export function buildProjects(records, { now = new Date() } = {}) {
  const byId = new Map(records.map((record, index) => [record.externalId, index]));
  const parent = records.map((_, index) => index);
  const reason = records.map(() => ({ type: "primary", confidence: 1 }));
  const root = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const join = (a, b, type, confidence) => {
    const ra = root(a);
    const rb = root(b);
    if (ra === rb) return;
    parent[rb] = ra;
    reason[b] = { type, confidence };
  };

  records.forEach((record, index) => {
    for (const reference of record.references) {
      const other = byId.get(reference);
      if (other !== undefined) join(index, other, "explicit_reference", 1);
    }
  });

  const byAddress = new Map();
  records.forEach((record, index) => {
    if (!record.normalizedAddress) return;
    const peers = byAddress.get(record.normalizedAddress) || [];
    for (const peer of peers) {
      const other = records[peer];
      if (
        record.category === other.category &&
        similarity(record.description, other.description) >= 0.55
      )
        join(index, peer, "address_description", 0.72);
    }
    peers.push(index);
    byAddress.set(record.normalizedAddress, peers);
  });

  const groups = new Map();
  records.forEach((record, index) => {
    const key = root(index);
    const group = groups.get(key) || [];
    group.push({ record, relationship: reason[index] });
    groups.set(key, group);
  });

  return [...groups.values()].map((group) => {
    const sorted = [...group].sort((a, b) => {
      const stage = (ACTIVE_STAGE_WEIGHT[b.record.stage] || 0) - (ACTIVE_STAGE_WEIGHT[a.record.stage] || 0);
      if (stage) return stage;
      return String(b.record.eventAt || "").localeCompare(String(a.record.eventAt || ""));
    });
    const primary = sorted[0].record;
    const dates = group.map((x) => x.record.eventAt).filter(Boolean).sort();
    const lastActivityAt = dates.at(-1) || null;
    const freshnessValue = freshness(lastActivityAt, now);
    const maxUnits = Math.max(
      ...group.map((x) => x.record.unitsAdded ?? 0),
      0,
    );
    const scale = scaleBand(maxUnits || null, primary.description);
    const confidence = Math.min(...group.map((x) => x.relationship.confidence));
    const visible =
      freshnessValue === "current" ||
      (freshnessValue === "aging" && ["major", "notable"].includes(scale));
    return {
      id: projectId(group.map((x) => x.record)),
      postalCode: primary.postalCode,
      normalizedAddress: primary.normalizedAddress || null,
      displayAddress: primary.displayAddress,
      latitude: primary.latitude,
      longitude: primary.longitude,
      category: primary.category,
      stage: primary.stage,
      originalStatus: primary.originalStatus,
      lastActivityAt,
      unitsAdded: maxUnits || null,
      unitsRemoved: Math.max(...group.map((x) => x.record.unitsRemoved ?? 0), 0) || null,
      stories: Math.max(...group.map((x) => x.record.stories ?? 0), 0) || null,
      scaleBand: scale,
      freshness: freshnessValue,
      evidenceConfidence: confidence,
      basePriority: priority(
        primary.stage,
        freshnessValue,
        scale,
        confidence,
        primary.category,
      ),
      visible,
      summary: primary.description,
      records: group.map(({ record, relationship }) => ({ ...record, relationship })),
    };
  });
}
