import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static export for simple Netlify hosting (client-only UI).
  // FastAPI backend is separate (local / Railway / Render / Fly).
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
