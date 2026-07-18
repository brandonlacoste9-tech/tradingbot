import type { Metadata } from "next";
import {
  JsonLd,
  SeoCta,
  SeoPageShell,
} from "@/components/seo-page-shell";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "IndieTrades vs Claude AI Trading Bots",
  description:
    "Claude Desktop + Alpaca tutorials vs IndieTrades: multi-user paper desk, policy engine, human confirm TTL, no LLM order submit. Safer practice path.",
  keywords: [
    "Claude trading bot alternative",
    "Claude AI trading",
    "Claude Alpaca paper trading",
    "AI trading bot vs paper desk",
    "Grok vs Claude trading bot",
  ],
  alternates: { canonical: "/vs/claude-trading-bots" },
  openGraph: {
    title: "IndieTrades vs Claude trading bots",
    description:
      "DIY agent + API keys vs productized paper desk with policy + confirm.",
    url: "/vs/claude-trading-bots",
    type: "website",
  },
};

const site = getSiteUrl();
const PAGE_DESC =
  "Claude Desktop + Alpaca tutorials vs IndieTrades: multi-user paper desk, policy engine, human confirm TTL, no LLM order submit. Safer practice path.";

const ROWS = [
  {
    topic: "Runtime",
    us: "Web multi-user SaaS (Netlify + API)",
    them: "Claude Desktop on your PC",
  },
  {
    topic: "Broker default",
    us: "PaperSim (Canada-safe SaaS default)",
    them: "Often Alpaca paper/live keys",
  },
  {
    topic: "Who submits orders",
    us: "Only after human confirm",
    them: "Agent can drive API if configured that way",
  },
  {
    topic: "Risk policy",
    us: "Server-side pure engine",
    them: "Prompt discipline / user skill",
  },
  {
    topic: "Audit",
    us: "Journal + audit per tenant",
    them: "Chat history / local logs",
  },
  {
    topic: "Unattended bots",
    us: "Not the v1 product",
    them: "Common tutorial end-state",
  },
] as const;

export default function VsClaudeBotsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "IndieTrades vs Claude AI Trading Bots",
    url: `${site}/vs/claude-trading-bots`,
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
        IndieTrades vs Claude AI trading bots
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-mist">
        Viral tutorials show Claude talking to Alpaca. That proves demand.
        IndieTrades is the desk those viewers grow into:{" "}
        <strong className="text-slate-200">paper by default</strong>,{" "}
        <strong className="text-slate-200">LLM never submits</strong>,{" "}
        <strong className="text-slate-200">you confirm</strong>.
      </p>
      <SeoCta primary="Open AI Desk" primaryHref="/" secondary="Trade floor" secondaryHref="/trade" />

      <div className="mt-12 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line bg-panel/80 text-xs uppercase tracking-wider text-mist">
            <tr>
              <th className="px-4 py-3 font-semibold">Topic</th>
              <th className="px-4 py-3 font-semibold text-accent">IndieTrades</th>
              <th className="px-4 py-3 font-semibold">Claude DIY bots (typical)</th>
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
        Claude and Alpaca are third-party products. This page is positioning for
        educational paper trading search intent — not an official partnership.
      </p>
    </SeoPageShell>
  );
}
