import { getDatabase } from "./db.mjs";
import { rankProjects } from "./ranking.mjs";
import { orderingContext, encodeCursor, decodeCursor, reportUpdated } from "./report-cursor.mjs";

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

export async function publishedSnapshot(zip, sql = getDatabase().sql) {
  const rows = await sql`SELECT s.*, a.enabled, a.readiness, a.successful_refreshes
    FROM zip_report_snapshots s JOIN service_areas a ON a.postal_code = s.postal_code
    WHERE s.postal_code = ${zip} AND a.enabled = true`;
  return rows[0] || null;
}

export async function databaseAreaSummary(zip, { location = null } = {}) {
  const { sql } = getDatabase();
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    const snapshot = await publishedSnapshot(zip, transaction);
    if (!snapshot) return null;
    const summary = { ...snapshot.summary, sourceStatus: "ready", generation: snapshot.generation, publishedAt: new Date(snapshot.published_at).toISOString(), coverage: snapshot.coverage };
    if (location) {
      const { items } = await pageQuery(transaction, zip, snapshot, { limit: 15, location });
      summary.highlights = items.map((project) => ({ ...project, address: project.displayAddress }));
    }
    const stale = Date.now() - new Date(summary.publishedAt).getTime() > 48 * 3600000;
    return { ...summary, freshness: stale ? "stale" : "current", awaitingUpdate: stale };
  });
}

async function pageQuery(sql, zip, snapshot, { cursor = "0", limit = 20, location = null, includeHidden = false } = {}) {
  const size = Math.min(50, Math.max(1, Math.trunc(Number(limit)) || 20));
  const context = orderingContext(zip, location, includeHidden);
  const last = decodeCursor(cursor, { zip, generation: snapshot.generation, context });
  const latitude = location?.latitude ?? null, longitude = location?.longitude ?? null;
  const rows = await sql`
    WITH distances AS (
      SELECT p.*, CASE WHEN ${latitude}::double precision IS NULL OR latitude IS NULL OR longitude IS NULL THEN NULL ELSE
        3958.8 * 2 * asin(sqrt(least(1.0, greatest(0.0,
          power(sin(radians(latitude - ${latitude}::double precision) / 2), 2) + cos(radians(${latitude}::double precision)) * cos(radians(latitude)) * power(sin(radians(longitude - ${longitude}::double precision) / 2), 2)
        )))) END AS distance_miles
      FROM projects p WHERE postal_code = ${zip} AND (${includeHidden} OR visible = true)
    ), ranked AS (
      SELECT *, base_priority + CASE WHEN distance_miles <= 0.25 THEN 30 WHEN distance_miles <= 0.5 THEN 24 WHEN distance_miles <= 1 THEN 17 WHEN distance_miles <= 2 THEN 8 ELSE 0 END AS score,
      COALESCE(extract(epoch FROM last_activity_at), -1000000000000000) AS activity_sort
      FROM distances
    ), page AS (
      SELECT * FROM ranked WHERE ${!last} OR score < ${last?.score ?? 0}
        OR (score = ${last?.score ?? 0} AND activity_sort < ${last?.activity ?? 0})
        OR (score = ${last?.score ?? 0} AND activity_sort = ${last?.activity ?? 0} AND id > ${last?.id ?? ""})
      ORDER BY score DESC, activity_sort DESC, id ASC LIMIT ${size + 1}
    )
    SELECT p.*, (SELECT count(*)::integer FROM project_records pr WHERE pr.project_id = p.id) AS evidence_count,
      (SELECT min(source_url) FROM project_events pe WHERE pe.project_id = p.id) AS source_url
    FROM page p ORDER BY score DESC, activity_sort DESC, id ASC`;
  const selected = rows.slice(0, size);
  const items = rankProjects(selected.map(fromDatabaseProject), location);
  const tail = selected.at(-1);
  return {
    zip, items, generation: snapshot.generation,
    nextCursor: rows.length > size ? encodeCursor({ v: 1, zip, generation: snapshot.generation, context, id: tail.id, score: Number(tail.score), activity: Number(tail.activity_sort) }) : null,
    total: includeHidden ? Number((await sql`SELECT count(*)::integer AS count FROM projects WHERE postal_code = ${zip}`)[0].count) : snapshot.summary.totalCurrentProjects,
  };
}

export async function paginatedProjects(zip, options = {}) {
  const { sql } = getDatabase();
  return sql.begin("isolation level repeatable read read only", async (transaction) => {
    const snapshot = await publishedSnapshot(zip, transaction);
    if (!snapshot) return null;
    if (options.generation && options.generation !== snapshot.generation) throw reportUpdated();
    const page = await pageQuery(transaction, zip, snapshot, options);
    return { ...page, coverage: snapshot.coverage, dataSource: "database" };
  });
}

export async function projectDetail(id, generation = null) {
  const { sql: connection } = getDatabase();
  return connection.begin("isolation level repeatable read read only", async (sql) => {
  const rows = await sql`
    SELECT p.*, COUNT(pr.external_id)::integer AS evidence_count
    FROM projects p
    JOIN service_areas a ON a.postal_code = p.postal_code AND a.enabled = true AND a.generation IS NOT NULL
    LEFT JOIN project_records pr ON pr.project_id = p.id
    WHERE p.id = ${id}
    GROUP BY p.id
    LIMIT 1
  `;
  if (!rows.length) return null;
  if (generation) {
    const snapshot = await publishedSnapshot(rows[0].postal_code, sql);
    if (snapshot?.generation !== generation) throw reportUpdated();
  }
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
  });
}
