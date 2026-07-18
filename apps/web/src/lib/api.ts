import type {
  ChatResponse,
  ConnectionInfo,
  HealthInfo,
  JournalEntry,
  PositionRow,
  TradeProposal,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Tenant id for AUTH_MODE=disabled. Overridden by Clerk JWT when enabled. */
let demoUserId =
  (typeof window !== "undefined" &&
    window.localStorage.getItem("tradingbot_user_id")) ||
  "demo";

let authToken: string | null = null;

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

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    h.Authorization = `Bearer ${authToken}`;
  } else {
    h["X-User-Id"] = demoUserId;
  }
  return h;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export function health() {
  return req<HealthInfo>("/health");
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

export function portfolio() {
  return req<{
    account: Record<string, string> | null;
    positions: PositionRow[];
    source: string;
    error?: string;
    user_id?: string;
  }>("/portfolio");
}
