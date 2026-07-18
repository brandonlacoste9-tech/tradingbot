"use client";

import Image from "next/image";
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { IndieTradesLogo, IndieTradesMark } from "@/components/indie-trades-logo";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const FACTS = [
  {
    k: "Real symbols",
    v: "AAPL, SPY, NVDA — same tickers the market uses. Open any US stock.",
  },
  {
    k: "Virtual cash",
    v: "Paper bankroll. Practice sizing. Zero brokerage deposit.",
  },
  {
    k: "Real desk UI",
    v: "Chart · ticket · watchlist · blotter. Looks like trading because it is trading — simulated.",
  },
  {
    k: "You confirm",
    v: "Policy checks risk. Nothing hits the book until you say yes. Grok never auto-routes.",
  },
  {
    k: "Hybrid paper fills",
    v: "Aggressive limits fill fast. Passiveive limits work in Orders. Day TIF. Cancel. Honest rules.",
  },
  {
    k: "Not a broker",
    v: "No live multi-tenant brokerage. Practice here, then trade real money somewhere else when ready.",
  },
] as const;

const PILLARS = [
  {
    mode: "Think",
    href: "/desk",
    title: "AI Desk",
    body: "Optional Grok research. Opinions, not orders. You still own the decision.",
    cta: "Open desk",
    primary: false,
  },
  {
    mode: "Act",
    href: "/trade",
    title: "Trade floor",
    body: "Pick a symbol. Read the chart. Ticket. Confirm. PaperSim fill or working limit.",
    cta: "Open floor",
    primary: true,
  },
  {
    mode: "Pay",
    href: "/plans",
    title: "Plans",
    body: "Free to practice. Pro when you want more chat. Paper stays paper.",
    cta: "See plans",
    primary: false,
  },
] as const;

/** Decorative tape — visual only, not live prices */
function MarketRibbon() {
  const row = [
    { s: "SPY", u: true, d: "+0.42%" },
    { s: "QQQ", u: true, d: "+0.61%" },
    { s: "AAPL", u: false, d: "−0.18%" },
    { s: "NVDA", u: true, d: "+1.24%" },
    { s: "TSLA", u: false, d: "−0.55%" },
    { s: "MSFT", u: true, d: "+0.33%" },
    { s: "META", u: true, d: "+0.91%" },
    { s: "AMZN", u: false, d: "−0.07%" },
  ];
  const loop = [...row, ...row];
  return (
    <div
      className="relative overflow-hidden border-y border-line/80 bg-ink/60"
      aria-hidden
    >
      <div className="flex w-max animate-it-marquee gap-8 whitespace-nowrap py-2.5 font-mono text-xs sm:text-sm">
        {loop.map((t, i) => (
          <span key={`${t.s}-${i}`} className="inline-flex items-center gap-2 px-1">
            <span className="font-bold text-white">{t.s}</span>
            <span className={t.u ? "text-good" : "text-bad"}>{t.d}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniDeskPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-panel/80 shadow-2xl shadow-accent/10 ring-1 ring-accent/15">
      <div className="flex items-center justify-between border-b border-line/70 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-good/40 bg-good/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-good">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
            Paper only
          </span>
          <span className="hidden font-mono text-[10px] text-mist sm:inline">
            US RTH · quotes
          </span>
        </div>
        <span className="font-mono text-[10px] text-accent">IndieTrades floor</span>
      </div>
      <div className="grid gap-0 sm:grid-cols-12">
        <div className="border-b border-line/60 p-3 sm:col-span-3 sm:border-b-0 sm:border-r">
          <p className="mb-2 font-mono text-[10px] uppercase text-mist">Watchlist</p>
          {[
            ["AAPL", "190.12", "+0.4%"],
            ["SPY", "520.40", "+0.2%"],
            ["NVDA", "124.80", "−0.6%"],
          ].map(([sym, px, chg]) => (
            <div
              key={sym}
              className="flex items-center justify-between border-t border-line/40 py-2 font-mono text-xs first:border-0"
            >
              <span className="font-bold text-white">{sym}</span>
              <span className="text-slate-300">{px}</span>
              <span
                className={
                  String(chg).startsWith("−") || String(chg).startsWith("-")
                    ? "text-bad"
                    : "text-good"
                }
              >
                {chg}
              </span>
            </div>
          ))}
        </div>
        <div className="p-3 sm:col-span-5 sm:border-r sm:border-line/60">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-lg font-bold text-white">AAPL</span>
            <span className="font-mono text-sm text-good">+0.40%</span>
          </div>
          <svg viewBox="0 0 280 100" className="h-24 w-full sm:h-28" aria-hidden>
            {(
              [
                { x: 20, o: 60, up: true },
                { x: 50, o: 55, up: false },
                { x: 80, o: 50, up: true },
                { x: 110, o: 45, up: true },
                { x: 140, o: 48, up: false },
                { x: 170, o: 40, up: true },
                { x: 200, o: 35, up: true },
                { x: 230, o: 30, up: true },
                { x: 255, o: 28, up: false },
              ] as const
            ).map((bar, i) => {
              const c = bar.up ? bar.o - 8 : bar.o + 8;
              const h = bar.o - 12;
              const l = bar.o + 14;
              const color = bar.up ? "#22c55e" : "#ef4444";
              const top = Math.min(bar.o, c);
              const body = Math.max(2, Math.abs(c - bar.o));
              return (
                <g key={i}>
                  <line
                    x1={bar.x}
                    x2={bar.x}
                    y1={h}
                    y2={l}
                    stroke={color}
                    strokeWidth="1.5"
                  />
                  <rect
                    x={bar.x - 5}
                    y={top}
                    width="10"
                    height={body}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })}
          </svg>
          <p className="mt-1 font-mono text-[10px] text-mist">
            Candles · honest source badge · PAPER view
          </p>
        </div>
        <div className="border-t border-line/60 p-3 sm:col-span-4 sm:border-t-0">
          <p className="mb-2 font-mono text-[10px] uppercase text-mist">Ticket</p>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-good py-2 text-center text-xs font-bold text-ink">
              BUY
            </div>
            <div className="rounded-lg border border-line py-2 text-center text-xs text-mist">
              SELL
            </div>
          </div>
          <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
            <div className="flex justify-between rounded-lg border border-line/60 px-2 py-1.5">
              <span className="text-mist">Qty</span>
              <span>10</span>
            </div>
            <div className="flex justify-between rounded-lg border border-line/60 px-2 py-1.5">
              <span className="text-mist">Limit</span>
              <span>190.00</span>
            </div>
            <div className="flex justify-between rounded-lg border border-line/60 px-2 py-1.5">
              <span className="text-mist">TIF</span>
              <span>Day</span>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-accent py-2.5 text-center text-xs font-bold text-ink">
            Review paper order →
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroCtas({
  isLoaded,
  isSignedIn,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <a
        href="/trade"
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-good px-7 py-3 text-base font-bold text-ink shadow-lg shadow-good/25 transition hover:brightness-110"
      >
        Open Trade floor →
      </a>
      {clerkEnabled && isLoaded && !isSignedIn && (
        <>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-accent/50 bg-accent/10 px-6 py-3 text-base font-semibold text-accent transition hover:bg-accent/20"
            >
              Create free account
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button
              type="button"
              className="text-sm font-medium text-mist underline-offset-4 hover:text-white hover:underline"
            >
              Sign in
            </button>
          </SignInButton>
        </>
      )}
      {(!clerkEnabled || (isLoaded && isSignedIn)) && (
        <a
          href="/desk"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-accent/40 hover:text-white"
        >
          AI Desk
        </a>
      )}
    </div>
  );
}

function HeroCtasClerk() {
  const { isLoaded, isSignedIn } = useAuth();
  return <HeroCtas isLoaded={isLoaded} isSignedIn={Boolean(isSignedIn)} />;
}

export default function MarketingLandingClassic() {
  return (
    <main className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.18),transparent)]"
        aria-hidden
      />

      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <IndieTradesLogo
            size={44}
            withWordmark
            className="origin-left scale-110"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-good/40 bg-good/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-good">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
              Paper desk · not a broker
            </span>
            <a
              href="/?landing=photos"
              className="rounded-full border border-line px-3 py-1 font-mono text-[10px] text-mist transition hover:border-accent/40 hover:text-white"
            >
              Photo landing
            </a>
          </div>
        </div>

        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.22em] text-accent">
              Stock market practice
            </p>
            <h1 className="bridge-title text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]">
              Practice stock trading
              <span className="block text-accent">before real money.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-mist sm:text-lg">
              IndieTrades is a{" "}
              <strong className="font-semibold text-slate-200">
                paper trading floor
              </strong>
              : real tickers, red/green charts, a real ticket, and a blotter that
              means something. Virtual cash. You confirm every order. Optional
              Grok research on the AI Desk.
            </p>

            {clerkEnabled ? (
              <HeroCtasClerk />
            ) : (
              <HeroCtas isLoaded isSignedIn={false} />
            )}

            <ul className="mt-8 flex flex-wrap gap-2">
              {["Virtual cash", "Real symbols", "You confirm", "PAPER only"].map(
                (t) => (
                  <li
                    key={t}
                    className="rounded-full border border-line/80 bg-ink/50 px-3 py-1 font-mono text-[11px] text-slate-300"
                  >
                    {t}
                  </li>
                )
              )}
            </ul>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-4 rounded-3xl bg-accent/10 blur-2xl"
              aria-hidden
            />
            {/* Single top shot only — pixel trade floor (Paper only · chart · ticket · blotter) */}
            <div className="relative overflow-hidden rounded-2xl border border-line/80 shadow-2xl shadow-accent/15 ring-1 ring-accent/20">
              <Image
                src="/landing/trade-floor-pixel-card.jpg"
                alt="IndieTrades paper trade floor with chart, ticket, and blotter"
                width={1400}
                height={900}
                className="h-auto w-full object-cover object-top"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <p className="mt-3 text-center font-mono text-[10px] text-mist">
              Paper only · Trade floor — live desk uses honest quotes + PaperSim
            </p>
          </div>
        </div>
      </section>

      <MarketRibbon />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="hud-label mb-1">The facts</p>
            <h2 className="bridge-title text-2xl font-bold sm:text-3xl">
              No hype. No fake tape. Straight product.
            </h2>
          </div>
          <IndieTradesMark size={48} className="text-accent opacity-80" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FACTS.map((f) => (
            <article
              key={f.k}
              className="rounded-2xl border border-line/80 bg-panel/60 p-5 transition hover:border-accent/30"
            >
              <h3 className="font-mono text-sm font-bold uppercase tracking-wide text-accent">
                {f.k}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{f.v}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line/70 bg-panel/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
          <p className="hud-label mb-1">How IndieTrades maps</p>
          <h2 className="bridge-title mb-8 text-2xl font-bold sm:text-3xl">
            Think · Act · Pay
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PILLARS.map((p) => (
              <a
                key={p.href}
                href={p.href}
                className={`group flex flex-col rounded-2xl border p-6 transition ${
                  p.primary
                    ? "border-good/40 bg-good/5 hover:border-good/60"
                    : "border-line/80 bg-ink/40 hover:border-accent/35"
                }`}
              >
                <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-mist">
                  {p.mode}
                </span>
                <span className="mt-2 text-xl font-bold text-white">{p.title}</span>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mist">
                  {p.body}
                </p>
                <span
                  className={`mt-5 text-sm font-semibold ${
                    p.primary ? "text-good" : "text-accent"
                  }`}
                >
                  {p.cta} →
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-line/80 bg-gradient-to-br from-panel/90 to-ink/80 p-6 sm:p-10">
          <p className="hud-label mb-2">Control plane</p>
          <h2 className="bridge-title text-xl font-bold sm:text-2xl">
            Research → Policy → You confirm → PaperSim
          </h2>
          <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["1", "Research", "Optional Grok on AI Desk — opinion, not a guarantee."],
              ["2", "Policy", "Risk rules in code. LLM never submits."],
              ["3", "Confirm", "TTL preflight. You approve every paper order."],
              ["4", "PaperSim", "Fill or working limit. Journal. Still paper."],
            ].map(([n, t, b]) => (
              <li
                key={n}
                className="rounded-xl border border-line/60 bg-ink/50 px-4 py-4"
              >
                <span className="font-mono text-2xl font-bold text-accent/80">
                  {n}
                </span>
                <p className="mt-1 font-semibold text-white">{t}</p>
                <p className="mt-1 text-xs leading-relaxed text-mist">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="relative overflow-hidden rounded-3xl border border-good/30 bg-good/5 px-6 py-10 text-center sm:px-12 sm:py-14">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.12),transparent_65%)]"
            aria-hidden
          />
          <IndieTradesMark size={56} className="mx-auto text-good" />
          <h2 className="relative mt-4 text-2xl font-bold text-white sm:text-3xl">
            Ready to practice?
          </h2>
          <p className="relative mx-auto mt-3 max-w-lg text-sm text-mist sm:text-base">
            Open the floor. Pick a symbol. Confirm a paper trade. Learn the
            process before real money is on the line.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/trade"
              className="inline-flex min-h-12 items-center rounded-full bg-good px-8 py-3 text-base font-bold text-ink shadow-lg shadow-good/20 hover:brightness-110"
            >
              Open Trade floor
            </a>
            <a
              href="/desk"
              className="inline-flex min-h-12 items-center rounded-full border border-line px-6 py-3 text-sm font-semibold text-slate-200 hover:border-accent/40"
            >
              AI Desk
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line/60 py-8 text-center">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 sm:px-6">
          <IndieTradesLogo size={28} withWordmark />
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-mist">
            IndieTrades · indietrades.com · educational paper trading · not
            investment advice · not a securities broker · simulated fills only
          </p>
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-mist">
            <a href="/trade" className="hover:text-white">
              Trade
            </a>
            <a href="/desk" className="hover:text-white">
              AI Desk
            </a>
            <a href="/plans" className="hover:text-white">
              Plans
            </a>
            <a href="/paper-trading" className="hover:text-white">
              Learn
            </a>
            <a href="/stock-market-simulator" className="hover:text-white">
              Simulator
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
