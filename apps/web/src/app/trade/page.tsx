"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import PreflightModal from "@/components/PreflightModal";
import SymbolChart, { type ChartBar } from "@/components/symbol-chart";
import {
  createProposal,
  listOrders,
  marketBars,
  marketQuotes,
  marketSession,
  paperReset,
  portfolio,
  validateConnection,
} from "@/lib/api";
import type { TradeProposal } from "@/lib/types";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const DEFAULT_WATCH = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META"];
const QUICK_QTY = ["1", "5", "10", "25", "100"];

const GREEN = "#22c55e";
const RED = "#ef4444";

type QuoteRow = {
  price: string | null;
  change?: string | null;
  change_percent?: string | null;
  source?: string | null;
  ok: boolean;
};

type BlotterTab = "positions" | "orders" | "fills";

function fmtMoney(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function fmtPx(v: string | null | undefined) {
  if (!v) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtPct(v: string | null | undefined) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace("%", ""));
  if (Number.isNaN(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pnlClass(v: string | number | null | undefined) {
  const n = Number(v);
  if (Number.isNaN(n) || n === 0) return "text-slate-300";
  return n > 0 ? "text-good" : "text-bad";
}

function chgColor(v: string | null | undefined): string {
  const n = Number(String(v ?? "").replace("%", ""));
  if (Number.isNaN(n) || n === 0) return "#94a3b8";
  return n > 0 ? GREEN : RED;
}

export default function TradePage() {
  if (clerkEnabled) {
    return <TradePageClerk />;
  }
  return <TradeDesk signedIn />;
}

function TradePageClerk() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-mist">
        Loading your paper floor…
      </main>
    );
  }
  if (!isSignedIn) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-good/40 bg-good/10 text-2xl">
          📈
        </div>
        <p className="hud-label mb-2">Paper trading floor</p>
        <h1 className="bridge-title text-2xl font-bold">
          Practice before real money
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          Real stock symbols · chart · ticket · $100k virtual cash.
          <br />
          Zero risk. Feels like the real desk.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton mode="modal">
            <button
              type="button"
              className="hud-btn-primary rounded-full px-8 py-3 text-sm"
            >
              Sign in — open floor
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }
  return <TradeDesk signedIn />;
}

function TradeDesk({ signedIn }: { signedIn: boolean }) {
  const [account, setAccount] = useState<Record<string, string> | null>(null);
  const [positions, setPositions] = useState<
    {
      symbol: string;
      qty: string;
      avg_entry_price?: string;
      current_price?: string;
      unrealized_pl?: string;
      market_value?: string;
    }[]
  >([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [quotes, setQuotes] = useState<Record<string, QuoteRow>>({});
  const [watch, setWatch] = useState<string[]>(DEFAULT_WATCH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [proposal, setProposal] = useState<TradeProposal | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [blotter, setBlotter] = useState<BlotterTab>("positions");
  const [quotesAt, setQuotesAt] = useState<string | null>(null);
  const [session, setSession] = useState<{
    us_rth_open: boolean;
    label: string;
  } | null>(null);

  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("1");
  const [limit, setLimit] = useState("");
  const [tif] = useState("Day");
  const [reason, setReason] = useState("Practice paper trade from the floor");

  const [chartTf, setChartTf] = useState<"1Day" | "1Month">("1Day");
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [barsSource, setBarsSource] = useState<string | null>(null);
  const [barsAt, setBarsAt] = useState<string | null>(null);
  const [barsLoading, setBarsLoading] = useState(false);
  const [barsError, setBarsError] = useState<string | null>(null);

  const flashCelebrate = useCallback((msg: string, ms = 1600) => {
    setCelebrate(msg);
    window.setTimeout(() => setCelebrate(null), ms);
  }, []);

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setError(null);
    try {
      const [p, o, s] = await Promise.all([
        portfolio(),
        listOrders(),
        marketSession().catch(() => null),
      ]);
      setAccount(p.account);
      setPositions(p.positions || []);
      setOrders(o.orders || []);
      if (s) setSession({ us_rth_open: s.us_rth_open, label: s.label });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load book");
    }
  }, [signedIn]);

  const refreshQuotes = useCallback(async () => {
    if (!signedIn || watch.length === 0) return;
    try {
      const res = await marketQuotes(watch);
      const map: Record<string, QuoteRow> = {};
      for (const q of res.quotes) {
        map[q.symbol] = {
          price: q.price,
          change: q.change,
          change_percent: q.change_percent,
          source: q.source,
          ok: q.ok,
        };
      }
      setQuotes(map);
      setQuotesAt(new Date().toISOString());
      setLimit((prev) => {
        if (prev.trim()) return prev;
        return map[symbol.toUpperCase()]?.price || prev;
      });
    } catch {
      /* ignore */
    }
  }, [signedIn, watch, symbol]);

  const refreshBars = useCallback(async () => {
    if (!signedIn || !symbol) return;
    setBarsLoading(true);
    setBarsError(null);
    try {
      const res = await marketBars(symbol, chartTf);
      setBars(res.bars || []);
      setBarsSource(res.source || null);
      setBarsAt(res.fetched_at || new Date().toISOString());
      if (res.error && !(res.bars || []).length) {
        setBarsError(res.error);
      }
    } catch (e) {
      setBars([]);
      setBarsError(e instanceof Error ? e.message : "Bars unavailable");
    } finally {
      setBarsLoading(false);
    }
  }, [signedIn, symbol, chartTf]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await validateConnection().catch(() => null);
        await refresh();
        await refreshQuotes();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, refreshQuotes]);

  useEffect(() => {
    void refreshBars();
  }, [refreshBars]);

  useEffect(() => {
    if (!signedIn) return;
    const t = setInterval(() => {
      void refreshQuotes();
      void marketSession()
        .then((s) => setSession({ us_rth_open: s.us_rth_open, label: s.label }))
        .catch(() => null);
    }, 30_000);
    return () => clearInterval(t);
  }, [signedIn, refreshQuotes]);

  const equity = account?.equity || account?.portfolio_value;
  const cash = account?.cash;
  const bp = account?.buying_power || cash;
  const dayPnl = account?.day_pnl;
  const dayPnlPct = account?.day_pnl_pct;
  const openPnl = useMemo(() => {
    return positions.reduce((sum, p) => sum + (Number(p.unrealized_pl) || 0), 0);
  }, [positions]);
  const selected = quotes[symbol.toUpperCase()];
  const selectedPx = selected?.price;

  const notionalPreview = useMemo(() => {
    const q = Number(qty);
    const px = Number(limit || selectedPx || 0);
    if (!q || !px || Number.isNaN(q) || Number.isNaN(px)) return null;
    return q * px;
  }, [qty, limit, selectedPx]);

  const maxShares = useMemo(() => {
    if (side !== "buy") return null;
    const c = Number(cash);
    const px = Number(limit || selectedPx || 0);
    if (!c || !px || px <= 0) return null;
    return Math.floor(c / px);
  }, [side, cash, limit, selectedPx]);

  function pickSymbol(sym: string) {
    setSymbol(sym);
    const px = quotes[sym]?.price;
    if (px) setLimit(px);
  }

  async function onReviewOrder(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const res = await createProposal({
        symbol: symbol.trim().toUpperCase(),
        side,
        qty,
        order_type: "limit",
        limit_price: limit.trim() || selectedPx || undefined,
        reason: reason.trim() || "Practice paper trade from the floor",
      });
      const p = res.proposal;
      if (p.policy_status === "policy_rejected") {
        setError(p.rejection_reason || "Policy rejected this ticket");
        setProposal(null);
      } else if (p.policy_status === "awaiting_confirm") {
        setProposal(p);
      } else {
        setError(`Unexpected status: ${p.policy_status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ticket failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (
      !confirm(
        "Reset paper book to $100,000 virtual cash?\n\nPositions clear. This is NOT real money."
      )
    ) {
      return;
    }
    setResetBusy(true);
    setError(null);
    try {
      const res = await paperReset(100_000);
      setFlash(res.message || "Paper book reset. Fresh $100k.");
      flashCelebrate("🎉 Fresh paper book");
      await refresh();
      await refreshQuotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetBusy(false);
    }
  }

  const asOf = quotesAt
    ? new Date(quotesAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  return (
    <main className="relative min-h-screen pb-4 sm:pb-12">
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center px-4 pt-20 animate-pulse sm:pt-24">
          <span className="rounded-2xl border border-good/40 bg-ink/90 px-4 py-3 text-center text-base font-semibold text-good shadow-xl backdrop-blur-md sm:text-2xl">
            {celebrate}
          </span>
        </div>
      )}

      {/* Phase 1 chrome bar */}
      <div className="sticky top-0 z-30 border-b border-good/30 bg-panel/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-good/50 bg-good/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-good">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
              Paper only
            </span>
            {session && (
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                  session.us_rth_open
                    ? "border-good/40 text-good"
                    : "border-line text-mist"
                }`}
              >
                {session.label}
              </span>
            )}
            <span className="hidden font-mono text-[10px] text-mist sm:inline">
              Quotes as of {asOf}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void refresh();
                void refreshQuotes();
                void refreshBars();
              }}
              className="min-h-9 rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:text-white"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowFaq((v) => !v)}
              className="min-h-9 rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:text-white"
            >
              {showFaq ? "Hide" : "Tips"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="hud-label mb-1">Trade floor</p>
            <h1 className="bridge-title text-xl font-bold tracking-tight sm:text-3xl">
              Practice before real money
            </h1>
            <p className="mt-1 text-sm text-mist">
              Pick a symbol → chart → ticket → confirm. Paper fills only.
            </p>
          </div>
          <button
            type="button"
            disabled={resetBusy}
            onClick={() => void onReset()}
            className="min-h-10 rounded-full border border-warn/40 bg-warn/10 px-4 py-2 text-xs font-semibold text-warn disabled:opacity-50"
          >
            {resetBusy ? "Resetting…" : "Reset $100k"}
          </button>
        </div>

        {showFaq && (
          <div className="mb-4 grid gap-2 rounded-xl border border-line/80 bg-panel/50 p-3 text-xs text-mist sm:grid-cols-3">
            <p>
              <strong className="text-slate-200">Paper</strong> — practice desk,
              not a live broker.
            </p>
            <p>
              <strong className="text-slate-200">Chart</strong> — honest bars only;
              no fake data.
            </p>
            <p>
              <strong className="text-slate-200">Confirm</strong> — policy + you
              approve every fill.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
            {error}
          </div>
        )}
        {flash && (
          <div className="mb-3 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">
            {flash}
          </div>
        )}

        {/* Account strip */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Net liq" value={loading ? "…" : fmtMoney(equity)} />
          <Stat label="Cash" value={loading ? "…" : fmtMoney(cash)} />
          <Stat label="Buying power" value={loading ? "…" : fmtMoney(bp)} />
          <Stat
            label="Day P&L"
            value={
              loading
                ? "…"
                : `${fmtMoney(dayPnl)}${
                    dayPnlPct != null
                      ? ` (${fmtPct(dayPnlPct) || dayPnlPct + "%"})`
                      : ""
                  }`
            }
            valueClass={pnlClass(dayPnl)}
          />
          <Stat
            label="Open P&L"
            value={loading ? "…" : fmtMoney(openPnl)}
            valueClass={pnlClass(openPnl)}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        {/*
          Desktop: watchlist | chart+ticket | blotter
          Mobile order: chart+ticket first, watchlist, blotter
        */}
        <div className="grid gap-4 lg:grid-cols-12">
          {/* Watchlist */}
          <section className="hud-panel order-2 lg:order-1 lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Watchlist</h2>
              <span className="font-mono text-[10px] text-mist">Last · Chg%</span>
            </div>
            <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-2 px-1 font-mono text-[10px] uppercase text-mist">
              <span>Sym</span>
              <span className="text-right">Last</span>
              <span className="w-16 text-right">Chg%</span>
            </div>
            <ul className="divide-y divide-line/60">
              {watch.map((sym) => {
                const q = quotes[sym];
                const active = symbol.toUpperCase() === sym;
                const pct = fmtPct(q?.change_percent);
                return (
                  <li key={sym}>
                    <button
                      type="button"
                      onClick={() => pickSymbol(sym)}
                      className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 px-1 py-2.5 text-left transition ${
                        active
                          ? "bg-accent/10 ring-1 ring-inset ring-accent/30"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <span className="font-mono text-sm font-bold text-white">
                        {sym}
                      </span>
                      <span className="font-mono text-sm text-slate-200">
                        {q?.ok ? fmtPx(q.price) : "…"}
                      </span>
                      <span
                        className="w-16 text-right font-mono text-xs font-semibold"
                        style={{ color: chgColor(q?.change_percent) }}
                      >
                        {pct ?? "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <form
              className="mt-3 flex gap-2 border-t border-line/60 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const s = String(fd.get("add") || "")
                  .trim()
                  .toUpperCase();
                if (s && !watch.includes(s)) {
                  setWatch((w) => [...w, s].slice(0, 16));
                }
                e.currentTarget.reset();
              }}
            >
              <input
                name="add"
                placeholder="Add"
                className="hud-input min-h-10 flex-1 rounded-lg px-3 py-2 font-mono text-sm uppercase"
                maxLength={8}
              />
              <button
                type="submit"
                className="min-h-10 rounded-lg border border-accent/40 px-3 text-xs font-semibold text-accent"
              >
                Add
              </button>
            </form>
          </section>

          {/* Center: chart above ticket */}
          <section className="order-1 flex flex-col gap-4 lg:order-2 lg:col-span-5">
            <SymbolChart
              symbol={symbol.toUpperCase()}
              bars={bars}
              timeframe={chartTf}
              onTimeframe={setChartTf}
              source={barsSource}
              fetchedAt={barsAt}
              loading={barsLoading}
              error={barsError}
              lastPrice={selectedPx}
              changePercent={selected?.change_percent}
            />

            <div className="hud-panel">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Order ticket</h2>
                <span className="rounded-full border border-good/30 bg-good/10 px-2 py-0.5 font-mono text-[10px] font-bold text-good">
                  PAPER
                </span>
              </div>
              <form onSubmit={onReviewOrder} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSide("buy")}
                    className={`min-h-12 rounded-xl py-3 text-sm font-bold uppercase ${
                      side === "buy"
                        ? "bg-good text-ink"
                        : "border border-line text-mist"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setSide("sell")}
                    className={`min-h-12 rounded-xl py-3 text-sm font-bold uppercase ${
                      side === "sell"
                        ? "bg-bad text-white"
                        : "border border-line text-mist"
                    }`}
                  >
                    Sell
                  </button>
                </div>
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                    Symbol
                  </span>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="hud-input w-full rounded-xl px-3 py-3 font-mono text-lg font-bold uppercase"
                    required
                    maxLength={8}
                  />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                      Qty
                    </span>
                    <input
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="hud-input w-full rounded-xl px-3 py-2.5 font-mono text-sm"
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                      Limit
                    </span>
                    <input
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder={selectedPx || "0.00"}
                      className="hud-input w-full rounded-xl px-3 py-2.5 font-mono text-sm"
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                      TIF
                    </span>
                    <div className="hud-input flex min-h-[42px] items-center rounded-xl px-3 font-mono text-sm text-slate-300">
                      {tif}
                    </div>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_QTY.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQty(q)}
                      className={`min-h-9 rounded-full px-2.5 py-1 font-mono text-[11px] ${
                        qty === q
                          ? "bg-accent/20 text-accent"
                          : "border border-line text-mist"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                  {maxShares != null && maxShares > 0 && (
                    <button
                      type="button"
                      onClick={() => setQty(String(maxShares))}
                      className="min-h-9 rounded-full border border-good/40 px-2.5 font-mono text-[11px] text-good"
                    >
                      Max {maxShares}
                    </button>
                  )}
                </div>
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                    Reason (required)
                  </span>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="hud-input w-full rounded-xl px-3 py-2 text-sm"
                    required
                  />
                </label>
                <p className="font-mono text-xs text-mist">
                  {notionalPreview != null ? (
                    <>Est. {fmtMoney(notionalPreview)} · Limit · TIF Day · paper</>
                  ) : (
                    "Enter qty + limit"
                  )}
                </p>
                <button
                  type="submit"
                  disabled={busy}
                  className="hud-btn-primary min-h-12 w-full rounded-xl py-3.5 text-base font-bold disabled:opacity-50"
                >
                  {busy ? "Checking policy…" : "Review paper order →"}
                </button>
              </form>
            </div>
          </section>

          {/* Blotter */}
          <section className="order-3 lg:order-3 lg:col-span-4">
            <div className="hud-panel">
              <div className="mb-3 flex gap-1 rounded-full border border-line p-0.5">
                {(
                  [
                    ["positions", "Positions"],
                    ["orders", "Orders"],
                    ["fills", "Fills"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBlotter(id)}
                    className={`min-h-9 flex-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      blotter === id
                        ? "bg-ink text-white"
                        : "text-mist hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {blotter === "positions" && (
                <>
                  {positions.length === 0 ? (
                    <p className="py-6 text-center text-sm text-mist">
                      No positions — pick a symbol, review, confirm.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="font-mono text-[10px] uppercase text-mist">
                          <tr>
                            <th className="pb-2">Sym</th>
                            <th className="pb-2">Qty</th>
                            <th className="pb-2">Avg</th>
                            <th className="pb-2">Mark</th>
                            <th className="pb-2">P&amp;L</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {positions.map((p) => (
                            <tr
                              key={p.symbol}
                              className="cursor-pointer border-t border-line/50 hover:bg-white/5"
                              onClick={() => {
                                pickSymbol(p.symbol);
                                setSide("sell");
                              }}
                            >
                              <td className="py-2 font-bold text-white">
                                {p.symbol}
                              </td>
                              <td className="py-2 text-slate-200">{p.qty}</td>
                              <td className="py-2 text-slate-200">
                                {fmtPx(p.avg_entry_price)}
                              </td>
                              <td className="py-2 text-slate-200">
                                {fmtPx(p.current_price)}
                              </td>
                              <td className={`py-2 ${pnlClass(p.unrealized_pl)}`}>
                                {fmtMoney(p.unrealized_pl)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {blotter === "orders" && (
                <p className="py-6 text-center text-sm text-mist">
                  Working orders arrive in Phase 3. v1 fills instantly after
                  confirm (paper).
                </p>
              )}

              {blotter === "fills" && (
                <>
                  {orders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-mist">
                      No paper fills yet.
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {[...orders]
                        .reverse()
                        .slice(0, 40)
                        .map((o) => (
                          <li
                            key={String(o.id || o.client_order_id)}
                            className="rounded-lg border border-line/50 bg-ink/40 px-3 py-2 font-mono text-[11px] text-slate-300"
                          >
                            <span className="font-semibold text-good">
                              {String(o.status || "filled")}
                            </span>
                            {o.broker_order_id != null && (
                              <span className="text-mist">
                                {" "}
                                · {String(o.broker_order_id).slice(0, 16)}
                              </span>
                            )}
                            {o.created_at != null && (
                              <div className="text-mist">
                                {String(o.created_at).slice(0, 19)}
                              </div>
                            )}
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {proposal && (
        <PreflightModal
          proposal={proposal}
          onClose={(updated) => {
            setProposal(null);
            if (
              updated?.policy_status === "submitted" ||
              updated?.policy_status === "filled"
            ) {
              const msg = `Paper fill: ${updated.side} ${updated.qty} ${updated.symbol} 🎯`;
              setFlash(`${msg} — check Positions.`);
              flashCelebrate(msg);
              setBlotter("fills");
            }
            void refresh();
            void refreshQuotes();
            void refreshBars();
          }}
        />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  valueClass,
  className = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line/70 bg-panel/60 px-3 py-3 ${className}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-mist">
        {label}
      </p>
      <p
        className={`mt-1 truncate font-mono text-sm font-semibold sm:text-base ${
          valueClass || "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
