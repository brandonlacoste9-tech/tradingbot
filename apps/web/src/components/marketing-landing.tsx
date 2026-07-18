"use client";

/**
 * Default home = classic layout + single pixel trade-floor hero.
 * Optional: /?landing=photos for alternate shell (same hero image).
 * Optional: NEXT_PUBLIC_LANDING_VARIANT=photos
 */
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MarketingLandingClassic from "@/components/marketing-landing-classic";
import MarketingLandingPhotos from "@/components/marketing-landing-photos";

function LandingInner() {
  const sp = useSearchParams();
  const envDefault = (
    process.env.NEXT_PUBLIC_LANDING_VARIANT || "classic"
  ).toLowerCase();
  const q = (sp.get("landing") || "").toLowerCase();
  // Always prefer classic unless explicitly photos
  if (q === "photos" || (q !== "classic" && envDefault === "photos")) {
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
