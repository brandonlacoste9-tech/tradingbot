import type {
  ChatResponse,
  ConnectionInfo,
  HealthInfo,
  JournalEntry,
  PositionRow,
  TradeProposal,
} from "./types";

const BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

/** Tenant id for AUTH_MODE=disabled. Overridden by Clerk JWT when enabled. */
let demoUserId =
  (typeof window !== "undefined" &&
    window.localStorage.getItem("tradingbot_user_id")) ||
  "demo";

let authToken: string | null = null;
/** Optional async token provider (Clerk getToken) so requests wait for a fresh JWT. */
let tokenProvider: (() => Promise<string | null>) | null = null;

export function setDemoUserId(id: string) {
  demoUserId = id || "demo";
  if (typeof window !== "undefined") {
    window.localStorage.setItem("tradingbot_user_id", demoUserId);
  }
}

export function getDemoUserId() {
  return demoUserId;
}

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setTokenProvider(fn: (() => Promise<string | null>) | null) {
  tokenProvider = fn;
}

export function getApiBase() {
  return BASE;
}

async function resolveToken(): Promise<string | null> {
  if (tokenProvider) {
    try {
      const t = await tokenProvider();
      if (t) {
        authToken = t;
        return t;
      }
    } catch {
      /* fall through */
    }
  }
  return authToken;
}

function authHeaders(token: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) {
    h.Authorization = `Bearer ${token}`;
  } else if (!clerkEnabled) {
    h["X-User-Id"] = demoUserId;
  }
  return h;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await resolveToken();
  if (clerkEnabled && !token && path !== "/health") {
    throw new Error("Sign in required — API is in Clerk mode (missing session token).");
  }

  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      mode: "cors",
      credentials: "omit",
      headers: {
        ...authHeaders(token),
        ...(init?.headers || {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "network error";
    throw new Error(
      `Failed to reach API at ${BASE}${path} (${msg}). ` +
        `If this is a cold start, wait ~30s and retry. Check NEXT_PUBLIC_API_URL and CORS.`
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail =
        typeof body.detail === "string"
          ? body.detail
          : body.detail
            ? JSON.stringify(body.detail)
            : JSON.stringify(body);
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      throw new Error(
        `Auth failed (401): ${detail}. Sign out/in if your session expired.`
      );
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function health() {
  // Health is public — allow without Clerk token
  return fetch(`${BASE}/health`, {
    mode: "cors",
    credentials: "omit",
    headers: { Accept: "application/json" },
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Health ${res.status}`);
    return res.json() as Promise<HealthInfo>;
  });
}

export function me() {
  return req<{
    user_id: string;
    clerk_id?: string | null;
    email?: string | null;
    auth_mode: string;
    plan: string;
  }>("/me");
}

export function validateConnection() {
  return req<ConnectionInfo>("/connection/validate", { method: "POST" });
}

export function chat(message: string) {
  return req<ChatResponse>("/agent/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function confirmProposal(proposal_id: string) {
  return req<{ proposal: TradeProposal; order: unknown; broker: unknown }>(
    "/proposals/confirm",
    {
      method: "POST",
      body: JSON.stringify({ proposal_id }),
    }
  );
}

export function rejectProposal(proposal_id: string, reason?: string) {
  return req<TradeProposal>("/proposals/reject", {
    method: "POST",
    body: JSON.stringify({ proposal_id, reason }),
  });
}

export function listJournal() {
  return req<{ entries: JournalEntry[]; user_id?: string }>("/journal");
}

export function listProposals() {
  return req<{ proposals: TradeProposal[] }>("/proposals");
}

export function createProposal(body: {
  symbol: string;
  side: "buy" | "sell";
  qty: string | number;
  order_type?: "limit" | "market";
  limit_price?: string | number | null;
  reason?: string;
}) {
  return req<{
    proposal: TradeProposal;
    confirm_ttl_seconds: number;
    user_id: string;
    note?: string;
  }>("/proposals/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function marketQuote(symbol: string) {
  return req<{
    symbol: string;
    price: string;
    source: string;
    paper: boolean;
  }>(`/market/quote?symbol=${encodeURIComponent(symbol)}`);
}

export function marketQuotes(symbols: string[]) {
  const q = symbols.map((s) => s.trim().toUpperCase()).filter(Boolean).join(",");
  return req<{
    quotes: {
      symbol: string;
      name?: string | null;
      price: string | null;
      change?: string | null;
      change_percent?: string | null;
      source: string | null;
      ok: boolean;
      error?: string;
    }[];
    paper: boolean;
  }>(`/market/quotes?symbols=${encodeURIComponent(q)}`);
}

export function marketBars(
  symbol: string,
  timeframe: "1Day" | "1Month" = "1Day",
  limit?: number
) {
  const lim =
    limit ?? (timeframe === "1Month" ? 22 : 60);
  const qs = new URLSearchParams({
    symbol,
    timeframe,
    limit: String(lim),
  });
  return req<{
    symbol: string;
    timeframe: string;
    bars: { t?: string | number | null; o: number; h: number; l: number; c: number; v?: number | null }[];
    source?: string | null;
    count: number;
    fetched_at?: string;
    error?: string;
    paper?: boolean;
  }>(`/market/bars?${qs.toString()}`);
}

export function marketSession() {
  return req<{
    ok: boolean;
    now_utc: string;
    us_rth_open: boolean;
    label: string;
  }>("/market/session");
}

export function listOrders() {
  return req<{ orders: Record<string, unknown>[]; user_id?: string }>("/orders");
}

export function paperReset(starting_cash: number = 100_000) {
  return req<{
    ok: boolean;
    account: Record<string, string>;
    message: string;
    user_id: string;
  }>("/paper/reset", {
    method: "POST",
    body: JSON.stringify({ starting_cash }),
  });
}

export function portfolio() {
  return req<{
    account: Record<string, string> | null;
    positions: PositionRow[];
    source: string;
    error?: string;
    user_id?: string;
    paper?: boolean;
    day_pnl?: string;
    day_pnl_pct?: string;
  }>("/portfolio");
}

export function billingStatus() {
  return req<{
    user_id: string;
    plan: string;
    limits: { label?: string; chat_per_day?: number; price_cad?: number };
    usage?: {
      used: number;
      limit: number;
      remaining?: number;
      allowed?: boolean;
      plan?: string;
    };
    stripe_configured: boolean;
    stripe_customer_id?: string | null;
    subscription_status?: string | null;
    plans?: Record<
      string,
      { label: string; chat_per_day: number; price_cad: number }
    >;
    service?: {
      chat_blocked?: boolean;
      block_reason?: string | null;
      llm_circuit?: string;
    };
  }>("/billing/status");
}

export function billingCheckout(
  success_url?: string,
  cancel_url?: string,
  plan: "pro" | "pro_plus" = "pro"
) {
  return req<{ id: string; url: string; plan?: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ success_url, cancel_url, plan }),
  });
}

export function billingPortal(return_url?: string) {
  return req<{ url: string }>("/billing/portal", {
    method: "POST",
    body: JSON.stringify({ return_url }),
  });
}

export function billingDevSetPlan(plan: string) {
  return req<{ user_id: string; plan: string }>("/billing/dev-set-plan", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}
