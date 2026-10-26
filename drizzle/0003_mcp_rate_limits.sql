CREATE TABLE mcp_rate_limits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX mcp_rate_limits_expiry_idx ON mcp_rate_limits(window_start);
