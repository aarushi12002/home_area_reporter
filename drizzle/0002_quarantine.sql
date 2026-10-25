CREATE TABLE quarantined_source_records (
  batch_id text NOT NULL REFERENCES ingestion_batches(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id),
  row_index integer NOT NULL,
  reason text NOT NULL,
  raw_payload jsonb NOT NULL,
  PRIMARY KEY (batch_id, source_id, row_index)
);
CREATE INDEX staged_source_area_idx ON staged_source_records(batch_id, postal_code);
