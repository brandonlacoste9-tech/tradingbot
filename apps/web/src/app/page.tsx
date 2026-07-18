"use client";

import { useCallback, useEffect, useState } from "react";
import BillingPanel from "@/components/BillingPanel";
import Chat from "@/components/Chat";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import HowItWorks from "@/components/HowItWorks";
import StatusStrip from "@/components/StatusStrip";
import UserBar from "@/components/UserBar";
import {
  billingStatus,
  health,
  listJournal,
  portfolio,
  validateConnection,
} from "@/lib/api";
import type {
  ConnectionInfo,
  HealthInfo,
  JournalEntry,
  PositionRow,
} from "@/lib/types";

export default function HomePage() {
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [conn, setConn] = useState<ConnectionInfo | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [account, setAccount] = useState<Record<string, string> | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [portfolioSource, setPortfolioSource] = useState<string>("—");
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<{
    used?: number;
    limit?: number;
    remaining?: number;
    plan?: string;
  } | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [chatBlocked, setChatBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const h = await health();
      setHealthInfo(h);
      setApiOk(h.ok);
    } catch {
      setApiOk(false);
      setHealthInfo(null);
    }
    try {
      const j = await listJournal();
      setJournal(j.entries);
    } catch {
      /* ignore */
    }
    try {
      const p = await portfolio();
      setAccount(p.account);
      setPositions((p.positions || []) as PositionRow[]);
      setPortfolioSource(p.source || "—");
    } catch {
      /* ignore */
    }
    try {
      const b = await billingStatus();
      setPlan(b.plan);
      setUsage(b.usage || null);
      setChatBlocked(Boolean(b.service?.chat_blocked));
      setBlockReason(b.service?.block_reason || null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refresh();
      try {
        const c = await validateConnection();
        setConn(c);
        await refresh();
      } catch {
        /* user can sync */
      }
      setLoading(false);
    })();
  }, [refresh]);

  async function onValidate() {
    setConnError(null);
    try {
      const c = await validateConnection();
      setConn(c);
      await refresh();
    } catch (e) {
      setConnError(e instanceof Error ? e.message : "Validation failed");
    }
  }

  const equity = conn?.equity || account?.equity || account?.portfolio_value;
  const cash = conn?.cash || account?.cash;
  const bp = conn?.buying_power || account?.buying_power;

  return (
    <main className="relative min-h-screen pb-10">
      <DisclaimerBanner />

      <div className="border-b border-line/70 bg-panel/40 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="hud-label mb-1">Paper desk</p>
              <h1 className="bridge-title text-2xl font-bold tracking-tight sm:text-3xl">
                IndieTrades
              </h1>
              <p className="mt-1 max-w-md text-sm text-mist">
                indietrades.com · research → policy → confirm · paper fills only
              </p>
              <div className="mt-3">
                <UserBar />
              </div>
            </div>
            <StatusStrip
              health={healthInfo}
              apiOk={apiOk}
              usage={usage}
              plan={plan}
              chatBlocked={chatBlocked}
              blockReason={blockReason}
              onRefresh={() => void onValidate()}
              onOpenPlans={() => {
                document
                  .getElementById("plans")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
        <HowItWorks />

        <div className="grid gap-4 lg:grid-cols-12">
          <section className="min-h-[560px] lg:col-span-7 lg:h-[calc(100vh-12rem)]">
            <Chat
              onProposalSubmitted={() => void refresh()}
              onActivity={() => void refresh()}
            />
          </section>

          <aside className="flex flex-col gap-4 lg:col-span-5 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1">
            {/* Plans first — was buried under journal; hard to find */}
            <div id="plans" className="scroll-mt-20">
              <BillingPanel onPlanChange={() => void refresh()} />
            </div>

            <Panel
              title="Portfolio telemetry"
              label="book"
              badge={loading ? "…" : "SIM"}
            >
              {connError && (
                <p className="mb-2 font-mono text-sm text-bad">{connError}</p>
              )}
              {loading && !equity ? (
                <SkeletonStats />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Equity" value={fmtMoney(equity)} />
                  <Stat label="Cash" value={fmtMoney(cash)} />
                  <Stat label="Buying power" value={fmtMoney(bp)} />
                </div>
              )}
              <dl className="mt-3 space-y-1.5 border-t border-line/70 pt-3 font-mono text-xs">
                <KV k="Account" v={conn?.account_id || account?.id || "—"} />
                <KV k="Backend" v={conn?.backend || portfolioSource} />
                <KV k="Paper" v={conn?.is_paper === false ? "no" : "yes"} />
                <KV
                  k="Last check"
                  v={
                    conn?.last_validated
                      ? new Date(conn.last_validated).toLocaleString()
                      : "—"
                  }
                />
              </dl>
            </Panel>

            <Panel
              title="Positions"
              label="holdings"
              badge={
                positions.length > 0 ? String(positions.length) : undefined
              }
            >
              {positions.length === 0 ? (
                <Empty
                  title="No open positions"
                  body="Research a symbol, propose a limit, then confirm preflight."
                />
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {positions.map((p) => (
                    <div
                      key={p.symbol}
                      className="flex items-center justify-between rounded-xl border border-line/80 bg-ink/50 px-3 py-2.5 text-sm transition hover:border-accent/25"
                    >
                      <div>
                        <div className="font-semibold tracking-wide text-white">
                          {p.symbol}
                        </div>
                        <div className="font-mono text-[11px] text-mist">
                          qty {p.qty}
                          {p.avg_entry_price
                            ? ` · avg ${p.avg_entry_price}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs text-slate-300">
                        {p.market_value ? `mv ${p.market_value}` : ""}
                        {p.unrealized_pl != null && (
                          <div
                            className={
                              String(p.unrealized_pl).startsWith("-")
                                ? "text-bad"
                                : "text-good"
                            }
                          >
                            {p.unrealized_pl}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Journal" label="audit">
              {journal.length === 0 ? (
                <Empty
                  title="Journal empty"
                  body="Holds, proposals, and fills form the ship log."
                />
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {journal.map((e) => (
                    <article
                      key={e.id}
                      className="rounded-xl border border-line/80 bg-ink/50 px-3 py-2 text-sm text-slate-300"
                    >
                      <div className="font-mono text-[10px] text-accent/50">
                        {new Date(e.created_at).toLocaleString()}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                        {e.summary_md}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Safety rails" label="policy">
              <ul className="space-y-2 text-xs leading-relaxed text-mist">
                {[
                  "Paper-only by construction (sim / IBKR paper)",
                  "Grok researches; policy engine is pure code",
                  "Confirm TTL before any order reaches the book",
                  "Idempotent client_order_id on every submit",
                  "Free chat cap; Pro via Stripe when configured",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent/60" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </aside>
        </div>
      </div>

      <footer className="border-t border-line/60 py-5 text-center font-mono text-[11px] text-slate-600">
        IndieTrades · indietrades.com · educational paper trading · not
        investment advice · not a broker
        {healthInfo?.version ? ` · API v${healthInfo.version}` : ""}
      </footer>
    </main>
  );
}

function fmtMoney(v: string | undefined | null): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isFinite(n)) {
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }
  return String(v);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-stat">
      <div className="hud-label !text-[9px]">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}

function SkeletonStats() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl border border-line bg-ink/40"
        />
      ))}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-ink/40 px-3 py-5 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-mist">{body}</p>
    </div>
  );
}

function Panel({
  title,
  label,
  badge,
  children,
}: {
  title: string;
  label?: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hud-panel">
      <div className="hud-panel-header">
        <div>
          {label && <div className="hud-label mb-0.5">{label}</div>}
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        {badge && (
          <span className="rounded-full border border-accent/25 bg-accent/5 px-2 py-0.5 font-mono text-[10px] text-accent">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-mist">{k}</dt>
      <dd className="max-w-[60%] truncate text-slate-200">{v}</dd>
    </div>
  );
}
