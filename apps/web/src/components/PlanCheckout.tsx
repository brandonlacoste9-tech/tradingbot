"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import {
  billingCheckout,
  billingPortal,
  billingStatus,
} from "@/lib/api";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

type PaidPlan = "pro" | "pro_plus";

type Props = {
  /** Which paid tier this CTA purchases */
  checkoutPlan?: PaidPlan;
  /** Button label override */
  label?: string;
  /** auto: upgrade if free, manage if paid; buy: always show checkout; manage: portal only */
  variant?: "auto" | "buy" | "manage";
};

/**
 * Checkout / portal CTAs for the public /plans page.
 */
export default function PlanCheckout(props: Props) {
  if (clerkEnabled) {
    return <PlanCheckoutClerk {...props} />;
  }
  return <PlanCheckoutBody isLoaded isSignedIn {...props} />;
}

function PlanCheckoutClerk(props: Props) {
  const { isLoaded, isSignedIn } = useAuth();
  return (
    <PlanCheckoutBody
      isLoaded={isLoaded}
      isSignedIn={Boolean(isSignedIn)}
      {...props}
    />
  );
}

function PlanCheckoutBody({
  isLoaded,
  isSignedIn,
  checkoutPlan = "pro",
  label,
  variant = "auto",
}: Props & {
  isLoaded: boolean;
  isSignedIn: boolean;
}) {
  const [plan, setPlan] = useState<string>("free");
  const [stripeReady, setStripeReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (clerkEnabled) {
      if (!isLoaded) return;
      if (!isSignedIn) {
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    try {
      const s = await billingStatus();
      setPlan(s.plan || "free");
      setStripeReady(Boolean(s.stripe_configured));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load billing");
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("billing") === "success" || q.get("billing") === "cancel") {
      void refresh();
    }
  }, [refresh]);

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const session = await billingCheckout(
        `${origin}/plans?billing=success`,
        `${origin}/plans?billing=cancel`,
        checkoutPlan
      );
      if (session.url) {
        window.location.href = session.url;
        return;
      }
      setError("No checkout URL returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  async function portal() {
    setBusy(true);
    setError(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const session = await billingPortal(`${origin}/plans`);
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setBusy(false);
    }
  }

  if (!isLoaded || loading) {
    return (
      <button
        type="button"
        disabled
        className="hud-btn-primary w-full cursor-wait opacity-60 sm:w-auto"
      >
        Loading…
      </button>
    );
  }

  if (clerkEnabled && !isSignedIn) {
    return (
      <div className="space-y-2">
        <SignInButton mode="modal">
          <button type="button" className="hud-btn-primary w-full sm:w-auto">
            Sign in to upgrade
          </button>
        </SignInButton>
        <p className="text-xs text-mist">
          Create a free account first, then return here.
        </p>
      </div>
    );
  }

  const onThisPlan =
    (checkoutPlan === "pro" && plan === "pro") ||
    (checkoutPlan === "pro_plus" && plan === "pro_plus");
  const isPaid = plan === "pro" || plan === "pro_plus";

  const defaultLabel =
    checkoutPlan === "pro_plus"
      ? "Get Indie Pro+"
      : "Get Indie Pro";

  if (variant === "manage" || (variant === "auto" && isPaid && onThisPlan)) {
    return (
      <div className="space-y-2">
        {error && <p className="text-xs text-bad">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void portal()}
          className="hud-btn w-full sm:w-auto"
        >
          {busy ? "Opening…" : "Manage subscription"}
        </button>
        <p className="font-mono text-xs text-mist">
          Current: <span className="text-accent">{plan.toUpperCase()}</span>
        </p>
      </div>
    );
  }

  // buy this tier (or auto when free / different tier)
  if (variant === "buy" || variant === "auto") {
    return (
      <div className="space-y-2">
        {error && <p className="text-xs text-bad">{error}</p>}
        {onThisPlan ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void portal()}
            className="hud-btn w-full sm:w-auto"
          >
            Manage subscription
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !stripeReady}
            onClick={() => void upgrade()}
            className="hud-btn-primary w-full disabled:opacity-40 sm:w-auto"
          >
            {busy
              ? "Opening Checkout…"
              : stripeReady
                ? label || defaultLabel
                : "Stripe unavailable"}
          </button>
        )}
        <p className="font-mono text-xs text-mist">
          Current: <span className="text-accent">{plan.toUpperCase()}</span>
          {stripeReady ? " · Stripe ready" : ""}
        </p>
      </div>
    );
  }

  return null;
}
