import type { Metadata } from "next";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import ClerkTokenSync from "@/components/ClerkTokenSync";
import { IndieTradesLogo } from "@/components/indie-trades-logo";
import ProductionBanner from "@/components/production-banner";
import ThemeToggle from "@/components/ThemeToggle";
import {
  DEFAULT_DESCRIPTION,
  getSiteUrl,
  GOOGLE_SITE_VERIFICATION,
  SEO_KEYWORDS,
  SITE_NAME,
} from "@/lib/site";
import "./globals.css";

const siteUrl = getSiteUrl();

/** Prevent theme flash before React hydrates */
const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('indietrades_theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${SITE_NAME} — AI Paper Trading Desk | Practice Stocks Free`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  authors: [{ name: SITE_NAME, url: siteUrl }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "finance",
  openGraph: {
    title: `${SITE_NAME} — AI paper trading desk`,
    description: DEFAULT_DESCRIPTION,
    url: siteUrl,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_CA",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI paper trading desk`,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: GOOGLE_SITE_VERIFICATION
    ? { google: GOOGLE_SITE_VERIFICATION }
    : undefined,
};

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AuthChrome() {
  return (
    <header className="relative z-50 flex h-14 items-center justify-between border-b border-line/80 bg-panel/70 px-4 backdrop-blur-xl sm:h-16 sm:px-6">
      <div className="flex items-center gap-3 sm:gap-6">
        <a
          href="/"
          className="flex items-center transition hover:opacity-90"
          aria-label="IndieTrades home"
        >
          <IndieTradesLogo size={36} withWordmark />
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="/"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white sm:px-3 sm:text-sm"
          >
            AI Desk
          </a>
          <a
            href="/trade"
            className="rounded-full border border-good/40 bg-good/10 px-2.5 py-1.5 text-xs font-semibold text-good transition hover:bg-good/20 sm:px-3 sm:text-sm"
          >
            Trade
          </a>
          <a
            href="/plans"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white sm:px-3 sm:text-sm"
          >
            Plans
          </a>
          <a
            href="/paper-trading"
            className="hidden rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white md:inline sm:px-3 sm:text-sm"
          >
            Learn
          </a>
        </nav>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-good/30 bg-good/5 px-2.5 py-1 font-mono text-xs text-good sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
          PAPER ONLY
        </span>
        <ThemeToggle />
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button
              type="button"
              className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-accent/50 hover:text-white"
            >
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              type="button"
              className="hud-btn-primary h-10 cursor-pointer rounded-full px-5 text-sm sm:h-11"
            >
              Sign Up
            </button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const htmlClass = `${geistSans.variable} ${geistMono.variable} h-full antialiased`;

  if (!clerkPk) {
    return (
      <html lang="en" className={htmlClass} data-theme="dark" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        </head>
        <body className="flex min-h-full flex-col">
          <header className="relative z-50 flex h-14 items-center justify-end border-b border-line/80 bg-panel/70 px-4 backdrop-blur-xl sm:h-16 sm:px-6">
            <ThemeToggle />
          </header>
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={htmlClass} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ClerkProvider
          localization={{
            signIn: {
              start: {
                title: "Sign in to IndieTrades",
                subtitle: "Paper desk · research → confirm · no live brokerage",
              },
            },
            signUp: {
              start: {
                title: "Join IndieTrades",
                subtitle: "Free paper desk. Upgrade anytime on Plans.",
              },
            },
          }}
        >
          <ClerkTokenSync />
          <ProductionBanner />
          <AuthChrome />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
