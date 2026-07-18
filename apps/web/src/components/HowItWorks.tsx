"use client";

const STEPS = [
  { n: "01", t: "Research", d: "Ask Grok for quotes, news, or ideas" },
  { n: "02", t: "Propose", d: "It may suggest a paper limit order" },
  { n: "03", t: "Policy", d: "Risk rules check size, cash, and limits" },
  { n: "04", t: "Confirm", d: "You approve — then it fills on paper only" },
];

export default function HowItWorks() {
  return (
    <div className="hud-panel !py-3">
      <div className="hud-panel-header !mb-2 !border-0 !pb-0">
        <span className="hud-label">How it works</span>
        <span className="text-[10px] text-mist">paper only</span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            className="group relative flex gap-3 overflow-hidden rounded-xl border border-line/80 bg-ink/50 px-3 py-2.5 transition hover:border-accent/30"
          >
            <span className="font-mono text-lg font-semibold tabular-nums text-accent/80">
              {s.n}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white">{s.t}</div>
              <div className="text-[11px] leading-snug text-mist">{s.d}</div>
            </div>
            {i < STEPS.length - 1 && (
              <span className="pointer-events-none absolute -right-1 top-1/2 hidden -translate-y-1/2 text-accent/20 lg:block">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
