import type { Metadata } from "next";
import Link from "next/link";
import {
  JsonLd,
  SeoCta,
  SeoPageShell,
} from "@/components/seo-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Stock Market Simulator — Free Virtual Trading Desk",
  description:
    "Free stock market simulator from IndieTrades: virtual cash, real tickers, positions, day P&L, reset anytime. Plus optional AI research with policy gates.",
  keywords: [
    "stock market simulator",
    "stock simulator free",
    "virtual stock trading",
    "stock trading simulator online",
    "best stock market simulator",
  ],
  alternates: { canonical: "/stock-market-simulator" },
  openGraph: {
    title: "Stock market simulator — IndieTrades",
    description:
      "Practice stocks with virtual money. Ticket, watchlist, P&L, reset.",
    url: "/stock-market-simulator",
    type: "website",
  },
};

const site = getSiteUrl();
const PAGE_DESC =
  "Free stock market simulator from IndieTrades: virtual cash, real tickers, positions, day P&L, reset anytime. Plus optional AI research with policy gates.";

export default function StockSimulatorPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${SITE_NAME} Stock Market Simulator`,
    applicationCategory: "FinanceApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
    url: `${site}/stock-market-simulator`,
    description: PAGE_DESC,
  };

  return (
    <SeoPageShell>
      <JsonLd data={jsonLd} />
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
        Stock market simulator
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        Free stock market simulator — with a real trading floor
      </h1>
      <p className="mt-4 text-base leading-relaxed text-mist">
        Simulators like Webull paper or TradingView paper teach the buttons.
        IndieTrades adds an{" "}
        <strong className="text-slate-200">AI research desk</strong> and a{" "}
        <strong className="text-slate-200">hard confirm gate</strong> so practice
        builds good habits.
      </p>
      <SeoCta primary="Open simulator (Trade floor)" />

      <section className="mt-12 space-y-3">
        <h2 className="text-xl font-semibold text-white">What you get</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-mist">
          <li>~$100k virtual cash per account (reset anytime)</li>
          <li>Watchlist + live-ish quotes</li>
          <li>Buy/sell limit ticket with max shares estimate</li>
          <li>Positions, day P&amp;L, recent paper fills</li>
          <li>Optional Grok research on the AI Desk</li>
        </ul>
      </section>

      <p className="mt-10 text-sm text-mist">
        Compare:{" "}
        <Link href="/vs/webull-paper" className="text-accent hover:underline">
          vs Webull paper trading
        </Link>
        .
      </p>
    </SeoPageShell>
  );
}
