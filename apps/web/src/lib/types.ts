/** Matches backend policy_status enum exactly. */
export type PolicyStatus =
  | "proposed"
  | "policy_rejected"
  | "awaiting_confirm"
  | "confirmed"
  | "submitted"
  | "working"
  | "filled"
  | "cancelled"
  | "expired";

export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop" | "stop_limit";

export interface TradeProposal {
  id: string;
  symbol: string;
  side: OrderSide;
  qty: string;
  order_type: OrderType;
  limit_price: string | null;
  reason: string;
  policy_status: PolicyStatus;
  client_order_id: string;
  rejection_reason: string | null;
  expires_at: string | null;
  impact: Record<string, unknown> | null;
  broker_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ToolResult {
  tool: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  body?: unknown;
}

export interface ChatResponse {
  assistant_text: string;
  mode: string;
  tool_results: ToolResult[];
  proposal: TradeProposal | null;
  confirm_ttl_seconds: number;
  model?: string;
  provider?: string;
  llm_enabled?: boolean;
  usage?: {
    used: number;
    limit: number;
    remaining?: number;
    plan?: string;
  };
  llm_circuit?: string;
  plan?: string;
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  summary_md: string;
  decisions: unknown[];
  created_at: string;
}

export interface HealthInfo {
  ok: boolean;
  paper_only: boolean;
  confirm_ttl_seconds: number;
  broker_backend?: string;
  llm_enabled?: boolean;
  llm_provider?: string;
  auth_mode?: string;
  sim_tenants?: number;
  tenancy?: { tenant_count: number; backend: string };
  postgres?: boolean;
  stripe_configured?: boolean;
  global_kill?: boolean;
  llm_circuit?: string;
  admin_api_configured?: boolean;
  fmp_configured?: boolean;
  alphavantage_configured?: boolean;
  massive_configured?: boolean;
  market_data?: {
    primary?: string | null;
    fmp?: { configured?: boolean; provider?: string };
    alphavantage?: { configured?: boolean; provider?: string };
    massive?: { configured?: boolean; provider?: string };
  };
  plaid?: {
    ready?: boolean;
    client_id_configured?: boolean;
    secret_configured?: boolean;
    env?: string;
  };
  version?: string;
}

export interface ConnectionInfo {
  ok: boolean;
  account_id?: string;
  equity?: string;
  cash?: string;
  buying_power?: string;
  is_paper?: boolean;
  last_validated?: string;
  status?: string;
  backend?: string;
}

export interface PositionRow {
  symbol: string;
  qty: string;
  avg_entry_price?: string;
  current_price?: string;
  unrealized_pl?: string;
  market_value?: string;
}
