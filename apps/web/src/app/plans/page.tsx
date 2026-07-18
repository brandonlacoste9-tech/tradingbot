import type { Metadata } from "next";
import Link from "next/link";
import BillingReturnBanner from "@/components/billing-return-banner";
import PlanCheckout from "@/components/PlanCheckout";

export const metadata: Metadata = {
  title: "Plans & Pricing — Free, Pro, Pro+ (CAD)",
  description:
    "IndieTrades pricing: Free paper desk, Indie Pro (~$29 CAD), Indie Pro+ (~$59 CAD). Higher AI chat limits. Policy + human confirm. Not investment advice.",
  alternates: { canonical: "/plans" },
  openGraph: {
    title: "IndieTrades plans & pricing",
    description: "Free paper practice. Upgrade chat limits when you're ready.",
    url: "/plans",
    type: "website",
  },
};

const FREE_FEATURES = [
  "Full paper trading desk (PaperSim)",
  "Research → policy → human confirm",
  "25 chats / day",
  "Market data cascade",
  "Journal, audit, preflight risk checks",
  "Paper-only by default",
];

const PRO_FEATURES = [
  "Everything in Free",
  "~10,000 chats / day",
  "Grok research at scale",
  "Same policy + confirm rails",
  "Stripe customer portal",
  "Promo codes at Checkout",
];

const PRO_PLUS_FEATURES = [
  "Everything in Pro",
  "~50,000 chats / day",
  "Highest research headroom",
  "Same sacred control plane",
  "Best for heavy daily iteration",
  "Portal for cancel / payment method",
];

const COMPARE: {
  feature: string;
  free: string;
  pro: string;
  proPlus: string;
}[] = [
  { feature: "Paper desk", free: "Yes", pro: "Yes", proPlus: "Yes" },
  {
    feature: "Policy + confirm TTL",
    free: "Yes",
    pro: "Yes",
    proPlus: "Yes",
  },
  {
    feature: "Daily chat / research",
    free: "25",
    pro: "~10,000",
    proPlus: "~50,000",
  },
  {
    feature: "Market data",
    free: "Included",
    pro: "Included",
    proPlus: "Included",
  },
  {
    feature: "Live multi-tenant brokerage",
    free: "No",
    pro: "No",
    proPlus: "No",
  },
  {
    feature: "Price (CAD / month)",
    free: "$0",
    pro: "~$29",
    proPlus: "~$59",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is this live trading?",
    a: "No. IndieTrades is a paper desk. Orders go through a policy engine and human confirm into a simulated book (PaperSim). Not a broker.",
  },
  {
    q: "What’s the difference between Indie Pro and Indie Pro+?",
    a: "Mostly research headroom. Indie Pro is ~10k chats/day; Indie Pro+ is ~50k. The control plane (policy + confirm + paper fills) is the same.",
  },
  {
    q: "Can I use a promo code?",
    a: "Yes. On Stripe Checkout, choose “Add promotion code” and enter your code (for example INDIEPRO) before paying.",
  },
  {
    q: "How do I cancel or change plan?",
    a: "Use Manage subscription on this page to open the Stripe customer portal.",
  },
  {
    q: "Is this investment advice?",
    a: "No. Educational paper trading only. Not investment, tax, or legal advice.",
  },
];

export default function PlansPage() {
  return (
    <main className="relative flex-1 pb-16">
      <BillingReturnBanner />
      <section className="border-b border-line/70 bg-panel/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="hud-label mb-3">pricing</p>
          <h1 className="bridge-title max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Free, Indie Pro, and Indie Pro+ — same rails, more research room
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-mist sm:text-lg">
            Every plan keeps{" "}
            <span className="text-slate-200">
              research → deterministic policy → human confirm → paper fill
            </span>
            . Upgrade only when you need higher daily chat limits.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="hud-btn">
              ← Back to desk
            </Link>
            <a href="#compare" className="hud-btn">
              Compare all plans
            </a>
          </div>
        </div>
      </section>

      {/* Three tier cards */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Free */}
          <article className="hud-panel flex flex-col">
            <div className="hud-panel-header !border-0 !pb-0">
              <div>
                <div className="hud-label mb-1">starter</div>
                <h2 className="text-xl font-semibold text-white">Free</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-white">
                  $0
                </div>
                <div className="font-mono text-xs uppercase tracking-wider text-mist">
                  forever
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Learn the desk and the confirm path without a card.
            </p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-slate-300">
                  <Check />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-line/70 pt-5">
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-xl border border-line px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-accent/40 hover:text-white"
              >
                Open free desk
              </Link>
            </div>
          </article>

          {/* Pro $29 */}
          <article className="hud-panel relative flex flex-col ring-1 ring-accent/35">
            <div className="absolute -top-3 right-4 rounded-full border border-accent/40 bg-accent/15 px-3 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-accent">
              popular
            </div>
            <div className="hud-panel-header !border-0 !pb-0">
              <div>
                <div className="hud-label mb-1">power</div>
                <h2 className="text-xl font-semibold text-white">Indie Pro</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-white">
                  ~$29
                  <span className="text-sm font-normal text-mist"> CAD</span>
                </div>
                <div className="font-mono text-xs uppercase tracking-wider text-mist">
                  per month
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Serious research days without burning the free cap.
            </p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-slate-300">
                  <Check accent />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-3 border-t border-line/70 pt-5">
              <PlanCheckout
                variant="buy"
                checkoutPlan="pro"
                label="Get Indie Pro — Checkout"
              />
              <p className="text-xs leading-relaxed text-mist">
                Promo codes accepted on Stripe Checkout (e.g.{" "}
                <span className="font-mono text-slate-300">INDIEPRO</span>).
              </p>
            </div>
          </article>

          {/* Indie Pro+ $59 */}
          <article className="hud-panel flex flex-col ring-1 ring-cyan-400/25">
            <div className="hud-panel-header !border-0 !pb-0">
              <div>
                <div className="hud-label mb-1">max</div>
                <h2 className="text-xl font-semibold text-white">Indie Pro+</h2>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-white">
                  ~$59
                  <span className="text-sm font-normal text-mist"> CAD</span>
                </div>
                <div className="font-mono text-xs uppercase tracking-wider text-mist">
                  per month
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Highest daily chat headroom for heavy multi-session work.
            </p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {PRO_PLUS_FEATURES.map((f) => (
                <li key={f} className="flex gap-2 text-sm text-slate-300">
                  <Check accent />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-3 border-t border-line/70 pt-5">
              <PlanCheckout
                variant="buy"
                checkoutPlan="pro_plus"
                label="Get Indie Pro+ — Checkout"
              />
              <p className="text-xs leading-relaxed text-mist">
                Same paper-only control plane as Free and Indie Pro.
              </p>
            </div>
          </article>
        </div>
      </section>

      {/* Comparison */}
      <section
        id="compare"
        className="scroll-mt-20 border-y border-line/60 bg-panel/20"
      >
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="hud-label mb-2">side by side</p>
          <h2 className="text-2xl font-semibold text-white">Compare plans</h2>
          <p className="mt-2 max-w-xl text-sm text-mist">
            Safety rails are not a paid unlock — Free, Pro, and Pro+ share the
            same policy + confirm path.
          </p>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-ink/60 font-mono text-xs uppercase tracking-wider text-mist">
                  <th className="px-4 py-3 font-medium">Feature</th>
                  <th className="px-4 py-3 font-medium">Free</th>
                  <th className="px-4 py-3 font-medium text-accent">Indie Pro</th>
                  <th className="px-4 py-3 font-medium text-accent">Indie Pro+</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-line/60 last:border-0"
                  >
                    <td className="px-4 py-3 text-slate-200">{row.feature}</td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {row.free}
                    </td>
                    <td className="px-4 py-3 font-mono text-accent">
                      {row.pro}
                    </td>
                    <td className="px-4 py-3 font-mono text-accent">
                      {row.proPlus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <p className="hud-label mb-2">control plane</p>
        <h2 className="text-2xl font-semibold text-white">
          What every plan includes
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "Research",
              d: "Grok (or demo) tools — quotes, context, propose / hold only.",
            },
            {
              t: "Policy",
              d: "Pure Python limits: size, cash, kill switch, paper-only, session honesty.",
            },
            {
              t: "Confirm",
              d: "Human preflight with TTL. Policy re-checked before submit.",
            },
            {
              t: "Paper fill",
              d: "Per-user PaperSim book — journaled and audited per tenant.",
            },
          ].map((s) => (
            <div key={s.t} className="hud-stat">
              <div className="hud-label">{s.t}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line/60 bg-panel/15">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <p className="hud-label mb-2">faq</p>
          <h2 className="text-2xl font-semibold text-white">Questions</h2>
          <dl className="mt-8 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="max-w-3xl">
                <dt className="text-sm font-semibold text-white">{item.q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-mist">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="hud-panel flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Ready when you are
            </h2>
            <p className="mt-1 max-w-md text-sm text-mist">
              Stay on Free, pick Indie Pro (~$29), or Indie Pro+ (~$59) for max
              headroom.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            <div className="flex flex-wrap gap-2">
              <PlanCheckout
                variant="buy"
                checkoutPlan="pro"
                label="Get Indie Pro"
              />
              <PlanCheckout
                variant="buy"
                checkoutPlan="pro_plus"
                label="Get Indie Pro+"
              />
            </div>
            <Link
              href="/"
              className="text-center text-xs text-accent hover:underline sm:text-right"
            >
              Or open the desk without upgrading →
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center font-mono text-xs text-slate-600">
          IndieTrades · indietrades.com · educational paper trading · not
          investment advice · not a broker
        </p>
      </section>
    </main>
  );
}

function Check({ accent }: { accent?: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs ${
        accent ? "bg-accent/20 text-accent" : "bg-good/15 text-good"
      }`}
      aria-hidden
    >
      ✓
    </span>
  );
}
