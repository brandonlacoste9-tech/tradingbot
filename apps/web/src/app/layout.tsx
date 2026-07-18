import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Trading Bot — Paper",
  description: "L2 paper-trading agent orchestration (policy + confirm gate)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
