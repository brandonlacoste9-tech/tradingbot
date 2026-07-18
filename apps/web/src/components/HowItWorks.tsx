"use client";

const STEPS = [
  { n: "1", t: "Research", d: "Ask Grok to search, quote, or check your book" },
  { n: "2", t: "Propose", d: "Agent proposes a limit order with a thesis" },
  { n: "3", t: "Policy", d: "Risk rules run in code — never skipped" },
  { n: "4", t: "Confirm", d: "You approve within the TTL (paper only)" },
];

export default function HowItWorks() {
  return (
    <div className="rounded-2xl border border-line bg-panel/60 p-3">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        How this desk works
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <li
            key={s.n}
            className="flex gap-2 rounded-xl border border-line/80 bg-ink/40 px-3 py-2"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 font-mono text-xs text-accent">
              {s.n}
            </span>
            <div>
              <div className="text-xs font-semibold text-white">{s.t}</div>
              <div className="text-[11px] leading-snug text-slate-500">{s.d}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
