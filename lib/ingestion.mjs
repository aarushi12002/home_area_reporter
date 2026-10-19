import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "./db.mjs";
import {
  INITIAL_SERVICE_AREAS,
  buildProjects,
  normalizeAddress,
  normalizeSourceRow,
  usableDate,
} from "./project-pipeline.mjs";
import { SOURCES } from "./report.mjs";

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(source, zip, offset, options) {
  const { fetcher, pageSize, retries, deadlineMs } = options;
  const query = new URLSearchParams({
    $select: source.select,
    $where: `originalzip='${zip}' AND statuscurrent NOT IN ('Completed','Canceled','Cancelled','Expired','Withdrawn','Closed','Denied','Void')`,
    $order: "permitnum DESC, :id",
    $limit: String(pageSize),
    $offset: String(offset),
  });
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
  } = {},
) {
  const records = [];
  for (let page = 0; page < maxPages; page++) {
    const body = await fetchPage(source, zip, page * pageSize, {
      fetcher,
      pageSize,
      retries,
      deadlineMs,
    });
    records.push(...body);
    if (body.length < pageSize) return { records, complete: true };
  }
  return { records, complete: false };
}

function hashPayload(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function startRun(sql, source, zip) {
  const id = randomUUID();
  await sql`
    INSERT INTO sync_runs (id, source_id, postal_code, started_at, status)
    VALUES (${id}, ${source.id}, ${zip}, now(), 'running')
  `;
  return id;
}

async function finishRun(sql, id, status, count, error = null) {
  await sql`
    UPDATE sync_runs
    SET completed_at = now(), status = ${status}, records_received = ${count}, error = ${error}
    WHERE id = ${id}
  `;
}

async function saveSourceRecords(sql, source, zip, runId, rows, retrievedAt) {
  const normalized = rows
    .filter((row) => row.permitnum)
    .map((row) => ({
      source_id: source.id,
      external_id: String(row.permitnum).toUpperCase(),
      postal_code: zip,
      normalized_address: normalizeAddress(row.originaladdress1) || null,
      source_status: row.statuscurrent || null,
      source_event_at: usableDate(
        row.decisiondate || row.issueddate || row.applieddate,
        retrievedAt,
      ),
      source_updated_at: null,
      retrieved_at: retrievedAt.toISOString(),
      last_seen_run_id: runId,
      content_hash: hashPayload(row),
      raw_payload: JSON.stringify(row),
    }));
  await sql.begin(async (transaction) => {
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
  });
}

export async function rebuildProjects(sql, zip, now = new Date()) {
  const rows = await sql`
    SELECT source_id, raw_payload
    FROM source_records
    WHERE postal_code = ${zip}
  `;
  const sourceById = new Map(SOURCES.map((source) => [source.id, source]));
  const normalized = rows
    .map(({ source_id: sourceId, raw_payload: payload }) => {
      const source = sourceById.get(sourceId);
      return source ? normalizeSourceRow(source, payload, zip, now) : null;
    })
    .filter(Boolean);
  const projects = buildProjects(normalized, { now });
  await sql.begin(async (transaction) => {
    await transaction`DELETE FROM projects WHERE postal_code = ${zip}`;
    for (const project of projects) {
      await transaction`
        INSERT INTO projects (
          id, postal_code, normalized_address, display_address, latitude, longitude,
          category, stage, original_status, last_activity_at, units_added, units_removed,
          stories, scale_band, freshness, evidence_confidence, base_priority, visible,
          summary, refreshed_at
        ) VALUES (
          ${project.id}, ${project.postalCode}, ${project.normalizedAddress},
          ${project.displayAddress}, ${project.latitude}, ${project.longitude},
          ${project.category}, ${project.stage}, ${project.originalStatus},
          ${project.lastActivityAt}, ${project.unitsAdded}, ${project.unitsRemoved},
          ${project.stories}, ${project.scaleBand}, ${project.freshness},
          ${project.evidenceConfidence}, ${project.basePriority}, ${project.visible},
          ${project.summary}, ${now.toISOString()}
        )
      `;
      for (const record of project.records) {
        await transaction`
          INSERT INTO project_records (
            project_id, source_id, external_id, relationship_type, match_confidence
          ) VALUES (
            ${project.id}, ${record.sourceId}, ${record.externalId},
            ${record.relationship.type}, ${record.relationship.confidence}
          )
        `;
        await transaction`
          INSERT INTO project_events (
            project_id, source_id, external_id, event_type, event_at, description, source_url
          ) VALUES (
            ${project.id}, ${record.sourceId}, ${record.externalId}, ${record.stage},
            ${record.eventAt}, ${record.description}, ${record.url}
          )
        `;
      }
    }
  });
  return projects;
}

export async function ingestArea(zip, options = {}) {
  if (!INITIAL_SERVICE_AREAS.includes(zip))
    throw new Error(`Unsupported initial service area: ${zip}`);
  const { sql } = getDatabase();
  const results = [];
  for (const source of SOURCES) {
    const runId = await startRun(sql, source, zip);
    try {
      const result = await fetchAllSourceRecords(source, zip, options);
      if (!result.complete)
        throw new Error(`Safety ceiling reached after ${result.records.length} records`);
      const retrievedAt = new Date();
      await saveSourceRecords(sql, source, zip, runId, result.records, retrievedAt);
      await finishRun(sql, runId, "succeeded", result.records.length);
      results.push({ source: source.id, status: "succeeded", count: result.records.length });
    } catch (error) {
      await finishRun(sql, runId, "failed", 0, error.message);
      results.push({ source: source.id, status: "failed", error: error.message });
    }
  }
  const projects = await rebuildProjects(sql, zip);
  return { zip, sources: results, projects: projects.length };
}

export async function ingestInitialAreas(options = {}) {
  const results = [];
  for (const zip of INITIAL_SERVICE_AREAS) results.push(await ingestArea(zip, options));
  return results;
}
