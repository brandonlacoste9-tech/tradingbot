"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MarketingLandingClassic from "@/components/marketing-landing-classic";
import MarketingLandingPhotos from "@/components/marketing-landing-photos";

/**
 * Landing switcher — easy revert between variants.
 *
 * Default: photos (product shots)
 * Classic (SVG desk chrome you liked): /?landing=classic
 * Photos: /?landing=photos
 *
 * Env override (Netlify): NEXT_PUBLIC_LANDING_VARIANT=classic|photos
 */
function LandingInner() {
  const sp = useSearchParams();
  const envDefault =
    (process.env.NEXT_PUBLIC_LANDING_VARIANT || "photos").toLowerCase();
  const q = (sp.get("landing") || "").toLowerCase();
  const variant = q === "classic" || q === "photos" ? q : envDefault;

  if (variant === "classic") {
    return <MarketingLandingClassic />;
  }
  return <MarketingLandingPhotos />;
}

export default function MarketingLanding() {
  return (
    <Suspense fallback={<MarketingLandingPhotos />}>
      <LandingInner />
    </Suspense>
  );
}
