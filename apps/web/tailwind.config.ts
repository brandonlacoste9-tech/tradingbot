import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        panel: "#121a2b",
        line: "#1e2a44",
        accent: "#3b82f6",
        good: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
      },
    },
  },
  plugins: [],
};

export default config;
