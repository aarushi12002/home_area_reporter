CREATE TABLE jurisdictions (
  id text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  country_code text NOT NULL DEFAULT 'US'
);
INSERT INTO jurisdictions (id, name, region) VALUES ('us-wa-seattle', 'Seattle', 'greater-seattle');

ALTER TABLE service_areas ADD COLUMN readiness text NOT NULL DEFAULT 'pending';
ALTER TABLE service_areas ADD COLUMN bounds jsonb;
ALTER TABLE service_areas ADD COLUMN geography_provenance jsonb;
ALTER TABLE service_areas ADD COLUMN generation text;
ALTER TABLE service_areas ADD COLUMN published_at timestamptz;
ALTER TABLE service_areas ADD COLUMN successful_refreshes integer NOT NULL DEFAULT 0;
CREATE TABLE service_area_jurisdictions (
  postal_code text NOT NULL REFERENCES service_areas(postal_code),
  jurisdiction_id text NOT NULL REFERENCES jurisdictions(id),
  coverage_scope text NOT NULL DEFAULT 'municipal_records_only',
  PRIMARY KEY (postal_code, jurisdiction_id)
);
ALTER TABLE sources ADD COLUMN jurisdiction_id text REFERENCES jurisdictions(id);
ALTER TABLE sources ADD COLUMN adapter text NOT NULL DEFAULT 'seattle-socrata';
ALTER TABLE sources ADD COLUMN capabilities jsonb NOT NULL DEFAULT '["permits"]';
UPDATE sources SET jurisdiction_id = 'us-wa-seattle' WHERE jurisdiction = 'Seattle';
ALTER TABLE projects ADD COLUMN jurisdiction_id text REFERENCES jurisdictions(id);
UPDATE projects SET jurisdiction_id = 'us-wa-seattle';

CREATE TABLE ingestion_batches (
  id text PRIMARY KEY,
  jurisdiction_id text NOT NULL REFERENCES jurisdictions(id),
  status text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  lease_until timestamptz NOT NULL,
  result jsonb,
  error text
);
CREATE UNIQUE INDEX ingestion_batch_active_idx ON ingestion_batches(jurisdiction_id) WHERE status = 'running';
CREATE TABLE batch_source_runs (
  batch_id text NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id),
  status text NOT NULL,
  records_received integer NOT NULL DEFAULT 0,
  accepted integer NOT NULL DEFAULT 0,
  quarantined integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  error text,
  PRIMARY KEY (batch_id, source_id)
);
CREATE TABLE staged_source_records (
  batch_id text NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id),
  external_id text NOT NULL,
  postal_code text NOT NULL,
  raw_payload jsonb NOT NULL,
  PRIMARY KEY (batch_id, source_id, external_id)
);
ALTER TABLE sync_runs ADD COLUMN batch_id text REFERENCES ingestion_batches(id) ON DELETE SET NULL;
CREATE TABLE zip_report_snapshots (
  postal_code text PRIMARY KEY REFERENCES service_areas(postal_code),
  generation text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  summary jsonb NOT NULL,
  coverage jsonb NOT NULL,
  published_at timestamptz NOT NULL,
  batch_id text REFERENCES ingestion_batches(id) ON DELETE SET NULL
);
CREATE INDEX projects_area_page_idx ON projects(postal_code, visible, base_priority DESC, last_activity_at DESC NULLS LAST, id);

-- National context is independent of local permit coverage and paid access.
CREATE TABLE area_baselines (
  postal_code text PRIMARY KEY,
  geography_type text NOT NULL DEFAULT 'zcta',
  vintage text NOT NULL,
  metrics jsonb NOT NULL,
  provenance jsonb NOT NULL,
  retrieved_at timestamptz NOT NULL
);
