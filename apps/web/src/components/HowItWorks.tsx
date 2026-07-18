"use client";

const STEPS = [
  { n: "1", t: "Ask Grok" },
  { n: "2", t: "Propose" },
  { n: "3", t: "Policy" },
  { n: "4", t: "You confirm" },
];

/** Slim pipeline strip — keeps education without eating the fold. */
export default function HowItWorks() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/80 bg-panel/50 px-3 py-2.5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="hud-label !mb-0 mr-1">How it works</span>
        {STEPS.map((s, i) => (
          <span key={s.n} className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-line bg-ink/50 px-2 py-0.5 font-mono text-xs text-slate-300">
              <span className="text-accent">{s.n}</span>
              {s.t}
            </span>
            {i < STEPS.length - 1 && (
              <span className="hidden text-mist sm:inline" aria-hidden>
                →
              </span>
            )}
          </span>
        ))}
      </div>
      <a
        href="/trade"
        className="shrink-0 rounded-full border border-good/30 bg-good/10 px-2.5 py-1 text-xs font-semibold text-good hover:bg-good/20"
      >
        Trade floor
      </a>
    </div>
  );
}
