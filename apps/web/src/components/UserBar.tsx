"use client";

import { useEffect, useState } from "react";
import { getDemoUserId, me, setAuthToken, setDemoUserId } from "@/lib/api";
import ClerkAuthHeader from "./ClerkAuthHeader";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

/**
 * Tenant identity.
 * - Without Clerk: demo multi-user via local X-User-Id.
 * - With Clerk: Sign in / UserButton + JWT synced via ClerkTokenSync.
 */
export default function UserBar() {
  const [userId, setUserId] = useState(getDemoUserId());
  const [plan, setPlan] = useState<string>("—");
  const [authMode, setAuthMode] = useState<string>("—");
  const [draft, setDraft] = useState(userId);

  async function refreshMe() {
    try {
      const m = await me();
      setUserId(m.user_id);
      setPlan(m.plan || "free");
      setAuthMode(m.auth_mode);
    } catch {
      /* API down or signed out under AUTH_MODE=clerk */
    }
  }

  useEffect(() => {
    void refreshMe();
  }, []);

  function applyDemoUser() {
    const id = draft.trim() || "demo";
    setDemoUserId(id);
    setAuthToken(null);
    setUserId(id);
    void refreshMe();
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {clerkEnabled && <ClerkAuthHeader />}
      <span className="rounded-full border border-line px-2.5 py-1 font-mono text-slate-300">
        user: {userId}
      </span>
      <span className="rounded-full border border-line px-2.5 py-1 text-slate-400">
        plan: {plan}
      </span>
      <span className="rounded-full border border-line px-2.5 py-1 text-slate-500">
        auth: {authMode}
        {clerkEnabled ? " · clerk" : " · demo"}
      </span>
      {!clerkEnabled && (
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
      )}
    </div>
  );
}
