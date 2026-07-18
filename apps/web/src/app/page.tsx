"use client";

import { useCallback, useEffect, useState } from "react";
import Chat from "@/components/Chat";
import {
  health,
  listJournal,
  portfolio,
  validateConnection,
} from "@/lib/api";
import type { ConnectionInfo, JournalEntry } from "@/lib/types";

export default function HomePage() {
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [conn, setConn] = useState<ConnectionInfo | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [account, setAccount] = useState<Record<string, string> | null>(null);
  const [positions, setPositions] = useState<unknown[]>([]);

  const refresh = useCallback(async () => {
    try {
      const h = await health();
      setApiOk(h.ok);
    } catch {
      setApiOk(false);
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
      setPositions(p.positions || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
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

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-panel/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              AI Trading Bot
            </h1>
            <p className="text-xs text-slate-500">
              L2 paper dashboard · LLM proposes · policy decides · you confirm
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <StatusPill
              ok={apiOk}
              label={apiOk == null ? "API…" : apiOk ? "API up" : "API down"}
            />
            <button
              type="button"
              onClick={() => void onValidate()}
              className="rounded-lg border border-line bg-ink px-3 py-1.5 text-slate-200 hover:border-accent"
            >
              Validate Alpaca paper
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-12">
        <section className="lg:col-span-7 h-[70vh] min-h-[480px]">
          <Chat onProposalSubmitted={() => void refresh()} />
        </section>

        <aside className="flex flex-col gap-4 lg:col-span-5">
          <Panel title="Connection">
            {connError && <p className="text-sm text-bad">{connError}</p>}
            {conn ? (
              <dl className="space-y-1 text-sm">
                <KV k="Paper" v={conn.is_paper ? "yes" : "no"} />
                <KV k="Account" v={conn.account_id || "—"} />
                <KV k="Status" v={conn.status || "—"} />
                <KV k="Equity" v={conn.equity || "—"} />
                <KV k="Buying power" v={conn.buying_power || "—"} />
                <KV k="Last validated" v={conn.last_validated || "—"} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500">
                Click “Validate Alpaca paper” after setting keys in{" "}
                <code className="text-slate-300">.env</code>.
              </p>
            )}
            {account && (
              <div className="mt-3 border-t border-line pt-3 text-sm">
                <KV k="Cash" v={account.cash || "—"} />
                <KV k="Portfolio value" v={account.portfolio_value || "—"} />
                <KV k="Positions" v={String(positions.length)} />
              </div>
            )}
          </Panel>

          <Panel title="Journal">
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {journal.length === 0 && (
                <p className="text-sm text-slate-500">No entries yet.</p>
              )}
              {journal.map((e) => (
                <article
                  key={e.id}
                  className="rounded-lg border border-line/80 bg-ink/40 px-3 py-2 text-sm text-slate-300"
                >
                  <div className="text-[10px] text-slate-500">
                    {e.created_at}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{e.summary_md}</p>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Safety">
            <ul className="list-disc space-y-1 pl-4 text-xs text-slate-400">
              <li>Paper-only by construction</li>
              <li>Policy engine is pure code (not the LLM)</li>
              <li>Confirm TTL default 180s (server-enforced)</li>
              <li>Unique client_order_id on every submit</li>
              <li>decide_hold journals without trading</li>
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
      <dd className="font-mono text-slate-200">{v}</dd>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean | null; label: string }) {
  const color =
    ok == null ? "bg-slate-600" : ok ? "bg-good" : "bg-bad";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-slate-300">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
