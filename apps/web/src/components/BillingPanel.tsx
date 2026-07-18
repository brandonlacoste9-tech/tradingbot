"use client";

import { useCallback, useEffect, useState } from "react";
import {
  billingCheckout,
  billingDevSetPlan,
  billingPortal,
  billingStatus,
} from "@/lib/api";

type Status = {
  plan: string;
  stripe_configured: boolean;
  limits: { label?: string; chat_per_day?: number; price_cad?: number };
  usage?: {
    used: number;
    limit: number;
    remaining?: number;
    allowed?: boolean;
  };
  plans?: Record<string, { label: string; chat_per_day: number; price_cad: number }>;
  subscription_status?: string | null;
  service?: {
    chat_blocked?: boolean;
    block_reason?: string | null;
    llm_circuit?: string;
  };
};

export default function BillingPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await billingStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "billing status failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const session = await billingCheckout();
      if (session.url && typeof window !== "undefined") {
        window.location.href = session.url;
        return;
      }
      setError("No checkout URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function onPortal() {
    setBusy(true);
    setError(null);
    try {
      const session = await billingPortal();
      if (session.url && typeof window !== "undefined") {
        window.location.href = session.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "portal failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDevPro() {
    setBusy(true);
    try {
      await billingDevSetPlan("pro");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "dev plan failed");
    } finally {
      setBusy(false);
    }
  }

  const plan = status?.plan || "free";
  const freeLimit = status?.plans?.free?.chat_per_day ?? 25;
  const proPrice = status?.plans?.pro?.price_cad ?? 29;
  const used = status?.usage?.used;
  const limit = status?.usage?.limit ?? status?.limits?.chat_per_day;
  const remaining = status?.usage?.remaining;
  const chatBlocked = status?.service?.chat_blocked;
  const circuit = status?.service?.llm_circuit;
  const pct =
    used != null && limit != null && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : null;

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">Billing & usage</h3>
      {error && <p className="mb-2 text-xs text-bad">{error}</p>}
      {chatBlocked && (
        <p className="mb-2 rounded-lg border border-bad/40 bg-bad/10 px-2 py-1.5 text-xs text-bad">
          Service paused
          {status?.service?.block_reason
            ? `: ${status.service.block_reason}`
            : ""}
        </p>
      )}
      {circuit && circuit !== "closed" && (
        <p className="mb-2 rounded-lg border border-warn/40 bg-warn/10 px-2 py-1.5 text-xs text-warn">
          LLM circuit: {circuit} (demo agent may run until provider recovers)
        </p>
      )}
      {pct != null && used != null && limit != null && (
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span>Daily chats</span>
            <span className="font-mono">
              {used}/{limit}
              {remaining != null ? ` · ${remaining} left` : ""}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink">
            <div
              className={`h-full rounded-full ${
                pct >= 90 ? "bg-bad" : pct >= 70 ? "bg-warn" : "bg-accent"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Plan</dt>
          <dd className="font-mono text-slate-100">{plan}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Stripe</dt>
          <dd className="font-mono text-slate-100">
            {status?.stripe_configured ? "ready" : "not configured"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Free: {freeLimit} chats/day. Pro (~${proPrice} CAD/mo): high limits for
        Grok research. Paper trading only — not investment advice.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status?.stripe_configured && plan === "free" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onUpgrade()}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Upgrade to Pro
          </button>
        )}
        {status?.stripe_configured && plan !== "free" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onPortal()}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-200"
          >
            Manage subscription
          </button>
        )}
        {!status?.stripe_configured && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDevPro()}
            className="rounded-lg border border-warn/40 px-3 py-1.5 text-xs text-warn"
            title="Requires STRIPE_DEV_MODE=true on API"
          >
            Dev: set Pro
          </button>
        )}
      </div>
    </div>
  );
}
