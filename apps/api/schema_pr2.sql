-- PR2: multi-tenant persistence (user-scoped paper books + journals)
-- Safe to run after schema.sql or standalone on empty DB.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE,
  email TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_accounts (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  cash NUMERIC(20, 8) NOT NULL DEFAULT 100000,
  starting_cash NUMERIC(20, 8) NOT NULL DEFAULT 100000,
  marks_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_orders_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_positions (
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  qty NUMERIC(20, 8) NOT NULL DEFAULT 0,
  avg_entry NUMERIC(20, 8) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS trade_proposals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  qty TEXT NOT NULL,
  order_type TEXT NOT NULL,
  limit_price TEXT,
  reason TEXT NOT NULL,
  policy_status TEXT NOT NULL,
  client_order_id TEXT NOT NULL,
  rejection_reason TEXT,
  expires_at TIMESTAMPTZ,
  impact JSONB,
  broker_order_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_proposals_user_client
  ON trade_proposals (user_id, client_order_id);

CREATE INDEX IF NOT EXISTS ix_proposals_user_created
  ON trade_proposals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS paper_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  proposal_id TEXT,
  client_order_id TEXT NOT NULL,
  broker_order_id TEXT,
  status TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_orders_user_created
  ON paper_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS journals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary_md TEXT NOT NULL,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_journals_user_created
  ON journals (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_audit_user_created
  ON audit_events (user_id, created_at DESC);
