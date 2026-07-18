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

  useEffect(() => {
    setLeft(secondsLeft(proposal.expires_at));
    const t = setInterval(() => {
      setLeft(secondsLeft(proposal.expires_at));
    }, 250);
    return () => clearInterval(t);
  }, [proposal.expires_at, proposal.id]);

  const expired = left <= 0 || proposal.policy_status === "expired";
  const impact = proposal.impact || {};

  const ttlLabel = useMemo(() => {
    const m = Math.floor(left / 60);
    const s = left % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [left]);

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
      const updated = await rejectProposal(proposal.id, "Rejected from preflight UI");
      onClose(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Preflight — confirm order</h2>
            <p className="mt-1 text-sm text-slate-400">
              Policy passed. Nothing is submitted until you confirm.
            </p>
          </div>
          <div
            className={`rounded-lg px-3 py-1 font-mono text-sm ${
              expired ? "bg-bad/20 text-bad" : "bg-accent/20 text-accent"
            }`}
          >
            TTL {ttlLabel}
          </div>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <Row label="Symbol" value={proposal.symbol} />
          <Row label="Side" value={proposal.side.toUpperCase()} />
          <Row label="Qty" value={proposal.qty} />
          <Row label="Type" value={proposal.order_type} />
          <Row label="Limit" value={proposal.limit_price ?? "—"} />
          <Row
            label="Est. notional"
            value={String(impact.estimated_notional ?? "—")}
          />
          <Row
            label="BP impact"
            value={String(impact.estimated_bp_impact ?? "—")}
          />
          <Row
            label="Risk util."
            value={
              impact.risk_utilization_pct != null
                ? `${Number(impact.risk_utilization_pct).toFixed(1)}%`
                : "—"
            }
          />
          <Row
            label="Max loss scenario"
            value={String(impact.max_loss_scenario ?? "—")}
          />
          <div className="rounded-xl border border-line bg-ink/60 p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Thesis</div>
            <p className="mt-1 text-slate-200">{proposal.reason}</p>
          </div>
          <div className="font-mono text-xs text-slate-500">
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

        <div className="flex gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={() => onClose()}
            className="flex-1 rounded-xl border border-line px-4 py-2.5 text-slate-300 hover:bg-ink"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="flex-1 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-bad hover:bg-bad/20"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy || expired}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-good px-4 py-2.5 font-medium text-ink hover:bg-good/90 disabled:opacity-40"
          >
            {busy ? "Working…" : "Confirm paper trade"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/60 py-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}
