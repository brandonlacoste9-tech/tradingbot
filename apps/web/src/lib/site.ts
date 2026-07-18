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
  "IndieTrades: Grok looks at the market and tells you what looks good or skippable for paper practice — policy checks risk, you confirm, virtual fills. Not investment advice. You're responsible for your decisions.";

/** Short brand line for hero / social */
export const BRAND_TAGLINE =
  "Grok calls the setup. You confirm. Paper only — not advice, not our money.";

export const SEO_KEYWORDS = [
  "paper trading",
  "AI paper trading",
  "paper trading desk",
  "stock market simulator",
  "AI trading desk",
  "paper trade stocks",
  "Grok trading",
  "Grok stock market",
  "Grok paper trading",
  "AI stock research",
  "Claude trading bot alternative",
  "Webull paper trading alternative",
  "practice stock trading free",
  "virtual trading account",
  "paper trading with AI",
  "IndieTrades",
  "risk free stock trading practice",
  "AI stock research desk",
];

/**
 * Google Search Console HTML meta verification (public by design).
 * Content value only — not the "google-site-verification=" prefix.
 * Override with GOOGLE_SITE_VERIFICATION env if you rotate the property.
 */
export const GOOGLE_SITE_VERIFICATION =
  process.env.GOOGLE_SITE_VERIFICATION?.trim() ||
  "0yPwOioMKL-oZJEJdUwjUJLqfDO6qKvDKjsQ_o7PPao";
