"use client";

const REASONS = [
  {
    icon: "🌱",
    title: "Not enough capital yet",
    body: "Practice real stock workflows with $100k virtual cash — no deposit required.",
  },
  {
    icon: "🧭",
    title: "Not sure where to start",
    body: "AI Desk for research. Trade floor for tickets. Policy + confirm so you learn safely.",
  },
  {
    icon: "🧪",
    title: "Test strategies risk-free",
    body: "Try ideas, journal results, reset anytime. Same muscles as live — zero bank risk.",
  },
  {
    icon: "🛡️",
    title: "Not a DIY API bot",
    body: "Grok proposes. Code enforces risk. You confirm. Paper fills. Audit trail included.",
  },
];

export default function WhyPaper() {
  return (
    <section className="hud-panel">
      <div className="hud-panel-header">
        <div>
          <span className="hud-label">Why paper trading</span>
          <h2 className="mt-1 text-base font-semibold text-white sm:text-lg">
            Real stocks. Fake money. Real practice.
          </h2>
        </div>
        <a
          href="/trade"
          className="shrink-0 rounded-full border border-good/40 bg-good/10 px-3 py-1.5 text-xs font-semibold text-good hover:bg-good/20"
        >
          Open floor →
        </a>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {REASONS.map((r) => (
          <div
            key={r.title}
            className="rounded-xl border border-line/70 bg-ink/40 px-3 py-3 transition hover:border-accent/30"
          >
            <div className="text-xl" aria-hidden>
              {r.icon}
            </div>
            <p className="mt-2 text-sm font-semibold text-white">{r.title}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-mist">{r.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
