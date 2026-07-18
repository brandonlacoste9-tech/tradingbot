"use client";

import { useAuth } from "@clerk/nextjs";
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
  stripe_dev_mode?: boolean;
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

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

/** Clerk-aware shell — useAuth requires ClerkProvider (production). */
export default function BillingPanel() {
  if (clerkEnabled) {
    return <BillingPanelClerk />;
  }
  return <BillingPanelBody isLoaded isSignedIn />;
}

function BillingPanelClerk() {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <BillingPanelBody
      isLoaded={isLoaded}
      isSignedIn={Boolean(isSignedIn)}
    />
  );
}

function BillingPanelBody({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Wait for Clerk session before calling authenticated billing routes
    if (clerkEnabled) {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setStatus(null);
        setLoading(false);
        setError(null);
        return;
      }
    }
    setLoading(true);
    try {
      const s = await billingStatus();
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "billing status failed");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onUpgrade() {
    setBusy(true);
    setError(null);
    try {
      const session = await billingCheckout(
        typeof window !== "undefined"
          ? `${window.location.origin}/?billing=success`
          : undefined,
        typeof window !== "undefined"
          ? `${window.location.origin}/?billing=cancel`
          : undefined
      );
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
      const session = await billingPortal(
        typeof window !== "undefined" ? window.location.origin : undefined
      );
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
    setError(null);
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
  const stripeReady = Boolean(status?.stripe_configured);
  const devMode = Boolean(status?.stripe_dev_mode);
  const pct =
    used != null && limit != null && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : null;

  const stripeLabel = loading
    ? "…"
    : clerkEnabled && isLoaded && !isSignedIn
      ? "sign in"
      : status == null
        ? "unavailable"
        : stripeReady
          ? "ready"
          : "not configured";

  return (
    <div className="hud-panel">
      <div className="hud-panel-header">
        <h3 className="text-sm font-semibold text-white">Billing & usage</h3>
        <span className="hud-label !normal-case !tracking-normal">plans</span>
      </div>
      {error && <p className="mb-2 text-xs text-bad">{error}</p>}
      {clerkEnabled && isLoaded && !isSignedIn && (
        <p className="mb-2 text-xs text-slate-400">
          Sign in to see plan, usage, and upgrade options.
        </p>
      )}
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
          <dd className="font-mono text-slate-100">
            {loading ? "…" : plan}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Stripe</dt>
          <dd
            className={`font-mono ${
              stripeReady ? "text-good" : "text-slate-100"
            }`}
          >
            {stripeLabel}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Free: {freeLimit} chats/day. Pro (~${proPrice} CAD/mo): high limits for
        Grok research. Paper trading only — not investment advice.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {stripeReady && plan === "free" && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void onUpgrade()}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Upgrade to Pro
          </button>
        )}
        {stripeReady && plan !== "free" && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void onPortal()}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-200"
          >
            Manage subscription
          </button>
        )}
        {/* Local/demo only — never shown when production Stripe is live */}
        {status != null && !stripeReady && devMode && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDevPro()}
            className="rounded-lg border border-warn/40 px-3 py-1.5 text-xs text-warn"
            title="Local only: STRIPE_DEV_MODE=true"
          >
            Dev: set Pro
          </button>
        )}
        {status != null && !stripeReady && !devMode && (
          <p className="text-[11px] text-warn">
            Stripe keys missing on API — checkout disabled.
          </p>
        )}
      </div>
    </div>
  );
}
