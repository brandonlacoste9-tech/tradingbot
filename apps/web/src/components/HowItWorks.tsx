"use client";

const STEPS = [
  { n: "01", t: "Research", d: "Ask Grok — or open the Trade floor ticket" },
  { n: "02", t: "Propose", d: "AI or you build a paper limit order" },
  { n: "03", t: "Policy", d: "Risk rules check size, cash, and session" },
  { n: "04", t: "Confirm", d: "You approve — PaperSim fills. No live money." },
];

export default function HowItWorks() {
  return (
    <div className="hud-panel !py-3">
      <div className="hud-panel-header !mb-2 !border-0 !pb-0">
        <span className="hud-label">How it works</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-mist">paper only</span>
          <a
            href="/trade"
            className="rounded-full border border-good/30 bg-good/10 px-2 py-0.5 text-[10px] font-semibold text-good hover:bg-good/20"
          >
            Trade floor
          </a>
        </div>
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
