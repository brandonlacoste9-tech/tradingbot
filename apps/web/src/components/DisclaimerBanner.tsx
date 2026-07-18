"use client";

import { useEffect, useState } from "react";

const KEY = "indietrades_disclaimer_ack_v1";

export default function DisclaimerBanner() {
  const [acked, setAcked] = useState(true);

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
      <div className="border-b border-warn/25 bg-gradient-to-r from-warn/10 via-panel to-warn/10 px-4 py-2 text-center font-mono text-xs leading-snug text-warn/90">
        <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-warn align-middle" />
        <strong className="font-semibold">PRACTICE BEFORE REAL MONEY</strong>
        <span className="text-warn/70">
          {" "}
          · Paper only · Not a broker · Not advice · You confirm · Outcomes on
          you
        </span>
      </div>
    );
  }

  return (
    <div className="border-b border-warn/40 bg-warn/10 px-4 py-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-200">
          <p className="hud-label !text-warn">Before you board</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            <strong>IndieTrades</strong> is a{" "}
            <strong>paper-trading research desk</strong>. Grok can look at the
            market and say what looks good or weak for practice — that&apos;s an
            opinion, not a guarantee. You confirm every paper trade. No real
            money. You own your decisions. Not investment advice.
          </p>
        </div>
        <button
          type="button"
          onClick={acknowledge}
          className="shrink-0 rounded-xl bg-warn px-4 py-2.5 text-sm font-semibold text-ink shadow-lg hover:bg-amber-300"
        >
          I understand — continue
        </button>
      </div>
    </div>
  );
}
