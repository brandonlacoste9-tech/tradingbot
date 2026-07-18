-- L2 paper-trading schema (refined enums + TTL + audit)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE policy_status AS ENUM (
  'proposed',
  'policy_rejected',
  'awaiting_confirm',
  'confirmed',
  'submitted',
  'filled',
  'cancelled',
  'expired'
);

CREATE TYPE order_side AS ENUM ('buy', 'sell');
CREATE TYPE order_type AS ENUM ('market', 'limit', 'stop', 'stop_limit');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  clerk_id TEXT UNIQUE,
  risk_persona TEXT DEFAULT 'balanced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE broker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker TEXT NOT NULL DEFAULT 'alpaca',
  is_paper BOOLEAN NOT NULL DEFAULT true,
  api_key_enc TEXT,
  secret_enc TEXT,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_validated TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE risk_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID,
  max_position_pct NUMERIC(8,4) NOT NULL DEFAULT 5.0,
  max_daily_loss_pct NUMERIC(8,4) NOT NULL DEFAULT 3.0,
  max_open_positions INT NOT NULL DEFAULT 10,
  allowed_order_types TEXT[] NOT NULL DEFAULT ARRAY['limit'],
  blacklisted_symbols TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  paper_only BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  strategy_template TEXT,
  watchlist JSONB NOT NULL DEFAULT '[]'::jsonb,
  schedule_cron TEXT,
  system_prompt_override TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  paper_only BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  conversation_id UUID,
  trigger TEXT NOT NULL DEFAULT 'chat',
  model_used TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  token_usage JSONB
);

CREATE TABLE tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trade_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side order_side NOT NULL,
  qty NUMERIC(18,8) NOT NULL,
  order_type order_type NOT NULL DEFAULT 'limit',
  limit_price NUMERIC(18,8),
  reason TEXT NOT NULL,
  policy_status policy_status NOT NULL DEFAULT 'proposed',
  rejection_reason TEXT,
  client_order_id TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  impact JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trade_proposals_status ON trade_proposals(policy_status);
CREATE INDEX idx_trade_proposals_user ON trade_proposals(user_id);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID UNIQUE REFERENCES trade_proposals(id) ON DELETE SET NULL,
  client_order_id TEXT NOT NULL UNIQUE,
  broker_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  filled_qty NUMERIC(18,8),
  filled_avg_price NUMERIC(18,8),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary_md TEXT NOT NULL,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  pnl_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Append-only intent: revoke UPDATE/DELETE in production via grants.
COMMENT ON TABLE audit_events IS 'Immutable audit log of prompts, policy checks, key events';
