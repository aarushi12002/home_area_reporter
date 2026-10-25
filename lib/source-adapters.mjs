import { SOURCES } from "./report.mjs";
import { normalizeSourceRow, normalizeAddress, usableDate } from "./project-pipeline.mjs";
import { fetchAllSourceRecords } from "./ingestion.mjs";
import { sourcePostalCode } from "./service-areas.mjs";

// Adapters own field/status/link interpretation. The batch runner owns storage.
// Additional jurisdictions must register a tested adapter, not reuse Seattle rules.
export function sourceAdapter(source) {
  if (source.adapter !== "seattle-socrata" || source.jurisdictionId !== "us-wa-seattle")
    throw new Error(`No verified adapter for ${source.id}`);
  return {
    source,
    postalCode: (row) => sourcePostalCode(row.originalzip),
    externalId: (row) => typeof row.permitnum === "string" && row.permitnum.trim() ? row.permitnum.trim().toUpperCase() : null,
    coordinates: (row) => ({ latitude: row.latitude == null || row.latitude === "" ? null : Number(row.latitude), longitude: row.longitude == null || row.longitude === "" ? null : Number(row.longitude) }),
    evidence: (row, now) => ({
      normalizedAddress: normalizeAddress(row.originaladdress1) || null,
      sourceStatus: row.statuscurrent || null,
      sourceEventAt: usableDate(row.decisiondate || row.issueddate || row.applieddate, now),
      sourceUpdatedAt: null,
    }),
    normalize: (row, zip, now) => normalizeSourceRow(source, row, zip, now),
    fetch: (options) => fetchAllSourceRecords(source, null, { ...options, verifyCount: true }),
  };
}

export function adaptersForJurisdiction(jurisdictionId) {
  const sources = SOURCES.filter((source) => source.jurisdictionId === jurisdictionId);
  if (!sources.length) throw new Error(`No connected permit sources for ${jurisdictionId}`);
  return sources.map(sourceAdapter);
}
