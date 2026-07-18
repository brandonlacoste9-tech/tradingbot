"use client";

import { useEffect, useState } from "react";

const KEY = "tradingbot_disclaimer_ack_v1";

export default function DisclaimerBanner() {
  const [acked, setAcked] = useState(true); // avoid flash until mounted

  useEffect(() => {
    try {
      setAcked(window.localStorage.getItem(KEY) === "1");
    } catch {
      setAcked(false);
    }
  }, []);

  function acknowledge() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setAcked(true);
  }

  if (acked) {
    return (
      <div className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-center text-[11px] leading-snug text-warn/90">
        <strong className="font-semibold">Paper / educational only.</strong>{" "}
        Not investment advice. Not a broker. LLM proposes · policy checks · you
        confirm · paper fills only.
      </div>
    );
  }

  return (
    <div className="border-b border-warn/40 bg-warn/15 px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-200">
          <p className="font-semibold text-warn">Before you start</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            <strong>IndieTrades</strong> is a{" "}
            <strong>paper-trading research desk</strong>. Grok can research and
            propose trades; a rules engine and your confirm gate must pass
            before anything hits the paper book. No real money moves here. Not
            investment advice. Not a registered dealer.
          </p>
        </div>
        <button
          type="button"
          onClick={acknowledge}
          className="shrink-0 rounded-xl bg-warn px-4 py-2 text-sm font-semibold text-ink hover:bg-warn/90"
        >
          I understand — continue
        </button>
      </div>
    </div>
  );
}
