import type { ReactNode } from "react";
import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/paper-trading", label: "Paper trading" },
  { href: "/ai-paper-trading", label: "AI paper trading" },
  { href: "/stock-market-simulator", label: "Stock simulator" },
  { href: "/ai-trading-desk", label: "AI trading desk" },
  { href: "/learn/how-paper-trading-works", label: "How it works" },
  { href: "/vs/webull-paper", label: "vs Webull paper" },
  { href: "/vs/claude-trading-bots", label: "vs Claude bots" },
  { href: "/plans", label: "Plans" },
  { href: "/trade", label: "Trade floor" },
  { href: "/llms.txt", label: "llms.txt" },
] as const;

export function SeoPageShell({
  children,
  maxWidth = "max-w-3xl",
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen bg-ink text-slate-100">
      <main className={`mx-auto ${maxWidth} px-4 py-12 sm:px-6 sm:py-16`}>
        {children}
      </main>
      <footer className="border-t border-line/80 px-4 py-10">
        <div
          className={`mx-auto ${maxWidth} flex flex-col gap-4 text-xs text-mist sm:flex-row sm:items-start sm:justify-between`}
        >
          <div>
            <p className="font-semibold text-slate-300">IndieTrades</p>
            <p className="mt-1 max-w-xs leading-relaxed">
              AI paper trading desk · research → policy → confirm · not investment
              advice
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/trade"
                className="rounded-full border border-good/40 bg-good/10 px-3 py-1 font-semibold text-good hover:bg-good/20"
              >
                Trade floor
              </Link>
              <Link
                href="/desk"
                className="rounded-full border border-line px-3 py-1 text-slate-300 hover:border-accent/40"
              >
                AI Desk
              </Link>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-3 gap-y-2 sm:max-w-md sm:justify-end">
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="hover:text-accent hover:underline"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function SeoCta({
  primary = "Open paper Trade floor",
  primaryHref = "/trade",
  secondary = "AI Desk",
  secondaryHref = "/desk",
}: {
  primary?: string;
  primaryHref?: string;
  secondary?: string;
  secondaryHref?: string;
}) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Link
        href={primaryHref}
        className="inline-flex items-center rounded-full bg-good px-5 py-2.5 text-sm font-semibold text-ink shadow-lg shadow-good/15 hover:brightness-110"
      >
        {primary} →
      </Link>
      <Link
        href={secondaryHref}
        className="inline-flex items-center rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-200 hover:border-accent/40"
      >
        {secondary}
      </Link>
    </div>
  );
}

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
