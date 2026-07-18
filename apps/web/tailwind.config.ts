import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        good: "rgb(var(--c-good) / <alpha-value>)",
        warn: "rgb(var(--c-warn) / <alpha-value>)",
        bad: "rgb(var(--c-bad) / <alpha-value>)",
        mist: "rgb(var(--c-mist) / <alpha-value>)",
        cream: "rgb(var(--c-cream) / <alpha-value>)",
        cognac: "rgb(var(--c-cognac) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Two steps up from default Tailwind for readability
        xs: ["0.875rem", { lineHeight: "1.25rem" }],
        sm: ["1rem", { lineHeight: "1.45rem" }],
        base: ["1.125rem", { lineHeight: "1.7rem" }],
        lg: ["1.25rem", { lineHeight: "1.85rem" }],
        xl: ["1.4rem", { lineHeight: "1.95rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.15rem" }],
        "3xl": ["2.15rem", { lineHeight: "2.5rem" }],
        "4xl": ["2.55rem", { lineHeight: "2.8rem" }],
      },
    },
  },
  plugins: [],
};

export default config;
