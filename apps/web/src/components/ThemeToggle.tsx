"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

const KEY = "indietrades_theme";

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
}

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

/**
 * Cognac light / night dark toggle. Persists to localStorage.
 */
export default function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = getStoredTheme();
    setMode(initial);
    applyTheme(initial);
    setReady(true);
  }, []);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    applyTheme(next);
  }

  if (!ready) {
    return (
      <button
        type="button"
        className="rounded-full border border-line px-2.5 py-1.5 text-xs text-mist"
        aria-label="Theme"
        disabled
      >
        ··
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-line bg-panel/60 px-2.5 py-1.5 text-xs font-medium text-mist transition hover:border-accent/50 hover:text-accent sm:px-3"
      title={mode === "dark" ? "Switch to cognac light" : "Switch to dark"}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {mode === "dark" ? "Light" : "Dark"}
    </button>
  );
}
