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
  portfolio,
  validateConnection,
} from "@/lib/api";
import type { TradeProposal } from "@/lib/types";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const DEFAULT_WATCH = ["SPY", "QQQ", "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META"];

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
        Loading…
      </main>
    );
  }
  if (!isSignedIn) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="hud-label mb-2">Paper trading floor</p>
        <h1 className="bridge-title text-2xl font-bold">Sign in to trade</h1>
        <p className="mt-3 text-sm text-mist">
          Real stock symbols · paper money · policy + confirm. No live brokerage.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <SignInButton mode="modal">
            <button type="button" className="hud-btn-primary rounded-full px-6 py-2.5 text-sm">
              Sign in
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
  const [quotes, setQuotes] = useState<
    Record<string, { price: string | null; source?: string | null; ok: boolean }>
  >({});
  const [watch, setWatch] = useState<string[]>(DEFAULT_WATCH);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<TradeProposal | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Ticket
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("1");
  const [limit, setLimit] = useState("");
  const [reason, setReason] = useState("Manual paper ticket — desk UI");

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
      const map: typeof quotes = {};
      for (const q of res.quotes) {
        map[q.symbol] = { price: q.price, source: q.source, ok: q.ok };
      }
      setQuotes(map);
      // Prefill limit from selected symbol if empty
      setLimit((prev) => {
        if (prev.trim()) return prev;
        const px = map[symbol.toUpperCase()]?.price;
        return px || prev;
      });
    } catch {
      /* ignore quote blips */
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

  // Poll quotes
  useEffect(() => {
    if (!signedIn) return;
    const t = setInterval(() => void refreshQuotes(), 30_000);
    return () => clearInterval(t);
  }, [signedIn, refreshQuotes]);

  const equity = account?.equity || account?.portfolio_value;
  const cash = account?.cash;
  const bp = account?.buying_power || cash;

  const selectedPx = quotes[symbol.toUpperCase()]?.price;

  const notionalPreview = useMemo(() => {
    const q = Number(qty);
    const px = Number(limit || selectedPx || 0);
    if (!q || !px || Number.isNaN(q) || Number.isNaN(px)) return null;
    return q * px;
  }, [qty, limit, selectedPx]);

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
        reason: reason.trim() || "Manual paper ticket — desk UI",
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

  return (
    <main className="relative min-h-screen pb-12">
      {/* Banner */}
      <div className="border-b border-good/25 bg-good/5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-good">
            PAPER TRADING FLOOR · simulated fills · not a live brokerage
          </p>
          <a href="/" className="text-xs text-mist underline-offset-2 hover:text-white hover:underline">
            ← AI research desk
          </a>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="hud-label mb-1">Trade</p>
            <h1 className="bridge-title text-2xl font-bold tracking-tight sm:text-3xl">
              Paper trading floor
            </h1>
            <p className="mt-1 max-w-xl text-sm text-mist">
              Real symbols and live-ish quotes. Ticket → policy → confirm →{" "}
              <strong className="text-slate-300">PaperSim fill</strong>. Same control
              plane as AI chat — no live money.
            </p>
          </div>
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
        </div>

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

        {/* Account strip */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Equity" value={loading ? "…" : fmtMoney(equity)} />
          <Stat label="Cash" value={loading ? "…" : fmtMoney(cash)} />
          <Stat label="Buying power" value={loading ? "…" : fmtMoney(bp)} />
          <Stat label="Positions" value={loading ? "…" : String(positions.length)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Watchlist */}
          <section className="hud-panel lg:col-span-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Watchlist</h2>
              <span className="font-mono text-[10px] uppercase text-mist">quotes</span>
            </div>
            <ul className="divide-y divide-line/60">
              {watch.map((sym) => {
                const q = quotes[sym];
                const active = symbol.toUpperCase() === sym;
                return (
                  <li key={sym}>
                    <button
                      type="button"
                      onClick={() => pickSymbol(sym)}
                      className={`flex w-full items-center justify-between px-2 py-2.5 text-left transition ${
                        active ? "bg-accent/10" : "hover:bg-white/5"
                      }`}
                    >
                      <span className="font-mono text-sm font-semibold text-white">
                        {sym}
                      </span>
                      <span className="font-mono text-sm text-slate-300">
                        {q?.ok ? fmtPx(q.price) : "…"}
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
                placeholder="Add symbol"
                className="hud-input flex-1 rounded-lg px-3 py-2 font-mono text-sm"
                maxLength={8}
              />
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-2 text-xs text-slate-300"
              >
                Add
              </button>
            </form>
          </section>

          {/* Order ticket */}
          <section className="hud-panel lg:col-span-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Order ticket</h2>
              <span className="rounded-full border border-good/30 bg-good/10 px-2 py-0.5 font-mono text-[10px] text-good">
                PAPER
              </span>
            </div>
            <form onSubmit={onReviewOrder} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSide("buy")}
                  className={`rounded-lg py-2.5 text-sm font-bold uppercase ${
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
                  className={`rounded-lg py-2.5 text-sm font-bold uppercase ${
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
                  className="hud-input w-full rounded-lg px-3 py-2.5 font-mono text-sm uppercase"
                  required
                  maxLength={8}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                    Qty
                  </span>
                  <input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="hud-input w-full rounded-lg px-3 py-2.5 font-mono text-sm"
                    inputMode="decimal"
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                    Limit $
                  </span>
                  <input
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder={selectedPx || "0.00"}
                    className="hud-input w-full rounded-lg px-3 py-2.5 font-mono text-sm"
                    inputMode="decimal"
                    required
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                  Thesis / reason (required by policy)
                </span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="hud-input w-full rounded-lg px-3 py-2 text-sm"
                  required
                />
              </label>
              {notionalPreview != null && (
                <p className="font-mono text-xs text-mist">
                  Est. notional{" "}
                  <span className="text-slate-200">{fmtMoney(notionalPreview)}</span>
                  {selectedPx && (
                    <>
                      {" "}
                      · last{" "}
                      <span className="text-slate-200">{fmtPx(selectedPx)}</span>
                    </>
                  )}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="hud-btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Checking policy…" : "Review order (policy + confirm)"}
              </button>
              <p className="text-[11px] leading-relaxed text-mist">
                Does not fill until you confirm in the preflight modal. PaperSim only —
                no live brokerage.
              </p>
            </form>
          </section>

          {/* Positions + orders */}
          <section className="flex flex-col gap-4 lg:col-span-4">
            <div className="hud-panel flex-1">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Positions</h2>
                <span className="font-mono text-[10px] text-mist">open</span>
              </div>
              {positions.length === 0 ? (
                <p className="text-sm text-mist">No open positions. Buy from the ticket.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="font-mono text-[10px] uppercase text-mist">
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
                          onClick={() => pickSymbol(p.symbol)}
                        >
                          <td className="py-2 pr-2 font-semibold text-white">
                            {p.symbol}
                          </td>
                          <td className="py-2 pr-2">{p.qty}</td>
                          <td className="py-2 pr-2">{fmtPx(p.avg_entry_price)}</td>
                          <td className="py-2 pr-2">{fmtPx(p.current_price)}</td>
                          <td
                            className={`py-2 ${
                              Number(p.unrealized_pl) >= 0 ? "text-good" : "text-bad"
                            }`}
                          >
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
                <span className="font-mono text-[10px] text-mist">paper</span>
              </div>
              {orders.length === 0 ? (
                <p className="text-sm text-mist">No fills yet.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto">
                  {[...orders].reverse().slice(0, 12).map((o) => (
                    <li
                      key={String(o.id || o.client_order_id)}
                      className="rounded-lg border border-line/50 bg-ink/40 px-3 py-2 font-mono text-[11px] text-slate-300"
                    >
                      <span className="text-white">{String(o.status || "order")}</span>
                      {o.broker_order_id != null && (
                        <span className="text-mist"> · {String(o.broker_order_id)}</span>
                      )}
                      {o.client_order_id != null && (
                        <div className="truncate text-mist">
                          {String(o.client_order_id)}
                        </div>
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
            if (updated?.policy_status === "submitted" || updated?.policy_status === "filled") {
              setFlash(
                `Paper fill submitted for ${updated.symbol}. Check positions.`
              );
            }
            void refresh();
            void refreshQuotes();
          }}
        />
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/70 bg-panel/60 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-white sm:text-base">
        {value}
      </p>
    </div>
  );
}
