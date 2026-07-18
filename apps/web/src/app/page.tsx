"use client";

import { useCallback, useEffect, useState } from "react";
import BillingPanel from "@/components/BillingPanel";
import Chat from "@/components/Chat";
import UserBar from "@/components/UserBar";
import {
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
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      // Auto-validate sim paper so desk shows equity immediately
      try {
        const c = await validateConnection();
        setConn(c);
        await refresh();
      } catch {
        /* user can click validate */
      }
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
    <main className="min-h-screen">
      <header className="border-b border-line bg-panel/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              AI Trading Desk
            </h1>
            <p className="text-xs text-slate-500">
              Research → policy → confirm · multi-user paper (PR1)
            </p>
            <div className="mt-2">
              <UserBar />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill
              ok={apiOk}
              label={apiOk == null ? "API…" : apiOk ? "API up" : "API down"}
            />
            <Chip
              label={`broker: ${healthInfo?.broker_backend || "…"}`}
              tone="accent"
            />
            <Chip
              label={
                healthInfo?.llm_enabled
                  ? `llm: ${healthInfo.llm_provider || "on"}`
                  : "llm: demo"
              }
              tone={healthInfo?.llm_enabled ? "good" : "muted"}
            />
            <Chip
              label={healthInfo?.paper_only ? "paper only" : "live enabled"}
              tone={healthInfo?.paper_only ? "good" : "warn"}
            />
            <button
              type="button"
              onClick={() => void onValidate()}
              className="rounded-lg border border-line bg-ink px-3 py-1.5 text-slate-200 hover:border-accent"
            >
              Refresh paper
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-12">
        <section className="h-[70vh] min-h-[480px] lg:col-span-7">
          <Chat onProposalSubmitted={() => void refresh()} />
        </section>

        <aside className="flex flex-col gap-4 lg:col-span-5">
          <Panel title="Portfolio">
            {connError && <p className="mb-2 text-sm text-bad">{connError}</p>}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Equity" value={fmtMoney(equity)} />
              <Stat label="Cash" value={fmtMoney(cash)} />
              <Stat label="Buying power" value={fmtMoney(bp)} />
            </div>
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

          <Panel title="Positions">
            {positions.length === 0 ? (
              <p className="text-sm text-slate-500">
                No open positions. Confirm a paper trade from chat.
              </p>
            ) : (
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {positions.map((p) => (
                  <div
                    key={p.symbol}
                    className="flex items-center justify-between rounded-lg border border-line/80 bg-ink/40 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-white">{p.symbol}</div>
                      <div className="text-xs text-slate-500">
                        qty {p.qty}
                        {p.avg_entry_price ? ` · avg ${p.avg_entry_price}` : ""}
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
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {journal.length === 0 && (
                <p className="text-sm text-slate-500">
                  No entries yet. Research or propose a trade to log decisions.
                </p>
              )}
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
          </Panel>

          <BillingPanel />

          <Panel title="Safety">
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">
              <li>Paper-only by construction (sim / IBKR paper)</li>
              <li>Grok researches; policy engine is pure code</li>
              <li>Confirm TTL 180s before any order</li>
              <li>client_order_id on every submit</li>
              <li>decide_hold journals quiet days</li>
              <li>Free plan daily chat cap; Pro via Stripe</li>
            </ul>
          </Panel>
        </aside>
      </div>

      <footer className="border-t border-line py-4 text-center text-[11px] text-slate-600">
        Educational paper-trading tool. Not investment advice. Not a broker.
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

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{title}</h3>
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

function StatusPill({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok == null ? "bg-slate-600" : ok ? "bg-good" : "bg-bad";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-slate-300">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "accent" | "good" | "warn" | "muted";
}) {
  const cls =
    tone === "good"
      ? "border-good/40 text-good"
      : tone === "warn"
        ? "border-warn/40 text-warn"
        : tone === "accent"
          ? "border-accent/40 text-accent"
          : "border-line text-slate-400";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[11px] ${cls}`}
    >
      {label}
    </span>
  );
}
