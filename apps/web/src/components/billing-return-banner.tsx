"use client";

import { useEffect, useState } from "react";
import { billingStatus } from "@/lib/api";

/**
 * After Stripe Checkout redirect to /plans?billing=success|cancel
 */
export default function BillingReturnBanner() {
  const [msg, setMsg] = useState<string | null>(null);
  const [kind, setKind] = useState<"good" | "warn" | "mist">("mist");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const billing = q.get("billing");
    if (!billing) return;

    // Clean URL without losing path
    const url = new URL(window.location.href);
    url.searchParams.delete("billing");
    window.history.replaceState({}, "", url.pathname + url.search);

    if (billing === "cancel") {
      setKind("warn");
      setMsg("Checkout canceled — you’re still on your current plan.");
      return;
    }

    if (billing === "success") {
      setKind("good");
      setMsg("Payment received. Refreshing your plan…");
      void (async () => {
        // Webhook can lag a second or two
        for (let i = 0; i < 6; i++) {
          try {
            const s = await billingStatus();
            if (s.plan && s.plan !== "free") {
              setMsg(
                `You’re on ${String(s.plan).replace("_", " ").toUpperCase()}. Welcome to paid research room.`
              );
              return;
            }
          } catch {
            /* retry */
          }
          await new Promise((r) => setTimeout(r, 1500));
        }
        setMsg(
          "Payment received. If plan still shows Free, wait a moment and refresh — webhook may still be processing."
        );
      })();
    }
  }, []);

  if (!msg) return null;

  const cls =
    kind === "good"
      ? "border-good/40 bg-good/10 text-good"
      : kind === "warn"
        ? "border-warn/40 bg-warn/10 text-warn"
        : "border-line bg-panel/60 text-mist";

  return (
    <div className={`mx-auto max-w-6xl px-4 pt-4 sm:px-6`}>
      <div
        className={`rounded-xl border px-4 py-3 text-sm font-medium ${cls}`}
        role="status"
      >
        {msg}
      </div>
    </div>
  );
}
