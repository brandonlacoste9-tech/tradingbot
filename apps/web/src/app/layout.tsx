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
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IndieTrades — Paper desk",
  description:
    "IndieTrades (indietrades.com): research → policy → confirm. Multi-user paper trading. Not investment advice.",
};

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Demo mode without Clerk keys (local / misconfigured env).
  if (!clerkPk) {
    return (
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    );
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ClerkTokenSync />
          <header className="flex h-16 items-center justify-end gap-4 border-b border-line bg-panel/90 px-4 backdrop-blur-md">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-slate-200 hover:border-accent"
                >
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="h-10 cursor-pointer rounded-full bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90 sm:h-12 sm:px-5 sm:text-base"
                >
                  Sign Up
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
