"use client";

import { useEffect, useMemo, useState } from "react";
import type { TradeProposal } from "@/lib/types";
import { confirmProposal, rejectProposal } from "@/lib/api";

interface Props {
  proposal: TradeProposal;
  onClose: (updated?: TradeProposal) => void;
}

function secondsLeft(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const exp = new Date(expiresAt).getTime();
  return Math.max(0, Math.floor((exp - Date.now()) / 1000));
}

export default function PreflightModal({ proposal, onClose }: Props) {
  const [left, setLeft] = useState(() => secondsLeft(proposal.expires_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalTtl] = useState(() => {
    const s = secondsLeft(proposal.expires_at);
    return s > 0 ? s : 180;
  });

  useEffect(() => {
    setLeft(secondsLeft(proposal.expires_at));
    const t = setInterval(() => {
      setLeft(secondsLeft(proposal.expires_at));
    }, 250);
    return () => clearInterval(t);
  }, [proposal.expires_at, proposal.id]);

  const expired = left <= 0 || proposal.policy_status === "expired";
  const impact = proposal.impact || {};
  const ttlPct = Math.max(0, Math.min(100, (left / totalTtl) * 100));

  const ttlLabel = useMemo(() => {
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [left]);

  const sideBuy = proposal.side === "buy";

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await confirmProposal(proposal.id);
      onClose(res.proposal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    setBusy(true);
    setError(null);
    try {
      const updated = await rejectProposal(
        proposal.id,
        "Rejected from preflight UI"
      );
      onClose(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preflight-title"
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-panel shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Paper preflight
              <span className="rounded-full border border-good/40 bg-good/10 px-2 py-0.5 font-mono text-[10px] font-bold text-good">
                PAPER
              </span>
            </p>
            <h2
              id="preflight-title"
              className="text-lg font-semibold text-white"
            >
              Confirm order
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Policy passed. Nothing submits until you confirm.
            </p>
            <p className="mt-1 text-xs text-mist">
              PaperSim: aggressive → fill at last/mark · passive → working in
              Orders. Not a live broker.
            </p>
          </div>
          <div
            className={`rounded-lg px-3 py-1 font-mono text-sm ${
              expired
                ? "bg-bad/20 text-bad"
                : left < 30
                  ? "bg-warn/20 text-warn"
                  : "bg-accent/20 text-accent"
            }`}
          >
            TTL {ttlLabel}
          </div>
        </div>

        <div className="h-1 w-full bg-ink">
          <div
            className={`h-full transition-all ${
              expired ? "bg-bad" : left < 30 ? "bg-warn" : "bg-accent"
            }`}
            style={{ width: `${ttlPct}%` }}
          />
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <div
            className={`rounded-xl border px-4 py-3 ${
              sideBuy
                ? "border-good/30 bg-good/5"
                : "border-bad/30 bg-bad/5"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className={`text-xs font-bold uppercase ${
                  sideBuy ? "text-good" : "text-bad"
                }`}
              >
                {proposal.side}
              </span>
              <span className="text-2xl font-semibold tracking-tight text-white">
                {proposal.symbol}
              </span>
              <span className="font-mono text-slate-300">
                {proposal.qty} @ {proposal.limit_price ?? "mkt"}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {proposal.order_type} · paper book only
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Mini
              label="Est. notional"
              value={String(impact.estimated_notional ?? "—")}
            />
            <Mini
              label="BP impact"
              value={String(impact.estimated_bp_impact ?? "—")}
            />
            <Mini
              label="Risk util."
              value={
                impact.risk_utilization_pct != null
                  ? `${Number(impact.risk_utilization_pct).toFixed(1)}%`
                  : "—"
              }
            />
            <Mini
              label="Max loss scen."
              value={String(impact.max_loss_scenario ?? "—")}
            />
          </div>

          <div className="rounded-xl border border-line bg-ink/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Thesis
            </div>
            <p className="mt-1 text-slate-200">{proposal.reason}</p>
          </div>
          <div className="truncate font-mono text-xs text-slate-600">
            client_order_id: {proposal.client_order_id}
          </div>
          {error && (
            <div className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-bad">
              {error}
            </div>
          )}
          {expired && (
            <div className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
              This proposal expired. Close and create a new one from chat.
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-line bg-panel px-4 py-3 sm:static sm:flex-row sm:gap-3 sm:px-5 sm:py-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            className="min-h-12 flex-1 rounded-xl border border-line px-4 py-3 text-slate-300 hover:bg-ink"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onReject()}
            className="min-h-12 flex-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-bad hover:bg-bad/20"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy || expired}
            onClick={() => void onConfirm()}
            className="min-h-12 flex-1 rounded-xl bg-good px-4 py-3 text-base font-semibold text-ink hover:bg-good/90 disabled:opacity-40"
          >
            {busy ? "Working…" : "Confirm paper trade"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line/80 bg-ink/40 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-xs text-slate-100">
        {value}
      </div>
    </div>
  );
}
