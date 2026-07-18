import type { ChatResponse, ConnectionInfo, JournalEntry, TradeProposal } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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
  return req<{ ok: boolean; paper_only: boolean; confirm_ttl_seconds: number }>("/health");
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
  return req<{ entries: JournalEntry[] }>("/journal");
}

export function listProposals() {
  return req<{ proposals: TradeProposal[] }>("/proposals");
}

export function portfolio() {
  return req<{
    account: Record<string, string> | null;
    positions: unknown[];
    source: string;
    error?: string;
  }>("/portfolio");
}
