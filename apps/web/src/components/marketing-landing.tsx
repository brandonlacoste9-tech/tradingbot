"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MarketingLandingClassic from "@/components/marketing-landing-classic";
import MarketingLandingPhotos from "@/components/marketing-landing-photos";

/**
 * Landing switcher — easy revert between variants.
 *
 * Default: classic (copy + single pixel trade floor shot at top only)
 * Classic: /?landing=classic
 * Photos: /?landing=photos (same hero shot, alternate chrome)
 *
 * Env: NEXT_PUBLIC_LANDING_VARIANT=classic|photos
 */
function LandingInner() {
  const sp = useSearchParams();
  const envDefault =
    (process.env.NEXT_PUBLIC_LANDING_VARIANT || "classic").toLowerCase();
  const q = (sp.get("landing") || "").toLowerCase();
  const variant = q === "classic" || q === "photos" ? q : envDefault;

  if (variant === "photos") {
    return <MarketingLandingPhotos />;
  }
  return <MarketingLandingClassic />;
}

export default function MarketingLanding() {
  return (
    <Suspense fallback={<MarketingLandingClassic />}>
      <LandingInner />
    </Suspense>
  );
}
