ALTER TABLE jurisdictions ADD COLUMN state text NOT NULL DEFAULT 'WA';
ALTER TABLE jurisdictions ADD COLUMN kind text NOT NULL DEFAULT 'city';
ALTER TABLE jurisdictions ADD COLUMN source_status text NOT NULL DEFAULT 'needs_source_review';
ALTER TABLE service_areas ADD COLUMN state text NOT NULL DEFAULT 'WA';

CREATE TABLE jurisdiction_report_partitions (
  postal_code text NOT NULL REFERENCES service_areas(postal_code),
  jurisdiction_id text NOT NULL REFERENCES jurisdictions(id),
  generation text NOT NULL,
  published_at timestamptz NOT NULL,
  successful_refreshes integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT false,
  coverage jsonb NOT NULL,
  PRIMARY KEY (postal_code, jurisdiction_id)
);
INSERT INTO jurisdiction_report_partitions (postal_code, jurisdiction_id, generation, published_at, successful_refreshes, enabled, coverage)
SELECT s.postal_code, 'us-wa-seattle', s.generation, s.published_at, a.successful_refreshes, a.enabled, s.coverage
FROM zip_report_snapshots s JOIN service_areas a USING (postal_code);
CREATE INDEX projects_jurisdiction_area_idx ON projects(jurisdiction_id, postal_code);
