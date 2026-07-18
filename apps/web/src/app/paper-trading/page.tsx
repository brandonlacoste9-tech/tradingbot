import type { Metadata } from "next";
import Link from "next/link";
import {
  JsonLd,
  SeoCta,
  SeoPageShell,
} from "@/components/seo-page-shell";
import {
  DEFAULT_DESCRIPTION,
  getSiteUrl,
  SITE_NAME,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Paper Trading — Practice Stocks With Virtual Money",
  description:
    "Paper trading on IndieTrades: real stock symbols, $100k virtual cash, order ticket, positions, and policy + confirm. Free stock market practice — not a live brokerage.",
  keywords: [
    "paper trading",
    "paper trade stocks",
    "virtual trading account",
    "practice stock trading free",
    "paper trading desk",
  ],
  alternates: { canonical: "/paper-trading" },
  openGraph: {
    title: "Paper trading on IndieTrades",
    description:
      "Real tickers. Virtual money. Policy + human confirm before every paper fill.",
    url: "/paper-trading",
    type: "website",
  },
};

const site = getSiteUrl();
const PAGE_DESC =
  "Paper trading on IndieTrades: real stock symbols, $100k virtual cash, order ticket, positions, and policy + confirm. Free stock market practice — not a live brokerage.";

export default function PaperTradingPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Paper Trading — IndieTrades",
      url: `${site}/paper-trading`,
      description: PAGE_DESC,
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: site },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is paper trading?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Paper trading is simulated stock trading with virtual money. You practice orders, positions, and risk without putting real capital at risk.",
          },
        },
        {
          "@type": "Question",
          name: "Is IndieTrades free paper trading?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Free tier includes the paper trading floor, policy checks, and human confirm. Paid plans raise AI research chat limits.",
          },
        },
        {
          "@type": "Question",
          name: "Is this a live brokerage?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. IndieTrades fills against PaperSim. It is educational paper trading, not investment advice and not live order routing for the multi-user product.",
          },
        },
      ],
    },
  ];

  return (
    <SeoPageShell>
      <JsonLd data={jsonLd} />
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
        Paper trading
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        Paper trading that feels like a real desk
      </h1>
      <p className="mt-4 text-base leading-relaxed text-mist">
        {DEFAULT_DESCRIPTION} Use the{" "}
        <Link href="/trade" className="text-good hover:underline">
          Trade floor
        </Link>{" "}
        for tickets, or the{" "}
        <Link href="/" className="text-accent hover:underline">
          AI Desk
        </Link>{" "}
        when you want Grok to research first.
      </p>
      <SeoCta />

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold text-white">Why paper trade?</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-mist">
          <li>Try stocks before you have large capital</li>
          <li>Learn the ticket, positions, and P&amp;L without stress</li>
          <li>Test strategies with a resetable virtual book</li>
          <li>Keep a journal of proposals, rejects, and paper fills</li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold text-white">How IndieTrades paper works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-mist">
          <li>Sign in — each user gets a ~$100k PaperSim book</li>
          <li>Watchlist + live-ish quotes on the Trade floor</li>
          <li>Build a limit ticket (or let AI propose on the AI Desk)</li>
          <li>Policy checks size, cash, and risk rules</li>
          <li>You confirm within a short TTL — then paper fill</li>
        </ol>
      </section>

      <p className="mt-10 text-xs text-mist">
        Related:{" "}
        <Link href="/stock-market-simulator" className="text-accent hover:underline">
          stock market simulator
        </Link>
        ,{" "}
        <Link href="/ai-paper-trading" className="text-accent hover:underline">
          AI paper trading
        </Link>
        ,{" "}
        <Link href="/learn/how-paper-trading-works" className="text-accent hover:underline">
          how paper trading works
        </Link>
        .
      </p>
    </SeoPageShell>
  );
}
