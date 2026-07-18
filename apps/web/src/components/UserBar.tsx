"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { getDemoUserId, me, setAuthToken, setDemoUserId } from "@/lib/api";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

/**
 * Tenant / plan chips — re-fetch /me when Clerk session is ready.
 */
export default function UserBar() {
  if (clerkEnabled) {
    return <UserBarClerk />;
  }
  return <UserBarDemo />;
}

function UserBarClerk() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setPlan(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const m = await me();
      setPlan(m.plan || "free");
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  if (!isLoaded) {
    return (
      <div className="font-mono text-xs text-mist">Checking session…</div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-xl border border-line/80 bg-ink/50 px-3 py-2 text-xs text-slate-300">
        <span className="text-mist">Signed out · </span>
        Sign in (top right) to open your paper book and chat with Grok.
      </div>
    );
  }

  const label =
    user?.primaryEmailAddress?.emailAddress ||
    user?.username ||
    user?.firstName ||
    "signed in";
  const planLabel = loading ? "…" : plan || "free";
  const displayPlan =
    planLabel === "pro"
      ? "Indie Pro"
      : planLabel === "pro_plus"
        ? "Indie Pro+"
        : planLabel;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full border border-line px-2.5 py-1 text-slate-300">
        {label}
      </span>
      <a
        href="/plans"
        className="rounded-full border border-accent/35 bg-accent/5 px-2.5 py-1 text-accent hover:bg-accent/15"
        title="View plans & pricing"
      >
        {displayPlan}
      </a>
    </div>
  );
}

function UserBarDemo() {
  const [userId, setUserId] = useState(getDemoUserId());
  const [plan, setPlan] = useState<string>("free");
  const [draft, setDraft] = useState(userId);

  useEffect(() => {
    void (async () => {
      try {
        const m = await me();
        setUserId(m.user_id);
        setPlan(m.plan || "free");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function applyDemoUser() {
    const id = draft.trim() || "demo";
    setDemoUserId(id);
    setAuthToken(null);
    setUserId(id);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded-full border border-line px-2.5 py-1 font-mono text-slate-300">
        demo: {userId}
      </span>
      <a
        href="/plans"
        className="rounded-full border border-accent/35 bg-accent/5 px-2.5 py-1 text-accent hover:bg-accent/15"
      >
        plan: {plan}
      </a>
      <div className="flex items-center gap-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-28 rounded-lg border border-line bg-ink px-2 py-1 font-mono text-slate-200"
          placeholder="tenant id"
          aria-label="Demo user id"
        />
        <button
          type="button"
          onClick={applyDemoUser}
          className="rounded-lg border border-accent/40 px-2 py-1 text-accent hover:bg-accent/10"
        >
          Switch user
        </button>
      </div>
    </div>
  );
}
