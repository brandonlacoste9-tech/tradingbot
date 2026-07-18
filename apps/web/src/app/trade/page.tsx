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
  cancelOrder,
  createProposal,
  evaluateOrders,
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
const WATCH_STORAGE_KEY = "indietrades.watchlist.v1";
const BUDGET_STORAGE_KEY = "indietrades.paper_budget.v1";
const WATCH_MAX = 16;
const BUDGET_PRESETS = [10_000, 20_000, 50_000, 100_000] as const;
const BUDGET_MIN = 1_000;
const BUDGET_MAX = 10_000_000;

const GREEN = "#22c55e";
const RED = "#ef4444";

function formatBudgetShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000 && n % 1000 === 0) return `$${n / 1000}k`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

/** US-style equity ticker: AAPL, BRK.B, etc. */
function normalizeTicker(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s || s.length > 8) return null;
  if (!/^[A-Z][A-Z0-9.\-]*$/.test(s)) return null;
  return s;
}

function loadWatchlist(): string[] {
  if (typeof window === "undefined") return DEFAULT_WATCH;
  try {
    const raw = localStorage.getItem(WATCH_STORAGE_KEY);
    if (!raw) return DEFAULT_WATCH;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_WATCH;
    const clean = parsed
      .map((x) => normalizeTicker(String(x)))
      .filter((x): x is string => Boolean(x));
    return clean.length ? [...new Set(clean)].slice(0, WATCH_MAX) : DEFAULT_WATCH;
  } catch {
    return DEFAULT_WATCH;
  }
}

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
  const [watchHydrated, setWatchHydrated] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgetPick, setBudgetPick] = useState<number | "custom">(100_000);
  const [budgetCustom, setBudgetCustom] = useState("20000");
  const [proposal, setProposal] = useState<TradeProposal | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [blotter, setBlotter] = useState<BlotterTab>("positions");
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
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

  // Hydrate watchlist + last paper budget preference
  useEffect(() => {
    setWatch(loadWatchlist());
    setWatchHydrated(true);
    try {
      const raw = localStorage.getItem(BUDGET_STORAGE_KEY);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= BUDGET_MIN && n <= BUDGET_MAX) {
          if ((BUDGET_PRESETS as readonly number[]).includes(n)) {
            setBudgetPick(n);
          } else {
            setBudgetPick("custom");
            setBudgetCustom(String(Math.round(n)));
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!watchHydrated) return;
    try {
      localStorage.setItem(WATCH_STORAGE_KEY, JSON.stringify(watch));
    } catch {
      /* private mode / quota */
    }
  }, [watch, watchHydrated]);

  /** Put ticker on watch (front). select=true opens chart + ticket. */
  const ensureOnWatch = useCallback(
    (raw: string, opts?: { select?: boolean; announce?: boolean }) => {
      const s = normalizeTicker(raw);
      if (!s) return null;
      setWatch((w) => {
        if (w.includes(s) && w[0] === s) return w;
        return [s, ...w.filter((x) => x !== s)].slice(0, WATCH_MAX);
      });
      const shouldSelect = opts?.select !== false;
      if (shouldSelect) {
        setSymbol(s);
        setLimit(quotes[s]?.price || "");
      }
      if (opts?.announce) {
        setFlash(`Watching ${s} — chart + ticket ready (paper).`);
        window.setTimeout(() => setFlash(null), 2800);
      }
      return s;
    },
    [quotes]
  );

  const removeFromWatch = useCallback(
    (sym: string) => {
      const s = sym.toUpperCase();
      setWatch((w) => {
        const next = w.filter((x) => x !== s);
        const final = next.length ? next : [...DEFAULT_WATCH];
        if (symbol.toUpperCase() === s) {
          setSymbol(final[0]);
          setLimit("");
        }
        return final;
      });
    },
    [symbol]
  );

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
    if (!signedIn) return;
    const active = normalizeTicker(symbol);
    // Always include active ticket symbol even if not yet on the list
    const syms = [
      ...new Set(
        [...watch, active].filter((x): x is string => Boolean(x))
      ),
    ].slice(0, 12);
    if (syms.length === 0) return;
    try {
      const res = await marketQuotes(syms);
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
        const key = active || symbol.toUpperCase();
        return map[key]?.price || prev;
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

  const workingOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = String(o.status || "").toLowerCase();
        return s === "working" || s === "new" || s === "open" || s === "accepted";
      }),
    [orders]
  );
  const fillOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = String(o.status || "").toLowerCase();
        return s === "filled" || s === "submitted";
      }),
    [orders]
  );
  const recentTerminal = useMemo(
    () =>
      orders.filter((o) => {
        const s = String(o.status || "").toLowerCase();
        return s === "cancelled" || s === "canceled" || s === "expired";
      }),
    [orders]
  );

  async function onCancelWorking(o: Record<string, unknown>) {
    const id = String(o.broker_order_id || o.id || "");
    if (!id) return;
    setCancelBusy(id);
    setError(null);
    try {
      await cancelOrder(id);
      setFlash("Working paper order cancelled · not a live broker");
      setBlotter("orders");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelBusy(null);
    }
  }

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
    ensureOnWatch(sym, { select: true });
  }

  function commitTicketSymbol() {
    const s = normalizeTicker(symbol);
    if (!s) return;
    ensureOnWatch(s, { select: true });
  }

  async function onReviewOrder(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      const sym = normalizeTicker(symbol);
      if (!sym) {
        setError("Enter a valid ticker (e.g. COST, SOFI)");
        setBusy(false);
        return;
      }
      // Keep anything you trade on the watchlist for next time
      ensureOnWatch(sym, { select: true });
      const res = await createProposal({
        symbol: sym,
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

  function resolveBudgetAmount(): number | null {
    if (budgetPick === "custom") {
      const n = Number(String(budgetCustom).replace(/[$,\s]/g, ""));
      if (!Number.isFinite(n)) return null;
      return Math.round(n);
    }
    return budgetPick;
  }

  const budgetChip = useMemo(() => {
    const fromAccount = account?.starting_cash
      ? Number(account.starting_cash)
      : NaN;
    if (Number.isFinite(fromAccount) && fromAccount > 0) {
      return formatBudgetShort(fromAccount);
    }
    const pick = resolveBudgetAmount();
    return pick != null ? formatBudgetShort(pick) : "$100k";
    // resolveBudgetAmount is sync pure from state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.starting_cash, budgetPick, budgetCustom]);

  // Escape closes paper budget modal
  useEffect(() => {
    if (!showBudget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !resetBusy) setShowBudget(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showBudget, resetBusy]);

  async function onConfirmBudget() {
    const cash = resolveBudgetAmount();
    if (cash == null || cash < BUDGET_MIN || cash > BUDGET_MAX) {
      setError(
        `Paper budget must be between $${BUDGET_MIN.toLocaleString()} and $${BUDGET_MAX.toLocaleString()}`
      );
      return;
    }
    setResetBusy(true);
    setError(null);
    try {
      const res = await paperReset(cash);
      try {
        localStorage.setItem(BUDGET_STORAGE_KEY, String(cash));
      } catch {
        /* ignore */
      }
      const label = cash.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      });
      setFlash(
        res.message ||
          `Paper book reset to ${label} virtual cash. Not a deposit.`
      );
      flashCelebrate(`🎉 Paper budget ${label}`);
      setShowBudget(false);
      setBlotter("positions");
      await refresh();
      await refreshQuotes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Budget reset failed");
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
            <span className="font-mono text-[10px] text-mist">
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
                void evaluateOrders().catch(() => null);
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
            onClick={() => setShowBudget(true)}
            className="min-h-11 shrink-0 rounded-full border border-warn/40 bg-warn/10 px-4 py-2 text-xs font-semibold text-warn disabled:opacity-50"
          >
            Paper budget · {budgetChip}
          </button>
        </div>

        {showFaq && (
          <div className="mb-4 space-y-3 rounded-xl border border-line/80 bg-panel/50 p-3 text-xs text-mist">
            <div className="grid gap-2 sm:grid-cols-3">
              <p>
                <strong className="text-slate-200">Paper</strong> — practice desk,
                not a live broker.
              </p>
              <p>
                <strong className="text-slate-200">Chart</strong> — honest bars only;
                no fake data · source + age on chart.
              </p>
              <p>
                <strong className="text-slate-200">Confirm</strong> — policy + you
                approve every order.
              </p>
            </div>
            <div className="border-t border-line/60 pt-3">
              <p className="mb-1 font-semibold text-slate-200">Paper budget</p>
              <p className="mb-3">
                Use <strong className="text-slate-300">Paper budget</strong> to
                practice with $10k / $20k / $50k / $100k (or custom). Resets the
                virtual book — not a real deposit.
              </p>
              <p className="mb-1 font-semibold text-slate-200">How fills work (paper)</p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <strong className="text-slate-300">Aggressive</strong> — buy limit ≥
                  last or sell ≤ last: instant PaperSim fill at last/mark after confirm.
                </li>
                <li>
                  <strong className="text-slate-300">Passive</strong> — buy below last
                  or sell above: sits in <em>Orders</em> as working until mark crosses,
                  Day TIF ends, or you cancel.
                </li>
                <li>
                  Not exchange matching. No Level 2. No invented prints.
                </li>
              </ul>
            </div>
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
        <div className="mb-1 grid grid-cols-2 gap-2 sm:grid-cols-5">
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
        <p className="mb-4 font-mono text-[10px] leading-relaxed text-mist">
          Simulated paper account — not a broker · market data may be delayed ·
          starting budget {budgetChip} (reset anytime)
        </p>

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
                  <li key={sym} className="group flex items-stretch gap-0.5">
                    <button
                      type="button"
                      onClick={() => pickSymbol(sym)}
                      className={`grid min-w-0 flex-1 grid-cols-[1fr_auto_auto] items-center gap-2 px-1 py-2.5 text-left transition ${
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
                        className="w-14 text-right font-mono text-xs font-semibold sm:w-16"
                        style={{ color: chgColor(q?.change_percent) }}
                      >
                        {pct ?? "—"}
                      </span>
                    </button>
                    <button
                      type="button"
                      title={`Remove ${sym}`}
                      aria-label={`Remove ${sym} from watchlist`}
                      onClick={() => removeFromWatch(sym)}
                      className="min-h-10 min-w-9 shrink-0 rounded-lg px-1 text-mist opacity-70 transition hover:bg-bad/15 hover:text-bad group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
            <form
              className="mt-3 space-y-2 border-t border-line/60 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                const s = ensureOnWatch(addDraft, {
                  select: true,
                  announce: true,
                });
                if (!s) {
                  setError("Enter a ticker like COST, SOFI, or BRK.B");
                  return;
                }
                setError(null);
                setAddDraft("");
              }}
            >
              <p className="font-mono text-[10px] text-mist">
                Any US ticker — not just the list
              </p>
              <div className="flex gap-2">
                <input
                  value={addDraft}
                  onChange={(e) => setAddDraft(e.target.value.toUpperCase())}
                  placeholder="e.g. COST"
                  className="hud-input min-h-10 flex-1 rounded-lg px-3 py-2 font-mono text-sm uppercase"
                  maxLength={8}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Add ticker to watchlist"
                />
                <button
                  type="submit"
                  className="min-h-10 shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 text-xs font-semibold text-accent"
                >
                  Open
                </button>
              </div>
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
                    Symbol{" "}
                    <span className="normal-case text-mist/80">
                      (any ticker — adds to watch)
                    </span>
                  </span>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onBlur={() => commitTicketSymbol()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitTicketSymbol();
                      }
                    }}
                    className="hud-input w-full rounded-xl px-3 py-3 font-mono text-lg font-bold uppercase"
                    required
                    maxLength={8}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="AAPL"
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
                <p className="text-[11px] leading-snug text-mist">
                  Aggressive limits fill at last/mark after confirm. Passiveive
                  limits rest in Orders (paper — not exchange matching).
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
                    ["positions", "Positions", positions.length],
                    ["orders", "Orders", workingOrders.length],
                    ["fills", "Fills", fillOrders.length],
                  ] as const
                ).map(([id, label, count]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBlotter(id)}
                    className={`min-h-10 flex-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      blotter === id
                        ? "bg-ink text-white"
                        : "text-mist hover:text-white"
                    }`}
                  >
                    {label}
                    {count > 0 ? (
                      <span className="ml-1 font-mono text-[10px] opacity-70">
                        {count}
                      </span>
                    ) : null}
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
                <>
                  {workingOrders.length === 0 && recentTerminal.length === 0 ? (
                    <p className="py-6 text-center text-sm text-mist">
                      No working paper orders. Passiveive limits (buy below last /
                      sell above) rest here after confirm.
                    </p>
                  ) : (
                    <ul className="max-h-80 space-y-2 overflow-y-auto">
                      {workingOrders.map((o) => {
                        const id = String(o.broker_order_id || o.id || "");
                        return (
                          <li
                            key={id}
                            className="rounded-lg border border-accent/30 bg-ink/40 px-3 py-2.5 font-mono text-[11px]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="rounded border border-accent/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
                                  working
                                </span>
                                <span className="ml-2 font-bold text-white">
                                  {String(o.side || "").toUpperCase()}{" "}
                                  {String(o.qty || "")}{" "}
                                  {String(o.symbol || "—")}
                                </span>
                                <div className="mt-1 text-mist">
                                  Limit {fmtPx(String(o.limit_price ?? ""))} · Day
                                  TIF · PAPER
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={cancelBusy === id}
                                onClick={() => void onCancelWorking(o)}
                                className="min-h-9 shrink-0 rounded-lg border border-bad/40 px-2 py-1 text-[10px] font-semibold text-bad hover:bg-bad/10 disabled:opacity-50"
                              >
                                {cancelBusy === id ? "…" : "Cancel"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                      {recentTerminal.slice(0, 8).map((o) => (
                        <li
                          key={String(o.broker_order_id || o.id)}
                          className="rounded-lg border border-line/40 bg-ink/30 px-3 py-2 font-mono text-[11px] text-mist"
                        >
                          <span className="uppercase">
                            {String(o.status)}
                          </span>
                          {" · "}
                          {String(o.side || "")} {String(o.qty || "")}{" "}
                          {String(o.symbol || "")}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 border-t border-line/50 pt-2 text-[10px] text-mist">
                    Paper working book — fills when last/mark crosses your limit.
                    Not exchange matching.
                  </p>
                </>
              )}

              {blotter === "fills" && (
                <>
                  {fillOrders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-mist">
                      No PaperSim fills yet.
                    </p>
                  ) : (
                    <ul className="max-h-72 space-y-2 overflow-y-auto">
                      {fillOrders.slice(0, 40).map((o) => (
                        <li
                          key={String(o.id || o.client_order_id)}
                          className="rounded-lg border border-line/50 bg-ink/40 px-3 py-2 font-mono text-[11px] text-slate-300"
                        >
                          <span className="font-semibold text-good">
                            filled
                          </span>
                          <span className="text-white">
                            {" "}
                            · {String(o.side || "").toUpperCase()}{" "}
                            {String(o.qty || "")} {String(o.symbol || "")}
                          </span>
                          {o.filled_avg_price != null && (
                            <span className="text-mist">
                              {" "}
                              @ {fmtPx(String(o.filled_avg_price))}
                            </span>
                          )}
                          {o.fill_kind != null && (
                            <span className="text-mist">
                              {" "}
                              · {String(o.fill_kind)}
                            </span>
                          )}
                          <div className="text-[10px] text-mist">
                            PaperSim · not a live broker
                            {o.created_at != null
                              ? ` · ${String(o.created_at).slice(0, 19)}`
                              : ""}
                          </div>
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

      {showBudget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !resetBusy) setShowBudget(false);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-t-2xl border border-line bg-panel shadow-2xl sm:rounded-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="border-b border-line px-5 py-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-good">
                Simulated · not a deposit
              </p>
              <h2
                id="budget-title"
                className="mt-1 text-lg font-bold text-white"
              >
                Paper budget
              </h2>
              <p className="mt-1 text-sm text-mist">
                Choose virtual starting cash. Resets positions and working
                orders. Not real money. Not a broker transfer.
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <p className="font-mono text-3xl font-bold tabular-nums text-white">
                {(() => {
                  const a = resolveBudgetAmount();
                  if (a == null || !Number.isFinite(a)) return "—";
                  return a.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  });
                })()}
              </p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBudgetPick(n)}
                    className={`min-h-10 rounded-full px-3.5 py-2 font-mono text-xs font-semibold transition ${
                      budgetPick === n
                        ? "bg-good text-ink"
                        : "border border-line text-mist hover:text-white"
                    }`}
                  >
                    ${(n / 1000).toFixed(0)}k
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBudgetPick("custom")}
                  className={`min-h-10 rounded-full px-3.5 py-2 font-mono text-xs font-semibold transition ${
                    budgetPick === "custom"
                      ? "bg-good text-ink"
                      : "border border-line text-mist hover:text-white"
                  }`}
                >
                  Custom
                </button>
              </div>
              {budgetPick === "custom" && (
                <label className="block">
                  <span className="mb-1 block font-mono text-[10px] uppercase text-mist">
                    Custom amount (USD)
                  </span>
                  <input
                    value={budgetCustom}
                    onChange={(e) => setBudgetCustom(e.target.value)}
                    inputMode="numeric"
                    placeholder="20000"
                    className="hud-input w-full rounded-xl px-3 py-3 font-mono text-lg"
                    autoFocus
                  />
                  <span className="mt-1 block font-mono text-[10px] text-mist">
                    Min ${BUDGET_MIN.toLocaleString()} · max $
                    {BUDGET_MAX.toLocaleString()}
                  </span>
                </label>
              )}
              <p className="rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-xs leading-relaxed text-mist">
                This wipes your paper book (positions, working orders) and
                restarts day P&amp;L vs the new starting cash.
              </p>
            </div>
            <div className="flex gap-2 border-t border-line px-5 py-4">
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => setShowBudget(false)}
                className="min-h-11 flex-1 rounded-xl border border-line px-4 text-sm font-medium text-mist hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => void onConfirmBudget()}
                className="min-h-11 flex-[1.4] rounded-xl bg-good px-4 text-sm font-bold text-ink disabled:opacity-50"
              >
                {resetBusy
                  ? "Resetting…"
                  : `Reset paper book${
                      resolveBudgetAmount() != null
                        ? ` to $${Math.round(resolveBudgetAmount()!).toLocaleString()}`
                        : ""
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

      {proposal && (
        <PreflightModal
          proposal={proposal}
          onClose={(updated) => {
            setProposal(null);
            if (updated?.policy_status === "filled") {
              const msg = `PaperSim fill: ${updated.side} ${updated.qty} ${updated.symbol}`;
              setFlash(
                `${msg} · not a live broker confirmation — check Fills / Positions.`
              );
              flashCelebrate(`${msg} 🎯`);
              setBlotter("fills");
            } else if (updated?.policy_status === "working") {
              const msg = `Working paper limit: ${updated.side} ${updated.qty} ${updated.symbol}`;
              setFlash(
                `${msg} · Day TIF · see Orders (not exchange matching).`
              );
              flashCelebrate("Working · PAPER");
              setBlotter("orders");
            } else if (updated?.policy_status === "submitted") {
              setFlash(
                `Paper order submitted: ${updated.side} ${updated.qty} ${updated.symbol}`
              );
              setBlotter("orders");
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
