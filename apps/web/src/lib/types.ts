/** Matches backend policy_status enum exactly. */
export type PolicyStatus =
  | "proposed"
  | "policy_rejected"
  | "awaiting_confirm"
  | "confirmed"
  | "submitted"
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
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  summary_md: string;
  decisions: unknown[];
  created_at: string;
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
}
