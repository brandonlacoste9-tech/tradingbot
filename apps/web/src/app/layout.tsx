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
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

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
  title: "IndieTrades — Paper trading desk",
  description:
    "IndieTrades (indietrades.com): research → policy → confirm. Multi-user paper trading. Not investment advice.",
};

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AuthChrome() {
  return (
    <header className="relative z-50 flex h-14 items-center justify-between border-b border-line/80 bg-panel/70 px-4 backdrop-blur-xl sm:h-16 sm:px-6">
      <div className="flex items-center gap-3 sm:gap-6">
        <a href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10">
            <span className="font-mono text-sm font-bold text-accent">IT</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold tracking-wide text-white">
              IndieTrades
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent/60">
              paper desk
            </div>
          </div>
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="/"
            className="rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white sm:px-3 sm:text-sm"
          >
            Desk
          </a>
          <a
            href="/plans"
            className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20 sm:px-3 sm:text-sm"
          >
            Plans
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
          <AuthChrome />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
