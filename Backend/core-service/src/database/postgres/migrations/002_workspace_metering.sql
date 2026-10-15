CREATE TABLE IF NOT EXISTS workspace_quotas (
  workspace_id VARCHAR(64) PRIMARY KEY,
  monthly_pin_limit INT NOT NULL DEFAULT 500,
  pins_used INT NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pin_consumptions (
  id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id VARCHAR(64) NOT NULL,
  scan_id VARCHAR(64) NOT NULL,
  pins INT NOT NULL,
  grid_size VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_consumptions_ws ON pin_consumptions(workspace_id, created_at DESC);