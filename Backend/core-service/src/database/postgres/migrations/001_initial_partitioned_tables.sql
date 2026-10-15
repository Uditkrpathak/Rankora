-- ============================================================================
-- Localo Rank Tracker — Phase 4 PostgreSQL Schema
-- Partitioned ranking_history + scan_runs tables
-- ============================================================================

-- Extensions for high-performance indexing and UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ----------------------------------------------------------------------------
-- 1. SCAN RUNS (Aggregate Job Telemetry & Scan Metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scan_runs (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  grid_size INT NOT NULL DEFAULT 3,
  point_count INT NOT NULL DEFAULT 9,
  radius_km NUMERIC(6, 2) NOT NULL DEFAULT 5.0,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  metrics JSONB,
  grid_spec JSONB,
  cost_usd NUMERIC(10, 4) DEFAULT 0.0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_runs_workspace_location 
  ON scan_runs (workspace_id, location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_runs_workspace_created 
  ON scan_runs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scan_runs_idempotency 
  ON scan_runs (workspace_id, idempotency_key);

-- ----------------------------------------------------------------------------
-- 2. RANKING HISTORY (Range-Partitioned by created_at monthly)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ranking_history (
  idempotency_hash VARCHAR(64) NOT NULL,
  scan_id VARCHAR(64) NOT NULL,
  workspace_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  cell_id VARCHAR(32) NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  row INT NOT NULL,
  col INT NOT NULL,
  pin_index INT,
  rank INT,
  target_rank INT,
  is_target BOOLEAN NOT NULL DEFAULT FALSE,
  found BOOLEAN NOT NULL DEFAULT FALSE,
  observation_state VARCHAR(32) NOT NULL DEFAULT 'OBSERVED',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider VARCHAR(64),
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INT,
  error TEXT,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Composite unique index covering idempotency_hash and partition key created_at
CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_history_idempotency_created 
  ON ranking_history (idempotency_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_ranking_history_workspace_loc_created 
  ON ranking_history (workspace_id, location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ranking_history_cell_created 
  ON ranking_history (cell_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ranking_history_scan_id 
  ON ranking_history (scan_id);

-- Catch-all default partition to prevent insertion errors when date bounds are exceeded
CREATE TABLE IF NOT EXISTS ranking_history_default 
  PARTITION OF ranking_history DEFAULT;
