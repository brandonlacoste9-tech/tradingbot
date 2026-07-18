"use client";

/**
 * Optional operator strip for Clerk development keys.
 * Disabled on the public site (banner removed at owner request).
 * Re-enable by rendering <ProductionBanner /> from layout if needed.
 * Real fix before paid ads: wire pk_live_ after Clerk production DNS is ready
 * (clerk.indietrades.com → see docs/PRODUCTION_HARDINESS.md).
 */
export default function ProductionBanner() {
  return null;
}
