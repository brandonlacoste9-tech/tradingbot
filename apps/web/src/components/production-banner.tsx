"use client";

/**
 * Visible only when the site is built with Clerk development keys.
 * Reminds operators not to run paid ads until pk_live_ is wired.
 */
export default function ProductionBanner() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
  if (!pk.startsWith("pk_test_")) return null;

  return (
    <div
      className="border-b border-warn/40 bg-warn/10 px-4 py-1.5 text-center font-mono text-xs text-warn"
      role="status"
    >
      Clerk <strong className="font-semibold">development</strong> keys (
      <code className="opacity-90">pk_test_</code>
      ). Fine for beta — switch to{" "}
      <code className="opacity-90">pk_live_</code> before paid traffic. See{" "}
      <span className="underline underline-offset-2">docs/PRODUCTION_HARDINESS.md</span>
    </div>
  );
}
