import { buildReport } from "./report.mjs";
import { buildProjects, normalizeSourceRow } from "./project-pipeline.mjs";
import { areaSummary, rankProjects } from "./ranking.mjs";
import { civicProjectType } from "./project-details.mjs";

const cache = new Map();
const pending = new Map();
const TTL = 15 * 60 * 1000;

export async function getLiveReport(zip) {
  const existing = cache.get(zip);
  if (existing && existing.expires > Date.now()) return existing.report;
  if (!pending.has(zip)) pending.set(zip, buildReport(zip));
  try {
    const report = await pending.get(zip);
    if (report.status !== "unavailable")
      cache.set(zip, { report, expires: Date.now() + TTL });
    return report;
  } finally {
    pending.delete(zip);
  }
}

function fromLegacyReport(report) {
  const now = Date.now();
  return report.projects.map((project) => {
    const timestamp = Date.parse(project.primary.date || "");
    const ageDays = Number.isFinite(timestamp) ? (now - timestamp) / 86400000 : Infinity;
    const freshness = ageDays <= 730 ? "current" : ageDays <= 1095 ? "aging" : "stale";
    return {
      id: `live_${project.id}`,
      displayAddress: project.address,
      category: civicProjectType(project.primary.description) ? "public_facility" : "development",
      stage:
        project.primary.stage === "Permit / decision recorded"
          ? "permitted"
          : project.primary.stage === "Application / review"
            ? "in_review"
            : "uncertain",
      originalStatus: project.primary.status,
      lastActivityAt: project.primary.date,
      unitsAdded: Number(project.primary.added) || null,
      scaleBand: Number(project.primary.added) >= 10 ? "notable" : "local",
      freshness,
      evidenceConfidence: 1,
      basePriority:
        (project.primary.stage === "Permit / decision recorded" ? 40 : 30) +
        Math.min(20, Number(project.primary.added) || 0) +
        (freshness === "current" ? 25 : freshness === "aging" ? 10 : 0),
      visible: freshness !== "stale",
      summary: project.primary.description,
      evidenceCount: project.records.length,
      sourceUrl: project.primary.url,
      latitude: project.primary.latitude,
      longitude: project.primary.longitude,
    };
  });
}

export async function liveAreaSummary(zip, options = {}) {
  const report = await getLiveReport(zip);
  return {
    ...areaSummary(fromLegacyReport(report), { zip, ...options }),
    dataSource: "live_fallback",
    refreshedAt: report.generatedAt,
    sourceStatus: report.status,
  };
}

export async function liveProjects(zip, { cursor = 0, limit = 20, location = null } = {}) {
  const report = await getLiveReport(zip);
  const ranked = rankProjects(fromLegacyReport(report), location);
  const start = Math.max(0, Number(cursor) || 0);
  const size = Math.min(50, Math.max(1, Number(limit) || 20));
  return {
    zip,
    items: ranked.slice(start, start + size),
    nextCursor: start + size < ranked.length ? String(start + size) : null,
    total: ranked.length,
    sourceStatus: report.status,
    coverage: report.coverage,
    limits: report.limits,
  };
}

// Exported for deterministic tests of the same normalization used by ingestion.
export function projectsFromSourceGroups(groups, zip, now = new Date()) {
  return buildProjects(
    groups.flatMap(({ source, records }) =>
      records.map((row) => normalizeSourceRow(source, row, zip, now)).filter(Boolean),
    ),
    { now },
  );
}
