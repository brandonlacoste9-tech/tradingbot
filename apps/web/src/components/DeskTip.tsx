"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TRADE_TIPS, type TradeTipId } from "@/lib/trade-tooltips";

type Props = {
  tip: TradeTipId;
  /** Visible label (e.g. Net liq) */
  children: ReactNode;
  className?: string;
  /** Hide the ? control (still hoverable on children wrapper) */
  hideMark?: boolean;
};

/**
 * Hover (desktop) + tap ? (mobile) explainer for Trade floor chrome.
 * Paper-honest copy from trade-tooltips.ts.
 */
export default function DeskTip({
  tip,
  children,
  className = "",
  hideMark = false,
}: Props) {
  const text = TRADE_TIPS[tip];
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent | TouchEvent) {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        close();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <span
      ref={rootRef}
      className={`group/tip relative inline-flex max-w-full items-center gap-1 ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="min-w-0">{children}</span>
      {!hideMark && (
        <button
          type="button"
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line/80 bg-ink/40 font-mono text-[10px] font-bold leading-none text-mist transition hover:border-accent/50 hover:text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
          aria-label={`What is ${typeof children === "string" ? children : tip}?`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          ?
        </button>
      )}
      {open && (
        <span
          id={panelId}
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-1.5 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-line bg-panel px-2.5 py-2 text-left font-sans text-[11px] font-normal normal-case tracking-normal text-slate-200 shadow-xl ring-1 ring-black/20"
        >
          {text}
        </span>
      )}
    </span>
  );
}
