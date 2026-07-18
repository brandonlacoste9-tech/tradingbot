import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

const PATHS: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[0]["changeFrequency"];
  priority: number;
}[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/trade", changeFrequency: "weekly", priority: 0.95 },
  { path: "/plans", changeFrequency: "monthly", priority: 0.85 },
  { path: "/paper-trading", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ai-paper-trading", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ai-trading-desk", changeFrequency: "weekly", priority: 0.85 },
  { path: "/stock-market-simulator", changeFrequency: "weekly", priority: 0.9 },
  { path: "/learn/how-paper-trading-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/vs/webull-paper", changeFrequency: "monthly", priority: 0.8 },
  { path: "/vs/claude-trading-bots", changeFrequency: "monthly", priority: 0.8 },
  { path: "/llms.txt", changeFrequency: "monthly", priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();
  return PATHS.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
