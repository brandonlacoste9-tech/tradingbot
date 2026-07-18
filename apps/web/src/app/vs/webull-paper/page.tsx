import type { Metadata } from "next";
import {
  JsonLd,
  SeoCta,
  SeoPageShell,
} from "@/components/seo-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "IndieTrades vs Webull Paper Trading",
  description:
    "Compare IndieTrades and Webull paper trading: charts vs AI research desk, one-tap live path vs paper-first product, policy + confirm vs direct paper fill.",
  keywords: [
    "Webull paper trading alternative",
    "IndieTrades vs Webull",
    "Webull paperTrade vs AI desk",
    "best paper trading with AI",
  ],
  alternates: { canonical: "/vs/webull-paper" },
  openGraph: {
    title: "IndieTrades vs Webull paper",
    description:
      "Webull paper teaches the button. IndieTrades adds research, policy, and confirm.",
    url: "/vs/webull-paper",
    type: "website",
  },
};

const site = getSiteUrl();
const PAGE_DESC =
  "Compare IndieTrades and Webull paper trading: charts vs AI research desk, one-tap live path vs paper-first product, policy + confirm vs direct paper fill.";

const ROWS = [
  {
    topic: "Primary job",
    us: "AI paper desk + control plane",
    them: "Broker paper sandbox → live account",
  },
  {
    topic: "Charts / Level 2",
    us: "Focused ticket + watchlist (charts later)",
    them: "Deep charting & active-trader tools",
  },
  {
    topic: "AI research",
    us: "Grok chat with tool loop",
    them: "Secondary / strategy helpers",
  },
  {
    topic: "Risk gate",
    us: "Hard policy engine + confirm TTL",
    them: "User discipline on paper ticket",
  },
  {
    topic: "Default money path",
    us: "Paper-first product",
    them: "Paper then one-tap live",
  },
  {
    topic: "Multi-user SaaS",
    us: "Clerk + per-user PaperSim",
    them: "Broker account model",
  },
] as const;

export default function VsWebullPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "IndieTrades vs Webull Paper Trading",
    url: `${site}/vs/webull-paper`,
    description: PAGE_DESC,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: site },
  };

  return (
    <SeoPageShell maxWidth="max-w-4xl">
      <JsonLd data={jsonLd} />
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
        Comparison
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
        IndieTrades vs Webull paper trading
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-mist">
        Webull paperTrade is an excellent broker simulator. IndieTrades is not
        trying to replace their chart stack — we productize{" "}
        <strong className="text-slate-200">research → policy → confirm → paper</strong>.
      </p>
      <SeoCta />

      <div className="mt-12 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line bg-panel/80 text-xs uppercase tracking-wider text-mist">
            <tr>
              <th className="px-4 py-3 font-semibold">Topic</th>
              <th className="px-4 py-3 font-semibold text-accent">IndieTrades</th>
              <th className="px-4 py-3 font-semibold">Webull paper (typical)</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.topic} className="border-b border-line/70">
                <td className="px-4 py-3 font-medium text-white">{r.topic}</td>
                <td className="px-4 py-3 text-mist">{r.us}</td>
                <td className="px-4 py-3 text-mist">{r.them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-xs text-mist">
        Webull is a third-party broker. Features change — verify on Webull&apos;s
        site. This page positions IndieTrades for search intent.
      </p>
    </SeoPageShell>
  );
}
