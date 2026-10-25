import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "./db.mjs";
import {
  INITIAL_SERVICE_AREAS,
  buildProjects,
  normalizeSourceRow,
} from "./project-pipeline.mjs";
import { adaptersForJurisdiction, sourceAdapter } from "./source-adapters.mjs";
import { SEATTLE_ZIPS, SERVICE_AREAS, GEOGRAPHY_PROVENANCE, serviceArea, sectionAvailability } from "./service-areas.mjs";
import boundary from "../data/seattle-boundary.json" with { type: "json" };
import { getZipProfile } from "./zip-profile.mjs";
import { getPublicProjects } from "./public-projects.mjs";
import { areaSummary } from "./ranking.mjs";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(source, zip, offset, options) {
  const { fetcher, pageSize, retries, deadlineMs, countOnly = false } = options;
  const query = new URLSearchParams({
    $select: countOnly ? "count(*) as count" : source.select,
    $where: `${zip ? `originalzip='${zip}' AND ` : ""}statuscurrent NOT IN ('Completed','Canceled','Cancelled','Expired','Withdrawn','Closed','Denied','Void')`,
    $limit: String(pageSize),
    $offset: String(offset),
  });
  if (!countOnly) query.set("$order", "permitnum DESC, :id");
  const url = `https://data.seattle.gov/resource/${source.id}.json?${query}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    try {
      const response = await fetcher(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: process.env.SOCRATA_APP_TOKEN
          ? { "X-App-Token": process.env.SOCRATA_APP_TOKEN }
          : {},
      });
      if (!response.ok) {
        if (RETRYABLE.has(response.status) && attempt < retries) {
          await delay(250 * 2 ** attempt);
          continue;
        }
        throw new Error(`Source returned HTTP ${response.status}`);
      }
      const body = await response.json();
      if (!Array.isArray(body)) throw new Error("Unexpected source response");
      return body;
    } catch (error) {
      if (attempt >= retries || error?.name === "AbortError") throw error;
      await delay(250 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

export async function fetchAllSourceRecords(
  source,
  zip,
  {
    fetcher = fetch,
    pageSize = 500,
    maxPages = 100,
    retries = 2,
    deadlineMs = 18000,
    verifyCount = false,
  } = {},
) {
  const records = [];
  const expected = verifyCount ? await sourceCount() : null;
  async function sourceCount() {
    const body = await fetchPage(source, zip, 0, { fetcher, pageSize: 1, retries, deadlineMs, countOnly: true });
    if (body.length !== 1 || !/^\d+$/.test(String(body[0].count))) throw new Error("Invalid source count response");
    return Number(body[0].count);
  }
  for (let page = 0; page < maxPages; page++) {
    const body = await fetchPage(source, zip, page * pageSize, {
      fetcher,
      pageSize,
      retries,
      deadlineMs,
    });
    records.push(...body);
    if (body.length < pageSize) {
      if (verifyCount && (records.length !== expected || await sourceCount() !== expected)) throw new Error("Source changed during pagination; restart complete download");
      return { records, complete: true };
    }
  }
  return { records, complete: false };
}

function hashPayload(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function saveSourceRecords(sql, source, zip, runId, rows, retrievedAt, atomic = true) {
  const adapter = sourceAdapter(source);
  const normalized = rows
    .map((row) => {
      const evidence = adapter.evidence(row, retrievedAt);
      return {
      source_id: source.id,
      external_id: adapter.externalId(row),
      postal_code: zip,
      normalized_address: evidence.normalizedAddress,
      source_status: evidence.sourceStatus,
      source_event_at: evidence.sourceEventAt,
      source_updated_at: evidence.sourceUpdatedAt,
      retrieved_at: retrievedAt.toISOString(),
      last_seen_run_id: runId,
      content_hash: hashPayload(row),
      raw_payload: JSON.stringify(row),
    }; });
  const save = async (transaction) => {
    for (let index = 0; index < normalized.length; index += 250) {
      const batch = normalized.slice(index, index + 250);
      if (!batch.length) continue;
      await transaction`
        INSERT INTO source_records ${transaction(
          batch,
          "source_id",
          "external_id",
          "postal_code",
          "normalized_address",
          "source_status",
          "source_event_at",
          "source_updated_at",
          "retrieved_at",
          "last_seen_run_id",
          "content_hash",
          "raw_payload",
        )}
        ON CONFLICT (source_id, external_id) DO UPDATE SET
          postal_code = EXCLUDED.postal_code,
          normalized_address = EXCLUDED.normalized_address,
          source_status = EXCLUDED.source_status,
          source_event_at = EXCLUDED.source_event_at,
          source_updated_at = EXCLUDED.source_updated_at,
          retrieved_at = EXCLUDED.retrieved_at,
          last_seen_run_id = EXCLUDED.last_seen_run_id,
          content_hash = EXCLUDED.content_hash,
          raw_payload = EXCLUDED.raw_payload
      `;
    }
    await transaction`
      DELETE FROM source_records
      WHERE source_id = ${source.id}
        AND postal_code = ${zip}
        AND last_seen_run_id IS DISTINCT FROM ${runId}
    `;
  };
  return atomic ? sql.begin(save) : save(sql);
}

export async function replaceProjects(transaction, zip, projects, now, jurisdictionId = "us-wa-seattle") {
  await transaction`DELETE FROM projects WHERE postal_code = ${zip}`;
  const rows = projects.map((project) => ({
    id: project.id, postal_code: project.postalCode, normalized_address: project.normalizedAddress,
    display_address: project.displayAddress, latitude: project.latitude, longitude: project.longitude,
    category: project.category, stage: project.stage, original_status: project.originalStatus,
    last_activity_at: project.lastActivityAt, units_added: project.unitsAdded, units_removed: project.unitsRemoved,
    stories: project.stories, scale_band: project.scaleBand, freshness: project.freshness,
    evidence_confidence: project.evidenceConfidence, base_priority: project.basePriority, visible: project.visible,
    summary: project.summary, refreshed_at: now.toISOString(), jurisdiction_id: jurisdictionId,
  }));
  const links = projects.flatMap((project) => project.records.map((record) => ({
    project_id: project.id, source_id: record.sourceId, external_id: record.externalId,
    relationship_type: record.relationship.type, match_confidence: record.relationship.confidence,
  })));
  const events = projects.flatMap((project) => project.records.map((record) => ({
    project_id: project.id, source_id: record.sourceId, external_id: record.externalId, event_type: record.stage,
    event_at: record.eventAt, description: record.description, source_url: record.url,
  })));
  for (let i = 0; i < rows.length; i += 250) await transaction`INSERT INTO projects ${transaction(rows.slice(i, i + 250), ...Object.keys(rows[0]))}`;
  for (let i = 0; i < links.length; i += 250) await transaction`INSERT INTO project_records ${transaction(links.slice(i, i + 250), ...Object.keys(links[0]))}`;
  for (let i = 0; i < events.length; i += 250) await transaction`INSERT INTO project_events ${transaction(events.slice(i, i + 250), ...Object.keys(events[0]))}`;
}

// Compatibility entry points now share the all-source, atomic batch path.
export async function ingestArea(zip, options = {}) {
  return runIngestionBatch({ ...options, zips: [zip] });
}
export async function ingestInitialAreas(options = {}) {
  return runIngestionBatch({ ...options, zips: INITIAL_SERVICE_AREAS });
}

function ringContains([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function insideSeattle(longitude, latitude) {
  const polygons = boundary.geometry.type === "Polygon" ? [boundary.geometry.coordinates] : boundary.geometry.coordinates;
  return polygons.some(([outer, ...holes]) => ringContains([longitude, latitude], outer) && !holes.some((ring) => ringContains([longitude, latitude], ring)));
}

// Reconciliation includes quarantined source rows, never silently discards them.
export function partitionSourceRecords(adapter, records, areas = SERVICE_AREAS) {
  const accepted = new Map(areas.map((area) => [area.zip, []]));
  const quarantine = {};
  const quarantinedRows = [];
  const seen = new Set();
  for (const row of records) {
    const zip = adapter.postalCode(row), id = adapter.externalId(row);
    let reason = !id ? "missing_id" : !zip ? "invalid_zip" : !accepted.has(zip) ? "outside_registry" : null;
    const { latitude, longitude } = adapter.coordinates(row);
    if (!reason && (latitude !== null || longitude !== null)) {
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) reason = "invalid_geometry";
      else if (adapter.source.jurisdictionId === "us-wa-seattle" && !insideSeattle(longitude, latitude)) reason = "outside_jurisdiction";
    }
    if (!reason && seen.has(id)) throw new Error(`Duplicate upstream ID in ${adapter.source.id}; restart complete download`);
    if (reason) { quarantine[reason] = (quarantine[reason] || 0) + 1; quarantinedRows.push({ index: quarantinedRows.length, reason, row }); }
    else { seen.add(id); accepted.get(zip).push(row); }
  }
  return { accepted, quarantine, quarantinedRows, received: records.length, acceptedCount: seen.size, quarantinedCount: quarantinedRows.length };
}

export async function seedServiceAreas(sql) {
  for (const area of SERVICE_AREAS) {
    await sql`INSERT INTO service_areas (postal_code, jurisdiction, enabled, bounds, geography_provenance)
      VALUES (${area.zip}, 'Seattle', ${INITIAL_SERVICE_AREAS.includes(area.zip)}, ${JSON.stringify(area.bounds)}::jsonb, ${JSON.stringify(GEOGRAPHY_PROVENANCE)}::jsonb)
      ON CONFLICT (postal_code) DO UPDATE SET bounds = EXCLUDED.bounds, geography_provenance = EXCLUDED.geography_provenance`;
    await sql`INSERT INTO service_area_jurisdictions (postal_code, jurisdiction_id) VALUES (${area.zip}, ${area.jurisdictionId}) ON CONFLICT DO NOTHING`;
  }
}

async function stageRows(sql, batchId, adapter, partition) {
  const rows = [...partition.accepted].flatMap(([zip, records]) => records.map((row) => ({ batch_id: batchId, source_id: adapter.source.id, external_id: adapter.externalId(row), postal_code: zip, raw_payload: JSON.stringify(row) })));
  for (let start = 0; start < rows.length; start += 250) {
    await sql`INSERT INTO staged_source_records ${sql(rows.slice(start, start + 250), "batch_id", "source_id", "external_id", "postal_code", "raw_payload")}`;
  }
  const quarantined = partition.quarantinedRows.map(({ index, reason, row }) => ({ batch_id: batchId, source_id: adapter.source.id, row_index: index, reason, raw_payload: JSON.stringify(row) }));
  for (let start = 0; start < quarantined.length; start += 250) await sql`INSERT INTO quarantined_source_records ${sql(quarantined.slice(start, start + 250), "batch_id", "source_id", "row_index", "reason", "raw_payload")}`;
}

async function publishArea(sql, zip, adapters, batchId, now) {
  const rows = await sql`SELECT source_id, raw_payload FROM staged_source_records WHERE batch_id = ${batchId} AND postal_code = ${zip}`;
  const groups = adapters.map((adapter) => ({ adapter, records: rows.filter((row) => row.source_id === adapter.source.id).map((row) => row.raw_payload) }));
  const projects = buildProjects(groups.flatMap(({ adapter, records }) => records.map((row) => adapter.normalize(row, zip, now)).filter(Boolean)), { now });
  const profile = getZipProfile(zip, { now });
  const sections = sectionAvailability(zip, { profile, publicProjects: getPublicProjects(zip, { now }), now });
  const sectionsReady = sections.neighborhood === "ready" && sections.transit === "ready";
  const coverage = groups.map(({ adapter, records }) => ({ id: adapter.source.id, name: adapter.source.name, url: `https://data.seattle.gov/d/${adapter.source.id}`, status: "succeeded", recordsReceived: records.length, refreshedAt: now.toISOString(), error: null }));
  const summary = { ...areaSummary(projects, { zip }), dataSource: "database", sourceStatus: "ready", refreshedAt: now.toISOString(), generation: batchId, publishedAt: now.toISOString(), coveredJurisdictions: ["us-wa-seattle"], coverageScope: "municipal_records_only" };
  return sql.begin(async (transaction) => {
    await transaction`SELECT postal_code FROM service_areas WHERE postal_code = ${zip} FOR UPDATE`;
    const [lease] = await transaction`SELECT id FROM ingestion_batches WHERE id = ${batchId} AND status = 'running' AND lease_until > now() FOR SHARE`;
    if (!lease) throw new Error("Batch lease expired; publication stopped");
    // Delete links before reconciling raw rows, all inside the same transaction.
    await transaction`DELETE FROM projects WHERE postal_code = ${zip}`;
    for (const { adapter, records } of groups) {
      const runId = randomUUID();
      await transaction`INSERT INTO sync_runs (id, source_id, postal_code, started_at, completed_at, status, records_received, batch_id)
        VALUES (${runId}, ${adapter.source.id}, ${zip}, ${now.toISOString()}, ${now.toISOString()}, 'succeeded', ${records.length}, ${batchId})`;
      await saveSourceRecords(transaction, adapter.source, zip, runId, records, now, false);
    }
    await replaceProjects(transaction, zip, projects, now, adapters[0].source.jurisdictionId);
    await transaction`INSERT INTO zip_report_snapshots (postal_code, generation, summary, coverage, published_at, batch_id)
      VALUES (${zip}, ${batchId}, ${JSON.stringify(summary)}::jsonb, ${JSON.stringify(coverage)}::jsonb, ${now.toISOString()}, ${batchId})
      ON CONFLICT (postal_code) DO UPDATE SET generation = EXCLUDED.generation, summary = EXCLUDED.summary, coverage = EXCLUDED.coverage, published_at = EXCLUDED.published_at, batch_id = EXCLUDED.batch_id`;
    const [area] = await transaction`UPDATE service_areas SET generation = ${batchId}, published_at = ${now.toISOString()}, successful_refreshes = successful_refreshes + 1,
      readiness = CASE WHEN ${sectionsReady} AND successful_refreshes + 1 >= 2 THEN 'ready' ELSE 'backfilling' END,
      enabled = enabled OR (${sectionsReady} AND successful_refreshes + 1 >= 2), launched_at = COALESCE(launched_at, ${now.toISOString()})
      WHERE postal_code = ${zip} RETURNING readiness, successful_refreshes`;
    return { zip, projects: projects.length, visible: summary.totalCurrentProjects, readiness: area.readiness, successfulRefreshes: area.successful_refreshes, sections };
  });
}

// Settle every source before releasing the lease, with at most two upstream workers.
export async function settleSources(items, work) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = { status: "fulfilled", value: await work(items[index]) }; }
      catch (reason) { results[index] = { status: "rejected", reason }; }
    }
  }));
  return results;
}

export async function runIngestionBatch({ jurisdictionId = "us-wa-seattle", zips = SEATTLE_ZIPS, fetcher = fetch, sql: suppliedSql, now = new Date(), maxAttempts = 3, pageSize = 500, maxPages = 100 } = {}) {
  if (!Array.isArray(zips) || !zips.length || zips.some((zip) => serviceArea(zip)?.jurisdictionId !== jurisdictionId)) throw new Error("Unreviewed ZIP or jurisdiction");
  const sql = suppliedSql || getDatabase().sql;
  const adapters = adaptersForJurisdiction(jurisdictionId);
  await seedServiceAreas(sql);
  const storageLimit = Number(process.env.DATABASE_STORAGE_LIMIT_BYTES || 1000000000);
  const checkCapacity = async () => {
    const [usage] = await sql`SELECT pg_database_size(current_database())::bigint AS bytes`;
    if (!Number.isFinite(storageLimit) || storageLimit <= 0 || Number(usage.bytes) >= storageLimit * 0.8) throw new Error("Storage capacity gate reached; verify provider allowance before expanding");
  };
  await checkCapacity();
  // Reclaim abandoned work, then let the unique active index arbitrate writers.
  await sql`UPDATE ingestion_batches SET status = 'failed', error = 'Lease expired', completed_at = now() WHERE jurisdiction_id = ${jurisdictionId} AND status = 'running' AND lease_until <= now()`;
  const batchId = randomUUID();
  await sql`INSERT INTO ingestion_batches (id, jurisdiction_id, status, lease_until) VALUES (${batchId}, ${jurisdictionId}, 'running', now() + interval '10 minutes')`;
  let leaseLost = false;
  const heartbeat = setInterval(() => { sql`UPDATE ingestion_batches SET lease_until = now() + interval '10 minutes' WHERE id = ${batchId} AND status = 'running' AND lease_until > now() RETURNING id`.then((rows) => { if (!rows.length) leaseLost = true; }).catch(() => { leaseLost = true; }); }, 60000);
  heartbeat.unref?.();
  try {
    const results = await settleSources(adapters, async (adapter) => {
      let partition;
      await sql`INSERT INTO batch_source_runs (batch_id, source_id, status) VALUES (${batchId}, ${adapter.source.id}, 'running')`;
      try {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const downloaded = await adapter.fetch({ fetcher, pageSize, maxPages });
            if (!downloaded.complete) throw new Error("Incomplete source pagination");
            partition = partitionSourceRecords(adapter, downloaded.records);
            if (!partition.received) {
              const [previous] = await sql`SELECT count(*)::integer AS count FROM source_records WHERE source_id = ${adapter.source.id}`;
              if (previous.count) throw new Error("Unexpected empty citywide source; previous reports retained");
            }
            break;
          } catch (error) {
            if (attempt === maxAttempts) throw error;
            await sql`UPDATE ingestion_batches SET attempt = GREATEST(attempt, ${attempt + 1}) WHERE id = ${batchId}`;
            await delay(1000 * attempt);
          }
        }
        await stageRows(sql, batchId, adapter, partition);
        await sql`UPDATE batch_source_runs SET status = 'succeeded', records_received = ${partition.received}, accepted = ${partition.acceptedCount}, quarantined = ${partition.quarantinedCount}, completed_at = now() WHERE batch_id = ${batchId} AND source_id = ${adapter.source.id}`;
        return { source: adapter.source.id, received: partition.received, accepted: partition.acceptedCount, quarantine: partition.quarantine };
      } catch (error) {
        await sql`UPDATE batch_source_runs SET status = 'failed', error = ${error.message}, completed_at = now() WHERE batch_id = ${batchId} AND source_id = ${adapter.source.id}`;
        throw error;
      }
    });
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
    const partitions = results.map((result) => result.value);
    if (leaseLost) throw new Error("Batch lease lost");
    await checkCapacity();
    const areas = [];
    for (const zip of [...new Set(zips)]) { await checkCapacity(); areas.push(await publishArea(sql, zip, adapters, batchId, now)); }
    const [storage] = await sql`SELECT pg_database_size(current_database())::bigint AS bytes`;
    const result = { batchId, jurisdictionId, sources: partitions, areas, databaseBytes: Number(storage.bytes) };
    await sql`UPDATE ingestion_batches SET status = 'succeeded', completed_at = now(), result = ${JSON.stringify(result)}::jsonb WHERE id = ${batchId}`;
    await sql`DELETE FROM staged_source_records WHERE batch_id = ${batchId} OR batch_id IN (SELECT id FROM ingestion_batches WHERE status != 'running' AND completed_at < now() - interval '24 hours')`;
    await sql`DELETE FROM quarantined_source_records WHERE batch_id IN (SELECT id FROM ingestion_batches WHERE status != 'running' AND completed_at < now() - interval '24 hours')`;
    await sql`DELETE FROM sync_runs WHERE completed_at < now() - interval '30 days' AND id NOT IN (SELECT last_seen_run_id FROM source_records WHERE last_seen_run_id IS NOT NULL)`;
    await sql`DELETE FROM ingestion_batches WHERE status != 'running' AND completed_at < now() - interval '30 days'`;
    return result;
  } catch (error) {
    await sql`UPDATE ingestion_batches SET status = 'failed', completed_at = now(), error = ${error.message} WHERE id = ${batchId}`;
    throw error;
  } finally { clearInterval(heartbeat); }
}
