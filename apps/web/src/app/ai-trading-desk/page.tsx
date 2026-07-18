import type { Metadata } from "next";
import Link from "next/link";
import {
  JsonLd,
  SeoCta,
  SeoPageShell,
} from "@/components/seo-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Trading Desk — Research, Policy, Confirm (Paper)",
  description:
    "IndieTrades is an AI trading desk for paper practice: chat research, risk policy, human confirm, virtual portfolio. Two modes — AI Desk and Trade floor.",
  keywords: [
    "AI trading desk",
    "AI stock research desk",
    "paper trading desk",
    "AI trading platform paper",
  ],
  alternates: { canonical: "/ai-trading-desk" },
  openGraph: {
    title: "AI trading desk — IndieTrades",
    description: "Think on AI Desk. Act on Trade. Paper only by default.",
    url: "/ai-trading-desk",
    type: "website",
  },
};

const site = getSiteUrl();
const PAGE_DESC =
  "IndieTrades is an AI trading desk for paper practice: chat research, risk policy, human confirm, virtual portfolio. Two modes — AI Desk and Trade floor.";

export default function AiTradingDeskPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "AI Trading Desk",
    url: `${site}/ai-trading-desk`,
    description: PAGE_DESC,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: site },
  };

  return (
    <SeoPageShell>
      <JsonLd data={jsonLd} />
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
        Product map
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        An AI trading desk with two clear modes
      </h1>
      <p className="mt-4 text-base leading-relaxed text-mist">
        IndieTrades splits the product so newcomers always know where they are:
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/",
            t: "AI Desk",
            d: "Research with Grok. Proposals need your confirm.",
          },
          {
            href: "/trade",
            t: "Trade floor",
            d: "Manual ticket, watchlist, positions — paper fills.",
          },
          {
            href: "/plans",
            t: "Plans",
            d: "Free practice. Pro / Pro+ for higher chat limits.",
          },
        ].map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-2xl border border-line bg-panel/50 p-4 transition hover:border-accent/40"
          >
            <p className="font-semibold text-white">{c.t}</p>
            <p className="mt-1 text-sm text-mist">{c.d}</p>
          </Link>
        ))}
      </div>
      <SeoCta />
      <p className="mt-10 text-sm text-mist">
        Not a black-box live bot. Educational paper trading only.{" "}
        <Link href="/paper-trading" className="text-accent hover:underline">
          What is paper trading?
        </Link>
      </p>
    </SeoPageShell>
  );
}
