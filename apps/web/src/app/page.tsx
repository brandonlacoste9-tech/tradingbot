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
        /* user can click refresh */
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
    <main className="min-h-screen pb-8">
      <DisclaimerBanner />

      <header className="sticky top-0 z-40 border-b border-line bg-panel/90 backdrop-blur-md">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                AI Trading Desk
              </h1>
              <p className="text-xs text-slate-500">
                Multi-user paper · research → policy → confirm
              </p>
              <div className="mt-2">
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
            />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        <HowItWorks />

        <div className="grid gap-4 lg:grid-cols-12">
          <section className="min-h-[560px] lg:col-span-7 lg:h-[calc(100vh-14rem)]">
            <Chat
              onProposalSubmitted={() => void refresh()}
              onActivity={() => void refresh()}
            />
          </section>

          <aside className="flex flex-col gap-4 lg:col-span-5 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
            <Panel title="Portfolio" badge={loading ? "loading…" : undefined}>
              {connError && (
                <p className="mb-2 text-sm text-bad">{connError}</p>
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
              <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
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
              badge={
                positions.length > 0 ? String(positions.length) : undefined
              }
            >
              {positions.length === 0 ? (
                <Empty
                  title="No open positions"
                  body="Research a symbol in chat, propose a limit order, then confirm in the preflight modal."
                />
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto">
                  {positions.map((p) => (
                    <div
                      key={p.symbol}
                      className="flex items-center justify-between rounded-lg border border-line/80 bg-ink/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium text-white">{p.symbol}</div>
                        <div className="text-xs text-slate-500">
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

            <Panel title="Journal">
              {journal.length === 0 ? (
                <Empty
                  title="Journal is empty"
                  body="Holds, proposals, and fills show up here as an audit trail."
                />
              ) : (
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {journal.map((e) => (
                    <article
                      key={e.id}
                      className="rounded-lg border border-line/80 bg-ink/40 px-3 py-2 text-sm text-slate-300"
                    >
                      <div className="text-[10px] text-slate-500">
                        {new Date(e.created_at).toLocaleString()}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{e.summary_md}</p>
                    </article>
                  ))}
                </div>
              )}
            </Panel>

            <BillingPanel />

            <Panel title="Safety rails">
              <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-slate-400">
                <li>Paper-only by construction (sim / IBKR paper)</li>
                <li>Grok researches; policy engine is pure code</li>
                <li>Confirm TTL before any order reaches the book</li>
                <li>Idempotent client_order_id on every submit</li>
                <li>Free plan daily chat cap; Pro via Stripe when configured</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>

      <footer className="border-t border-line py-4 text-center text-[11px] text-slate-600">
        Educational paper-trading tool. Not investment advice. Not a broker.{" "}
        {healthInfo?.version ? `API v${healthInfo.version}` : ""}
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
    <div className="rounded-xl border border-line bg-ink/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-medium text-white">
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
    <div className="rounded-xl border border-dashed border-line bg-ink/30 px-3 py-4 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {badge && (
          <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-slate-500">
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
      <dt className="text-slate-500">{k}</dt>
      <dd className="max-w-[60%] truncate font-mono text-slate-200">{v}</dd>
    </div>
  );
}
