"use client";

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "AI Desk", match: (p: string) => p === "/" },
  {
    href: "/trade",
    label: "Trade",
    match: (p: string) => p.startsWith("/trade"),
    primary: true,
  },
  {
    href: "/plans",
    label: "Plans",
    match: (p: string) => p.startsWith("/plans"),
  },
] as const;

/**
 * Phone bottom bar — primary navigation without crowding the top header.
 */
export default function MobileBottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-panel/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Main"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const primary = "primary" in tab && tab.primary;
          return (
            <li key={tab.href} className="flex-1">
              <a
                href={tab.href}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-center transition ${
                  active
                    ? primary
                      ? "text-good"
                      : "text-accent"
                    : "text-mist hover:text-slate-200"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                    active
                      ? primary
                        ? "bg-good/15 ring-1 ring-good/40"
                        : "bg-accent/15 ring-1 ring-accent/40"
                      : "bg-ink/50"
                  }`}
                  aria-hidden
                >
                  {tab.label === "AI Desk" ? "💬" : tab.label === "Trade" ? "📈" : "💎"}
                </span>
                <span className="text-[10px] font-semibold tracking-wide">
                  {tab.label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
