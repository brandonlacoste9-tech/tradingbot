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
  plans?: Record<
    string,
    { label: string; chat_per_day: number; price_cad: number }
  >;
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

type Props = {
  onPlanChange?: () => void;
};

/** Clerk-aware shell — useAuth requires ClerkProvider (production). */
export default function BillingPanel({ onPlanChange }: Props) {
  if (clerkEnabled) {
    return <BillingPanelClerk onPlanChange={onPlanChange} />;
  }
  return <BillingPanelBody isLoaded isSignedIn onPlanChange={onPlanChange} />;
}

function BillingPanelClerk({ onPlanChange }: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <BillingPanelBody
      isLoaded={isLoaded}
      isSignedIn={Boolean(isSignedIn)}
      onPlanChange={onPlanChange}
    />
  );
}

function BillingPanelBody({
  isLoaded,
  isSignedIn,
  onPlanChange,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
  onPlanChange?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
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

  // After Stripe redirect (?billing=success)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("billing") === "success" || q.get("billing") === "cancel") {
      void refresh();
      onPlanChange?.();
    }
  }, [refresh, onPlanChange]);

  async function onUpgrade(paidPlan: "pro" | "pro_plus" = "pro") {
    setBusy(true);
    setError(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      const session = await billingCheckout(
        origin ? `${origin}/plans?billing=success` : undefined,
        origin ? `${origin}/plans?billing=cancel` : undefined,
        paidPlan
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
      onPlanChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "dev plan failed");
    } finally {
      setBusy(false);
    }
  }

  const plan = status?.plan || "free";
  const freeLimit = status?.plans?.free?.chat_per_day ?? 25;
  const proLimit = status?.plans?.pro?.chat_per_day ?? 10_000;
  const proPlusLimit = status?.plans?.pro_plus?.chat_per_day ?? 50_000;
  const proPrice = status?.plans?.pro?.price_cad ?? 29;
  const proPlusPrice = status?.plans?.pro_plus?.price_cad ?? 59;
  const used = status?.usage?.used;
  const limit = status?.usage?.limit ?? status?.limits?.chat_per_day;
  const remaining = status?.usage?.remaining;
  const chatBlocked = status?.service?.chat_blocked;
  const circuit = status?.service?.llm_circuit;
  const stripeReady = Boolean(status?.stripe_configured);
  const devMode = Boolean(status?.stripe_dev_mode);
  const signedOut = clerkEnabled && isLoaded && !isSignedIn;
  const pct =
    used != null && limit != null && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : null;

  return (
    <div className="hud-panel ring-1 ring-accent/20">
      <div className="hud-panel-header">
        <div>
          <div className="hud-label mb-0.5">plans</div>
          <h3 className="text-sm font-semibold text-white">Plans & billing</h3>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/plans"
            className="font-mono text-[10px] text-accent hover:underline"
          >
            Full page →
          </a>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
            {loading ? "…" : plan.toUpperCase()}
          </span>
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-bad">{error}</p>}

      {signedOut && (
        <p className="mb-3 rounded-lg border border-line bg-ink/50 px-3 py-2 text-xs text-slate-300">
          <strong className="text-white">Sign in</strong> (top right) to view
          your plan and upgrade to Pro.
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
          LLM circuit: {circuit}
        </p>
      )}

      {/* Plan cards — Free / Pro / Pro+ */}
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        <div
          className={`rounded-xl border px-2 py-2 ${
            plan === "free"
              ? "border-accent/50 bg-accent/10"
              : "border-line bg-ink/40"
          }`}
        >
          <div className="font-mono text-[9px] uppercase tracking-wider text-mist">
            Free
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white">$0</div>
          <div className="mt-1 text-[10px] leading-snug text-slate-400">
            {freeLimit}/day
          </div>
        </div>
        <div
          className={`rounded-xl border px-2 py-2 ${
            plan === "pro"
              ? "border-accent/50 bg-accent/10"
              : "border-line bg-ink/40"
          }`}
        >
          <div className="font-mono text-[9px] uppercase tracking-wider text-mist">
            Indie Pro
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white">
            ${proPrice}
          </div>
          <div className="mt-1 text-[10px] leading-snug text-slate-400">
            {proLimit}/day
          </div>
        </div>
        <div
          className={`rounded-xl border px-2 py-2 ${
            plan === "pro_plus"
              ? "border-accent/50 bg-accent/10"
              : "border-line bg-ink/40"
          }`}
        >
          <div className="font-mono text-[9px] uppercase tracking-wider text-mist">
            Indie Pro+
          </div>
          <div className="mt-0.5 text-sm font-semibold text-white">
            ${proPlusPrice}
          </div>
          <div className="mt-1 text-[10px] leading-snug text-slate-400">
            {proPlusLimit}/day
          </div>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-mist">
        CAD/mo · details on{" "}
        <a href="/plans" className="text-accent hover:underline">
          /plans
        </a>
      </p>

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

      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        Paper trading only — not investment advice. Promo codes accepted at
        Stripe Checkout.
      </p>

      <div className="flex flex-wrap gap-2">
        {!signedOut && stripeReady && plan === "free" && (
          <>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void onUpgrade("pro")}
              className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-accent/20 disabled:opacity-40"
            >
              {busy ? "…" : "Indie Pro $29"}
            </button>
            <button
              type="button"
              disabled={busy || loading}
              onClick={() => void onUpgrade("pro_plus")}
              className="rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent disabled:opacity-40"
            >
              {busy ? "…" : "Indie Pro+ $59"}
            </button>
          </>
        )}
        {!signedOut && stripeReady && plan !== "free" && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void onPortal()}
            className="rounded-lg border border-line px-4 py-2 text-xs text-slate-200 hover:border-accent/40"
          >
            Manage subscription
          </button>
        )}
        {signedOut && (
          <p className="text-[11px] text-mist">
            Use <strong className="text-slate-200">Sign in</strong> in the
            header, then return here to upgrade.
          </p>
        )}
        {!signedOut && status != null && !stripeReady && devMode && (
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
        {!signedOut && status != null && !stripeReady && !devMode && (
          <p className="text-[11px] text-warn">
            Stripe not ready on API — try again after deploy.
          </p>
        )}
        {!signedOut && status == null && !loading && error && (
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-lg border border-line px-3 py-1.5 text-xs text-slate-300"
          >
            Retry billing status
          </button>
        )}
      </div>
    </div>
  );
}
