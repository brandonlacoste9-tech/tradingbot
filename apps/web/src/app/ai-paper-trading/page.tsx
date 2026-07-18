import type { Metadata } from "next";
import Link from "next/link";
import {
  JsonLd,
  SeoCta,
  SeoPageShell,
} from "@/components/seo-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Paper Trading — Grok Research + Human Confirm",
  description:
    "AI paper trading on IndieTrades: Grok researches markets, a hard policy engine gates risk, you confirm, PaperSim fills. Safer than DIY Claude + API-key bots.",
  keywords: [
    "AI paper trading",
    "paper trading with AI",
    "Grok trading paper",
    "AI stock trading practice",
    "Claude trading bot alternative paper",
  ],
  alternates: { canonical: "/ai-paper-trading" },
  openGraph: {
    title: "AI paper trading desk — IndieTrades",
    description:
      "Research with Grok. Policy gates. You confirm. Virtual fills only.",
    url: "/ai-paper-trading",
    type: "website",
  },
};

const site = getSiteUrl();
const PAGE_DESC =
  "AI paper trading on IndieTrades: Grok researches markets, a hard policy engine gates risk, you confirm, PaperSim fills. Safer than DIY Claude + API-key bots.";

export default function AiPaperTradingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: `${site}/ai-paper-trading`,
    description: PAGE_DESC,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "CAD",
    },
  };

  return (
    <SeoPageShell>
      <JsonLd data={jsonLd} />
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
        AI paper trading
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        AI that researches. You still approve.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-mist">
        Most “AI trading bots” skip the hard parts: risk gates, confirm, and an
        honest paper book. IndieTrades is{" "}
        <strong className="text-slate-200">AI paper trading</strong> with a
        control plane — Grok can dig and propose; code decides policy; you
        confirm; PaperSim fills.
      </p>
      <SeoCta primary="Try AI Desk" primaryHref="/" secondary="Trade floor" secondaryHref="/trade" />

      <section className="mt-12 space-y-3">
        <h2 className="text-xl font-semibold text-white">The control plane</h2>
        <pre className="overflow-x-auto rounded-xl border border-line bg-panel/60 p-4 font-mono text-sm text-slate-300">
{`Research (Grok / tools)
  → Policy engine (pure code)
  → awaiting_confirm + TTL
  → You Confirm
  → PaperSim fill
  → Journal + audit`}
        </pre>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-white">vs DIY Claude bots</h2>
        <p className="text-sm leading-relaxed text-mist">
          Tutorials that paste brokerage API keys into a desktop agent can
          submit without a product-level gate. IndieTrades keeps the LLM off the
          submit path. See{" "}
          <Link href="/vs/claude-trading-bots" className="text-accent hover:underline">
            IndieTrades vs Claude trading bots
          </Link>
          .
        </p>
      </section>
    </SeoPageShell>
  );
}
