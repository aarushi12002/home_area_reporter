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
} from "drizzle-orm/pg-core";

export const serviceAreas = pgTable("service_areas", {
  postalCode: text("postal_code").primaryKey(),
  jurisdiction: text("jurisdiction").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
});

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  datasetId: text("dataset_id").notNull(),
  termsUrl: text("terms_url"),
  enabled: boolean("enabled").notNull().default(true),
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
    index("projects_location_idx").on(table.latitude, table.longitude),
  ],
);

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
