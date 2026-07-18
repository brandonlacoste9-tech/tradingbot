import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Clerk middleware requires a Node server runtime (not `output: "export"`).
  // Netlify uses @netlify/plugin-nextjs for SSR/ISR.
  images: { unoptimized: true },
};

export default nextConfig;
