import { getDatabase, hasDatabaseConfig } from "./db.mjs";
import { areaSummary, rankProjects } from "./ranking.mjs";

export async function supportedArea(zip) {
  if (!hasDatabaseConfig()) return false;
  const { sql } = getDatabase();
  const rows = await sql`
    SELECT postal_code
    FROM service_areas
    WHERE postal_code = ${zip} AND enabled = true
    LIMIT 1
  `;
  return rows.length === 1;
}

export async function areaIngested(zip) {
  const { sql } = getDatabase();
  const rows = await sql`
    SELECT 1
    FROM sync_runs
    WHERE postal_code = ${zip} AND status = 'succeeded'
    LIMIT 1
  `;
  return rows.length === 1;
}

export async function areaCoverage(zip) {
  const { sql } = getDatabase();
  const rows = await sql`
    SELECT
      s.id,
      s.name,
      s.terms_url AS url,
      latest.status,
      latest.completed_at AS refreshed_at,
      latest.records_received,
      latest.error
    FROM sources s
    LEFT JOIN LATERAL (
      SELECT status, completed_at, records_received, error
      FROM sync_runs
      WHERE source_id = s.id AND postal_code = ${zip}
      ORDER BY started_at DESC
      LIMIT 1
    ) latest ON true
    WHERE s.enabled = true
    ORDER BY s.name
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status || "not_ingested",
    refreshedAt: row.refreshed_at?.toISOString?.() || row.refreshed_at,
    recordsReceived: Number(row.records_received || 0),
    error: row.error,
  }));
}

export async function projectsForArea(zip, { includeHidden = false } = {}) {
  const { sql } = getDatabase();
  const rows = await sql`
    SELECT
      p.*,
      COUNT(DISTINCT (pr.source_id, pr.external_id))::integer AS evidence_count,
      MIN(pe.source_url) AS source_url
    FROM projects p
    LEFT JOIN project_records pr ON pr.project_id = p.id
    LEFT JOIN project_events pe ON pe.project_id = p.id
    WHERE p.postal_code = ${zip}
      AND (${includeHidden} OR p.visible = true)
    GROUP BY p.id
    ORDER BY p.base_priority DESC, p.last_activity_at DESC NULLS LAST
  `;
  return rows.map(fromDatabaseProject);
}

function fromDatabaseProject(row) {
  return {
    id: row.id,
    postalCode: row.postal_code,
    normalizedAddress: row.normalized_address,
    displayAddress: row.display_address,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    category: row.category,
    stage: row.stage,
    originalStatus: row.original_status,
    lastActivityAt: row.last_activity_at?.toISOString?.() || row.last_activity_at,
    unitsAdded: row.units_added,
    unitsRemoved: row.units_removed,
    stories: row.stories,
    scaleBand: row.scale_band,
    freshness: row.freshness,
    evidenceConfidence: Number(row.evidence_confidence),
    basePriority: Number(row.base_priority),
    visible: row.visible,
    summary: row.summary,
    refreshedAt: row.refreshed_at?.toISOString?.() || row.refreshed_at,
    evidenceCount: Number(row.evidence_count || 0),
    sourceUrl: row.source_url,
  };
}

export async function databaseAreaSummary(zip, options = {}) {
  const projects = await projectsForArea(zip);
  const summary = areaSummary(projects, { zip, ...options });
  const latest = projects
    .map((x) => x.refreshedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  return { ...summary, dataSource: "database", refreshedAt: latest || null };
}

export async function paginatedProjects(
  zip,
  { cursor = 0, limit = 20, location = null, includeHidden = false } = {},
) {
  const projects = rankProjects(
    await projectsForArea(zip, { includeHidden }),
    location,
  );
  const start = Math.max(0, Number(cursor) || 0);
  const size = Math.min(50, Math.max(1, Number(limit) || 20));
  const items = projects.slice(start, start + size);
  return {
    zip,
    items,
    nextCursor: start + size < projects.length ? String(start + size) : null,
    total: projects.length,
  };
}

export async function projectDetail(id) {
  const { sql } = getDatabase();
  const rows = await sql`
    SELECT p.*, COUNT(pr.external_id)::integer AS evidence_count
    FROM projects p
    LEFT JOIN project_records pr ON pr.project_id = p.id
    WHERE p.id = ${id}
    GROUP BY p.id
    LIMIT 1
  `;
  if (!rows.length) return null;
  const events = await sql`
    SELECT source_id, external_id, event_type, event_at, description, source_url
    FROM project_events
    WHERE project_id = ${id}
    ORDER BY event_at DESC NULLS LAST, external_id
  `;
  return {
    ...fromDatabaseProject(rows[0]),
    events: events.map((event) => ({
      sourceId: event.source_id,
      externalId: event.external_id,
      type: event.event_type,
      date: event.event_at?.toISOString?.() || event.event_at,
      description: event.description,
      url: event.source_url,
    })),
  };
}
