import type { Metadata } from "next";
import Link from "next/link";
import {
  JsonLd,
  SeoCta,
  SeoPageShell,
} from "@/components/seo-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "How Paper Trading Works — Beginner Guide",
  description:
    "How paper trading works: virtual cash, simulated orders, what fills mean, and how IndieTrades adds policy + confirm. Educational guide for beginners.",
  keywords: [
    "how paper trading works",
    "paper trading for beginners",
    "what is paper trading",
    "paper trading explained",
  ],
  alternates: { canonical: "/learn/how-paper-trading-works" },
  openGraph: {
    title: "How paper trading works",
    description: "Beginner guide to virtual stock practice — and IndieTrades.",
    url: "/learn/how-paper-trading-works",
    type: "article",
  },
};

const site = getSiteUrl();
const PAGE_DESC =
  "How paper trading works: virtual cash, simulated orders, what fills mean, and how IndieTrades adds policy + confirm. Educational guide for beginners.";

export default function HowPaperWorksPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to paper trade on IndieTrades",
    description: PAGE_DESC,
    step: [
      {
        "@type": "HowToStep",
        name: "Sign in",
        text: "Create an account — you receive a virtual paper book.",
      },
      {
        "@type": "HowToStep",
        name: "Open Trade floor",
        text: "Use watchlist and order ticket with real symbols.",
      },
      {
        "@type": "HowToStep",
        name: "Review and confirm",
        text: "Policy checks risk; you confirm within the TTL.",
      },
      {
        "@type": "HowToStep",
        name: "Track results",
        text: "Positions, day P&L, and journal update after paper fills.",
      },
    ],
    tool: { "@type": "HowToTool", name: SITE_NAME },
    url: `${site}/learn/how-paper-trading-works`,
  };

  return (
    <SeoPageShell>
      <JsonLd data={jsonLd} />
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
        Learn
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        How paper trading works
      </h1>
      <p className="mt-4 text-base leading-relaxed text-mist">
        Paper trading is practice with <strong className="text-slate-200">fake money</strong>{" "}
        and <strong className="text-slate-200">real market symbols</strong>. Orders do not
        hit a live brokerage for the multi-user product. You still feel the workflow:
        ticket → fill → portfolio.
      </p>
      <SeoCta />

      <section className="mt-12 space-y-3">
        <h2 className="text-xl font-semibold text-white">Honest fill model</h2>
        <p className="text-sm leading-relaxed text-mist">
          Simulators often fill against last/mark prices, not a full exchange book.
          IndieTrades PaperSim is for skill and process — not perfect market microstructure.
          That honesty matters more than marketing “identical to live.”
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-xl font-semibold text-white">What IndieTrades adds</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-mist">
          <li>AI research path (optional)</li>
          <li>Policy engine before confirm</li>
          <li>Human confirm with countdown TTL</li>
          <li>Journal / audit of decisions</li>
        </ul>
      </section>

      <p className="mt-10 text-sm text-mist">
        Next:{" "}
        <Link href="/paper-trading" className="text-accent hover:underline">
          paper trading product page
        </Link>{" "}
        or{" "}
        <Link href="/trade" className="text-good hover:underline">
          open the floor
        </Link>
        .
      </p>
    </SeoPageShell>
  );
}
