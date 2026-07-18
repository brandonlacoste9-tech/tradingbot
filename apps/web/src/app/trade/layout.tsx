import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Paper Trading Floor — Ticket, Watchlist, Positions",
  description:
    "IndieTrades paper trading floor: real stock symbols, virtual cash, limit ticket, policy preflight, confirm, positions and day P&L. Simulated fills only.",
  alternates: { canonical: "/trade" },
  openGraph: {
    title: "Paper trading floor — IndieTrades",
    description: "Practice like it's real. Paper only.",
    url: "/trade",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function TradeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
