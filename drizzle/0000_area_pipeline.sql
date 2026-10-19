CREATE TABLE IF NOT EXISTS service_areas (
  postal_code text PRIMARY KEY,
  jurisdiction text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  launched_at timestamptz
);

CREATE TABLE IF NOT EXISTS sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  jurisdiction text NOT NULL,
  dataset_id text NOT NULL,
  terms_url text,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES sources(id),
  postal_code text NOT NULL REFERENCES service_areas(postal_code),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL,
  records_received integer NOT NULL DEFAULT 0,
  error text,
  source_as_of timestamptz
);
CREATE INDEX IF NOT EXISTS sync_runs_area_started_idx ON sync_runs(postal_code, started_at);

CREATE TABLE IF NOT EXISTS source_records (
  source_id text NOT NULL REFERENCES sources(id),
  external_id text NOT NULL,
  postal_code text NOT NULL REFERENCES service_areas(postal_code),
  normalized_address text,
  source_status text,
  source_event_at timestamptz,
  source_updated_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  last_seen_run_id text REFERENCES sync_runs(id),
  content_hash text NOT NULL,
  raw_payload jsonb NOT NULL,
  PRIMARY KEY (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS source_records_area_idx ON source_records(postal_code);
CREATE INDEX IF NOT EXISTS source_records_address_idx ON source_records(normalized_address);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  postal_code text NOT NULL REFERENCES service_areas(postal_code),
  normalized_address text,
  display_address text NOT NULL,
  latitude double precision,
  longitude double precision,
  category text NOT NULL,
  stage text NOT NULL,
  original_status text,
  last_activity_at timestamptz,
  units_added integer,
  units_removed integer,
  stories integer,
  scale_band text NOT NULL,
  freshness text NOT NULL,
  evidence_confidence double precision NOT NULL,
  base_priority integer NOT NULL,
  visible boolean NOT NULL,
  summary text NOT NULL,
  refreshed_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_area_visible_priority_idx ON projects(postal_code, visible, base_priority DESC);
CREATE INDEX IF NOT EXISTS projects_location_idx ON projects(latitude, longitude);

CREATE TABLE IF NOT EXISTS project_records (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  external_id text NOT NULL,
  relationship_type text NOT NULL,
  match_confidence double precision NOT NULL,
  PRIMARY KEY (project_id, source_id, external_id),
  FOREIGN KEY (source_id, external_id) REFERENCES source_records(source_id, external_id)
);

CREATE TABLE IF NOT EXISTS project_events (
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  external_id text NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz,
  description text NOT NULL,
  source_url text NOT NULL,
  PRIMARY KEY (project_id, source_id, external_id, event_type),
  FOREIGN KEY (source_id, external_id) REFERENCES source_records(source_id, external_id)
);
CREATE INDEX IF NOT EXISTS project_events_project_date_idx ON project_events(project_id, event_at DESC);

INSERT INTO service_areas (postal_code, jurisdiction, enabled, launched_at)
VALUES
  ('98101', 'Seattle', true, now()),
  ('98102', 'Seattle', true, now()),
  ('98103', 'Seattle', true, now()),
  ('98104', 'Seattle', true, now()),
  ('98105', 'Seattle', true, now())
ON CONFLICT (postal_code) DO NOTHING;

INSERT INTO sources (id, name, jurisdiction, dataset_id, terms_url, enabled)
VALUES
  ('76t5-zqzr', 'Seattle Building Permits', 'Seattle', '76t5-zqzr', 'https://data.seattle.gov/d/76t5-zqzr', true),
  ('ht3q-kdvx', 'Seattle Land Use Permits', 'Seattle', 'ht3q-kdvx', 'https://data.seattle.gov/d/ht3q-kdvx', true)
ON CONFLICT (id) DO NOTHING;
