/**
 * Canonical site URL + SEO defaults for IndieTrades.
 * Prefer NEXT_PUBLIC_APP_URL in production: https://indietrades.com
 */
export function getSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://indietrades.com";
  return raw.replace(/\/$/, "");
}

export const SITE_NAME = "IndieTrades";

export const DEFAULT_DESCRIPTION =
  "IndieTrades is an AI paper trading desk: Grok researches, a policy engine gates risk, you confirm, PaperSim fills. Real stock symbols, virtual money. Not investment advice.";

export const SEO_KEYWORDS = [
  "paper trading",
  "AI paper trading",
  "paper trading desk",
  "stock market simulator",
  "AI trading desk",
  "paper trade stocks",
  "Grok trading",
  "Claude trading bot alternative",
  "Webull paper trading alternative",
  "practice stock trading free",
  "virtual trading account",
  "paper trading with AI",
  "IndieTrades",
  "risk free stock trading practice",
  "AI stock research desk",
];

/** Google Search Console HTML meta (optional env override). */
export const GOOGLE_SITE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION?.trim() || "";
