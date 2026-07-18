"use client";

import { useState } from "react";

const REASONS = [
  {
    icon: "🌱",
    title: "Not enough capital yet",
    body: "Practice real stock workflows with $100k virtual cash — no deposit required.",
  },
  {
    icon: "🧭",
    title: "Not sure where to start",
    body: "Grok as your research bro on AI Desk. Trade floor when you’re ready to ticket. Policy + confirm keeps it safe.",
  },
  {
    icon: "🧪",
    title: "Test strategies risk-free",
    body: "Try ideas, journal results, reset anytime. Same muscles as live — zero bank risk.",
  },
  {
    icon: "🛡️",
    title: "Bro, not autopilot",
    body: "Grok digs and proposes. Code enforces risk. You confirm. Paper fills. No “bot spent your money.”",
  },
];

type Props = {
  /** When false, accordion starts closed (returning signed-in users). */
  defaultOpen?: boolean;
};

/**
 * Marketing cards — collapsible so the AI Desk stays a workspace.
 */
export default function WhyPaper({ defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-line/80 bg-panel/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-ink/30"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <span className="hud-label">Why paper?</span>
          <p className="truncate text-sm font-medium text-slate-200">
            Real stocks. Fake money. Real practice.
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2">
          <a
            href="/trade"
            onClick={(e) => e.stopPropagation()}
            className="hidden rounded-full border border-good/40 bg-good/10 px-2.5 py-1 text-xs font-semibold text-good hover:bg-good/20 sm:inline"
          >
            Open floor →
          </a>
          <span
            className="font-mono text-sm text-mist"
            aria-hidden
          >
            {open ? "−" : "+"}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-line/70 px-3 pb-3 pt-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map((r) => (
              <div
                key={r.title}
                className="rounded-xl border border-line/70 bg-ink/40 px-3 py-2.5"
              >
                <div className="text-lg" aria-hidden>
                  {r.icon}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-white">
                  {r.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-mist">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
          <a
            href="/trade"
            className="mt-3 inline-flex text-xs font-semibold text-good hover:underline sm:hidden"
          >
            Open Trade floor →
          </a>
        </div>
      )}
    </section>
  );
}
