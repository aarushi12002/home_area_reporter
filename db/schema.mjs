import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const serviceAreas = pgTable("service_areas", {
  postalCode: text("postal_code").primaryKey(),
  jurisdiction: text("jurisdiction").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
  readiness: text("readiness").notNull().default("pending"),
  bounds: jsonb("bounds"),
  geographyProvenance: jsonb("geography_provenance"),
  generation: text("generation"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  successfulRefreshes: integer("successful_refreshes").notNull().default(0),
});

export const jurisdictions = pgTable("jurisdictions", {
  id: text("id").primaryKey(), name: text("name").notNull(), region: text("region").notNull(), countryCode: text("country_code").notNull().default("US"),
});
export const serviceAreaJurisdictions = pgTable("service_area_jurisdictions", {
  postalCode: text("postal_code").notNull().references(() => serviceAreas.postalCode),
  jurisdictionId: text("jurisdiction_id").notNull().references(() => jurisdictions.id),
  coverageScope: text("coverage_scope").notNull().default("municipal_records_only"),
}, (table) => [primaryKey({ columns: [table.postalCode, table.jurisdictionId] })]);

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  datasetId: text("dataset_id").notNull(),
  termsUrl: text("terms_url"),
  enabled: boolean("enabled").notNull().default(true),
  jurisdictionId: text("jurisdiction_id").references(() => jurisdictions.id),
  adapter: text("adapter").notNull().default("seattle-socrata"),
  capabilities: jsonb("capabilities").notNull().default(["permits"]),
});

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    postalCode: text("postal_code")
      .notNull()
      .references(() => serviceAreas.postalCode),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: text("status").notNull(),
    recordsReceived: integer("records_received").notNull().default(0),
    error: text("error"),
    sourceAsOf: timestamp("source_as_of", { withTimezone: true }),
    batchId: text("batch_id").references(() => ingestionBatches.id, { onDelete: "set null" }),
  },
  (table) => [index("sync_runs_area_started_idx").on(table.postalCode, table.startedAt)],
);

export const sourceRecords = pgTable(
  "source_records",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(),
    postalCode: text("postal_code")
      .notNull()
      .references(() => serviceAreas.postalCode),
    normalizedAddress: text("normalized_address"),
    sourceStatus: text("source_status"),
    sourceEventAt: timestamp("source_event_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
    lastSeenRunId: text("last_seen_run_id").references(() => syncRuns.id),
    contentHash: text("content_hash").notNull(),
    rawPayload: jsonb("raw_payload").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.externalId] }),
    index("source_records_area_idx").on(table.postalCode),
    index("source_records_address_idx").on(table.normalizedAddress),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    jurisdictionId: text("jurisdiction_id").references(() => jurisdictions.id),
    postalCode: text("postal_code")
      .notNull()
      .references(() => serviceAreas.postalCode),
    normalizedAddress: text("normalized_address"),
    displayAddress: text("display_address").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    category: text("category").notNull(),
    stage: text("stage").notNull(),
    originalStatus: text("original_status"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    unitsAdded: integer("units_added"),
    unitsRemoved: integer("units_removed"),
    stories: integer("stories"),
    scaleBand: text("scale_band").notNull(),
    freshness: text("freshness").notNull(),
    evidenceConfidence: doublePrecision("evidence_confidence").notNull(),
    basePriority: integer("base_priority").notNull(),
    visible: boolean("visible").notNull(),
    summary: text("summary").notNull(),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("projects_area_visible_priority_idx").on(
      table.postalCode,
      table.visible,
      table.basePriority,
    ),
    index("projects_area_page_idx").on(table.postalCode, table.visible, table.basePriority.desc(), table.lastActivityAt.desc().nullsLast(), table.id),
    index("projects_location_idx").on(table.latitude, table.longitude),
  ],
);

export const ingestionBatches = pgTable("ingestion_batches", {
  id: text("id").primaryKey(),
  jurisdictionId: text("jurisdiction_id").notNull().references(() => jurisdictions.id),
  status: text("status").notNull(), attempt: integer("attempt").notNull().default(1),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }), leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  result: jsonb("result"), error: text("error"),
}, (table) => [uniqueIndex("ingestion_batch_active_idx").on(table.jurisdictionId).where(sql`${table.status} = 'running'`)]);
export const batchSourceRuns = pgTable("batch_source_runs", {
  batchId: text("batch_id").notNull().references(() => ingestionBatches.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull().references(() => sources.id),
  status: text("status").notNull(), recordsReceived: integer("records_received").notNull().default(0),
  accepted: integer("accepted").notNull().default(0), quarantined: integer("quarantined").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }), error: text("error"),
}, (table) => [primaryKey({ columns: [table.batchId, table.sourceId] })]);
export const stagedSourceRecords = pgTable("staged_source_records", {
  batchId: text("batch_id").notNull().references(() => ingestionBatches.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull().references(() => sources.id), externalId: text("external_id").notNull(),
  postalCode: text("postal_code").notNull(), rawPayload: jsonb("raw_payload").notNull(),
}, (table) => [primaryKey({ columns: [table.batchId, table.sourceId, table.externalId] }), index("staged_source_area_idx").on(table.batchId, table.postalCode)]);
export const zipReportSnapshots = pgTable("zip_report_snapshots", {
  postalCode: text("postal_code").primaryKey().references(() => serviceAreas.postalCode),
  generation: text("generation").notNull(), schemaVersion: integer("schema_version").notNull().default(1),
  summary: jsonb("summary").notNull(), coverage: jsonb("coverage").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  batchId: text("batch_id").references(() => ingestionBatches.id, { onDelete: "set null" }),
});
export const areaBaselines = pgTable("area_baselines", {
  postalCode: text("postal_code").primaryKey(), geographyType: text("geography_type").notNull().default("zcta"),
  vintage: text("vintage").notNull(), metrics: jsonb("metrics").notNull(), provenance: jsonb("provenance").notNull(),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
});
export const quarantinedSourceRecords = pgTable("quarantined_source_records", {
  batchId: text("batch_id").notNull().references(() => ingestionBatches.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull().references(() => sources.id),
  rowIndex: integer("row_index").notNull(), reason: text("reason").notNull(), rawPayload: jsonb("raw_payload").notNull(),
}, (table) => [primaryKey({ columns: [table.batchId, table.sourceId, table.rowIndex] })]);

export const projectRecords = pgTable(
  "project_records",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    externalId: text("external_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    matchConfidence: doublePrecision("match_confidence").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.sourceId, table.externalId] }),
  ],
);

export const projectEvents = pgTable(
  "project_events",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    externalId: text("external_id").notNull(),
    eventType: text("event_type").notNull(),
    eventAt: timestamp("event_at", { withTimezone: true }),
    description: text("description").notNull(),
    sourceUrl: text("source_url").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.projectId, table.sourceId, table.externalId, table.eventType],
    }),
    index("project_events_project_date_idx").on(table.projectId, table.eventAt),
  ],
);
