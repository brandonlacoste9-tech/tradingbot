import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";
import ClerkTokenSync from "@/components/ClerkTokenSync";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Trading Desk — Paper",
  description:
    "Research → policy → confirm. Multi-user paper trading desk. Not investment advice.",
};

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Without a publishable key, render the desk without Clerk (demo X-User-Id mode).
  if (!clerkPk) {
    return (
      <html lang="en" className="h-full">
        <body className="min-h-full flex flex-col antialiased">{children}</body>
      </html>
    );
  }

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <ClerkProvider publishableKey={clerkPk}>
          <ClerkTokenSync />
          <header className="sr-only">
            {/* Accessible auth controls; primary UI also in UserBar / StatusStrip */}
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
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
