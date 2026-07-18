import type { Metadata } from "next";
import MarketingLanding from "@/components/marketing-landing";
import {
  BRAND_TAGLINE,
  DEFAULT_DESCRIPTION,
  getSiteUrl,
  SITE_NAME,
} from "@/lib/site";

const site = getSiteUrl();

export const metadata: Metadata = {
  title: `${SITE_NAME} — Practice Stock Trading Before Real Money`,
  description: DEFAULT_DESCRIPTION,
  alternates: { canonical: site },
  openGraph: {
    title: `${SITE_NAME} — Practice trading before real money`,
    description: DEFAULT_DESCRIPTION,
    url: site,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${BRAND_TAGLINE}`,
    description: DEFAULT_DESCRIPTION,
  },
};

/**
 * Public marketing home — logo, desk preview, facts.
 * Product surfaces: /trade (act), /desk (think), /plans (pay).
 */
export default function HomePage() {
  return <MarketingLanding />;
}
