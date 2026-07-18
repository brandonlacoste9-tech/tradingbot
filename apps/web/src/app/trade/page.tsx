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
import {
  createProposal,
  listOrders,
  marketQuotes,
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

type QuoteRow = {
  price: string | null;
  change?: string | null;
  change_percent?: string | null;
  source?: string | null;
  ok: boolean;
};

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
        <h1 className="bridge-title text-2xl font-bold">Sign in & practice free</h1>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          Real stock symbols · $100k virtual cash · policy + confirm.
          <br />
          Zero risk. Feels like the real desk.
        </p>
        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm text-mist">
          <li className="flex gap-2">
            <span className="text-good">✓</span> Try stocks before you have big capital
          </li>
          <li className="flex gap-2">
            <span className="text-good">✓</span> Learn the ticket without stress
          </li>
          <li className="flex gap-2">
            <span className="text-good">✓</span> Test ideas safely — reset anytime
          </li>
        </ul>
        <div className="mt-8 flex justify-center gap-3">
          <SignInButton mode="modal">
            <button
              type="button"
              className="hud-btn-primary rounded-full px-8 py-3 text-sm"
            >
              Sign in — start paper trading
            </button>
          </SignInButton>
        </div>
        <p className="mt-4 text-xs text-mist">
          Prefer AI research first?{" "}
          <a href="/" className="text-accent hover:underline">
            Open AI Desk
          </a>
        </p>
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
  /** Celebration overlay text — only set for intentional moments (fill vs reset). */
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const flashCelebrate = useCallback((msg: string, ms = 1600) => {
    setCelebrate(msg);
    window.setTimeout(() => setCelebrate(null), ms);
  }, []);

  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("1");
  const [limit, setLimit] = useState("");
  const [reason, setReason] = useState("Practice paper trade from the floor");

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setError(null);
    try {
      const [p, o] = await Promise.all([portfolio(), listOrders()]);
      setAccount(p.account);
      setPositions(p.positions || []);
      setOrders(o.orders || []);
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
      setLimit((prev) => {
        if (prev.trim()) return prev;
        return map[symbol.toUpperCase()]?.price || prev;
      });
    } catch {
      /* ignore */
    }
  }, [signedIn, watch, symbol]);

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
    if (!signedIn) return;
    const t = setInterval(() => void refreshQuotes(), 30_000);
    return () => clearInterval(t);
  }, [signedIn, refreshQuotes]);

  const equity = account?.equity || account?.portfolio_value;
  const cash = account?.cash;
  const bp = account?.buying_power || cash;
  const dayPnl = account?.day_pnl;
  const dayPnlPct = account?.day_pnl_pct;
  const selectedPx = quotes[symbol.toUpperCase()]?.price;

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
        "Reset paper book to $100,000 virtual cash?\n\nPositions and open paper orders clear. This is NOT real money."
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

  return (
    <main className="relative min-h-screen pb-12">
      {celebrate && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center pt-24 animate-pulse">
          <span className="rounded-2xl border border-good/40 bg-ink/90 px-5 py-3 text-center text-lg font-semibold text-good shadow-xl backdrop-blur-md sm:text-2xl">
            {celebrate}
          </span>
        </div>
      )}

      {/* Sticky paper bar */}
      <div className="sticky top-0 z-30 border-b border-good/30 bg-good/10 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-good/40 bg-good/15 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-wider text-good">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
              Paper only
            </span>
            <span className="text-xs text-mist sm:text-sm">
              Simulated fills · real symbols · not a live brokerage
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:text-white"
            >
              AI Desk
            </a>
            <button
              type="button"
              onClick={() => setShowFaq((v) => !v)}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-mist hover:text-white"
            >
              {showFaq ? "Hide tips" : "How paper works"}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="hud-label mb-1">Trade floor</p>
            <h1 className="bridge-title text-2xl font-bold tracking-tight sm:text-3xl">
              Practice like it&apos;s real
            </h1>
            <p className="mt-1 max-w-xl text-sm text-mist">
              Tap a symbol → set size → review → confirm. Policy keeps size honest.
              Grok research lives on the{" "}
              <a href="/" className="text-accent hover:underline">
                AI Desk
              </a>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void refresh();
                void refreshQuotes();
              }}
              className="rounded-full border border-line px-4 py-2 text-xs font-medium text-slate-300 hover:border-accent/40"
            >
              Refresh
            </button>
            <button
              type="button"
              disabled={resetBusy}
              onClick={() => void onReset()}
              className="rounded-full border border-warn/40 bg-warn/10 px-4 py-2 text-xs font-semibold text-warn hover:bg-warn/20 disabled:opacity-50"
            >
              {resetBusy ? "Resetting…" : "Reset $100k"}
            </button>
          </div>
        </div>

        {showFaq && (
          <div className="mb-4 grid gap-3 rounded-2xl border border-line/80 bg-panel/50 p-4 sm:grid-cols-3">
            <Tip
              title="Why paper?"
              body="Try stocks without funds, learn the ticket safely, or test a strategy before real capital."
            />
            <Tip
              title="How fills work"
              body="After you confirm, PaperSim fills against the limit/mark. Not a full exchange matching engine — practice, not perfection."
            />
            <Tip
              title="AI + you"
              body="Chat on AI Desk for research proposals. This floor is manual tickets. Both use policy + confirm."
            />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
            {error}
          </div>
        )}
        {flash && (
          <div className="mb-4 rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm text-good">
            {flash}
          </div>
        )}

        {/* Account strip — Webull-style */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Equity" value={loading ? "…" : fmtMoney(equity)} />
          <Stat label="Cash" value={loading ? "…" : fmtMoney(cash)} />
          <Stat label="Buying power" value={loading ? "…" : fmtMoney(bp)} />
          <Stat
            label="Day P&L"
            value={
              loading
                ? "…"
                : `${fmtMoney(dayPnl)}${dayPnlPct != null ? ` (${fmtPct(dayPnlPct) || dayPnlPct + "%"})` : ""}`
            }
            valueClass={pnlClass(dayPnl)}
          />
          <Stat
            label="Positions"
            value={loading ? "…" : String(positions.length)}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Watchlist */}
          <section className="hud-panel lg:col-span-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Watchlist</h2>
              <span className="font-mono text-xs uppercase text-mist">
                live-ish
              </span>
            </div>
            <ul className="divide-y divide-line/60">
              {watch.map((sym) => {
                const q = quotes[sym];
                const active = symbol.toUpperCase() === sym;
                const pct = fmtPct(q?.change_percent);
                const up = Number(q?.change) > 0 || Number(q?.change_percent) > 0;
                const down = Number(q?.change) < 0 || Number(q?.change_percent) < 0;
                return (
                  <li key={sym}>
                    <button
                      type="button"
                      onClick={() => pickSymbol(sym)}
                      className={`flex w-full items-center justify-between gap-2 px-2 py-2.5 text-left transition ${
                        active ? "bg-accent/10 ring-1 ring-inset ring-accent/30" : "hover:bg-white/5"
                      }`}
                    >
                      <span className="font-mono text-sm font-bold text-white">
                        {sym}
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-sm text-slate-200">
                          {q?.ok ? fmtPx(q.price) : "…"}
                        </span>
                        {pct && (
                          <span
                            className={`font-mono text-xs ${
                              up ? "text-good" : down ? "text-bad" : "text-mist"
                            }`}
                          >
                            {pct}
                          </span>
                        )}
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
                placeholder="Add TICKER"
                className="hud-input flex-1 rounded-lg px-3 py-2 font-mono text-sm uppercase"
                maxLength={8}
              />
              <button
                type="submit"
                className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent"
              >
                Add
              </button>
            </form>
          </section>

          {/* Order ticket */}
          <section className="hud-panel lg:col-span-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Order ticket</h2>
              <span className="rounded-full border border-good/30 bg-good/10 px-2 py-0.5 font-mono text-xs font-bold text-good">
                PAPER
              </span>
            </div>
            <form onSubmit={onReviewOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide("buy")}
                  className={`rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition ${
                    side === "buy"
                      ? "bg-good text-ink shadow-lg shadow-good/20"
                      : "border border-line text-mist hover:border-good/40"
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setSide("sell")}
                  className={`rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition ${
                    side === "sell"
                      ? "bg-bad text-white shadow-lg shadow-bad/20"
                      : "border border-line text-mist hover:border-bad/40"
                  }`}
                >
                  Sell
                </button>
              </div>
              <label className="block">
                <span className="mb-1 block font-mono text-xs uppercase text-mist">
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
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block font-mono text-xs uppercase text-mist">
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
                  <span className="mb-1 block font-mono text-xs uppercase text-mist">
                    Limit $
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
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_QTY.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQty(q)}
                    className={`rounded-full px-2.5 py-1 font-mono text-xs ${
                      qty === q
                        ? "bg-accent/20 text-accent"
                        : "border border-line text-mist hover:border-accent/40"
                    }`}
                  >
                    {q} sh
                  </button>
                ))}
                {maxShares != null && maxShares > 0 && (
                  <button
                    type="button"
                    onClick={() => setQty(String(maxShares))}
                    className="rounded-full border border-good/40 px-2.5 py-1 font-mono text-xs text-good hover:bg-good/10"
                  >
                    Max {maxShares}
                  </button>
                )}
              </div>
              <label className="block">
                <span className="mb-1 block font-mono text-xs uppercase text-mist">
                  Why this trade? (policy requires a reason)
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="hud-input w-full rounded-xl px-3 py-2 text-sm"
                  required
                  placeholder="e.g. Practice breakout entry on AAPL"
                />
              </label>
              <div className="rounded-xl border border-line/60 bg-ink/40 px-3 py-2 font-mono text-xs text-mist">
                {notionalPreview != null ? (
                  <>
                    Est.{" "}
                    <span className="text-slate-200">{fmtMoney(notionalPreview)}</span>
                    {selectedPx && (
                      <>
                        {" "}
                        · last{" "}
                        <span className="text-slate-200">{fmtPx(selectedPx)}</span>
                      </>
                    )}
                    {maxShares != null && side === "buy" && (
                      <>
                        {" "}
                        · max ~{maxShares} sh
                      </>
                    )}
                  </>
                ) : (
                  "Enter qty + limit to see estimated cost"
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="hud-btn-primary w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-50"
              >
                {busy ? "Checking policy…" : "Review order →"}
              </button>
              <p className="text-center text-xs leading-relaxed text-mist">
                Nothing fills until you confirm. PaperSim only.
              </p>
            </form>
          </section>

          {/* Positions + fills */}
          <section className="flex flex-col gap-4 lg:col-span-4">
            <div className="hud-panel flex-1">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Positions</h2>
                <span className="font-mono text-xs text-mist">tap to trade</span>
              </div>
              {positions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line/80 px-4 py-8 text-center">
                  <p className="text-2xl">📭</p>
                  <p className="mt-2 text-sm font-medium text-slate-300">
                    No positions yet
                  </p>
                  <p className="mt-1 text-xs text-mist">
                    Pick AAPL on the left, buy 1 share, confirm. You&apos;ve got this.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="font-mono text-xs uppercase text-mist">
                      <tr>
                        <th className="pb-2 pr-2">Sym</th>
                        <th className="pb-2 pr-2">Qty</th>
                        <th className="pb-2 pr-2">Avg</th>
                        <th className="pb-2 pr-2">Mark</th>
                        <th className="pb-2">P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-slate-200">
                      {positions.map((p) => (
                        <tr
                          key={p.symbol}
                          className="cursor-pointer border-t border-line/50 hover:bg-white/5"
                          onClick={() => {
                            pickSymbol(p.symbol);
                            setSide("sell");
                          }}
                        >
                          <td className="py-2.5 pr-2 font-bold text-white">
                            {p.symbol}
                          </td>
                          <td className="py-2.5 pr-2">{p.qty}</td>
                          <td className="py-2.5 pr-2">{fmtPx(p.avg_entry_price)}</td>
                          <td className="py-2.5 pr-2">{fmtPx(p.current_price)}</td>
                          <td className={`py-2.5 ${pnlClass(p.unrealized_pl)}`}>
                            {fmtMoney(p.unrealized_pl)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="hud-panel">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Recent fills</h2>
                <span className="font-mono text-xs text-mist">paper</span>
              </div>
              {orders.length === 0 ? (
                <p className="text-sm text-mist">
                  Confirmed tickets show up here as paper fills.
                </p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {[...orders]
                    .reverse()
                    .slice(0, 12)
                    .map((o) => (
                      <li
                        key={String(o.id || o.client_order_id)}
                        className="rounded-lg border border-line/50 bg-ink/40 px-3 py-2 font-mono text-xs text-slate-300"
                      >
                        <span className="font-semibold text-good">
                          {String(o.status || "order")}
                        </span>
                        {o.broker_order_id != null && (
                          <span className="text-mist">
                            {" "}
                            · {String(o.broker_order_id).slice(0, 18)}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
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
              setFlash(`${msg} — check positions below.`);
              flashCelebrate(msg);
            }
            void refresh();
            void refreshQuotes();
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
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-line/70 bg-panel/60 px-3 py-3">
      <p className="font-mono text-xs uppercase tracking-wider text-mist">
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

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-mist">{body}</p>
    </div>
  );
}
