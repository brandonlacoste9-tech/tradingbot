"use client";

import type { HealthInfo } from "@/lib/types";

type Usage = {
  used?: number;
  limit?: number;
  remaining?: number;
  plan?: string;
};

type Props = {
  health: HealthInfo | null;
  apiOk: boolean | null;
  usage: Usage | null;
  plan: string | null;
  chatBlocked?: boolean;
  blockReason?: string | null;
  onRefresh?: () => void;
  onOpenPlans?: () => void;
};

export default function StatusStrip({
  health,
  apiOk,
  usage,
  plan,
  chatBlocked,
  blockReason,
  onRefresh,
  onOpenPlans,
}: Props) {
  const used = usage?.used;
  const limit = usage?.limit;
  const pct =
    used != null && limit != null && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : null;
  const primary = health?.market_data?.primary;
  const circuit = health?.llm_circuit || "closed";

  return (
    <div className="space-y-2.5">
      {chatBlocked && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 font-mono text-xs text-bad">
          SERVICE PAUSED
          {blockReason ? `: ${blockReason}` : ""}
        </div>
      )}
      {health?.global_kill && !chatBlocked && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 font-mono text-xs text-bad">
          KILL SWITCH ACTIVE
        </div>
      )}
      {circuit !== "closed" && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          LLM circuit <span className="font-mono">{circuit}</span> — demo may
          answer until recovery
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill
          ok={apiOk}
          label={apiOk == null ? "API…" : apiOk ? "API UP" : "API DOWN"}
        />
        <Chip label={`BRK ${health?.broker_backend || "…"}`} tone="accent" />
        <Chip
          label={
            health?.llm_enabled
              ? `LLM ${(health.llm_provider || "on").toUpperCase()}`
              : "LLM DEMO"
          }
          tone={health?.llm_enabled ? "good" : "muted"}
        />
        <Chip
          label={health?.paper_only ? "PAPER" : "LIVE RISK"}
          tone={health?.paper_only ? "good" : "warn"}
        />
        {primary && <Chip label={`DATA ${primary}`} tone="muted" />}
        {plan && (
          <button
            type="button"
            onClick={onOpenPlans}
            className="hud-chip border-accent/35 text-accent hover:bg-accent/10"
            title="Open plans & billing"
          >
            PLAN {plan.toUpperCase()}
          </button>
        )}
        {onOpenPlans && (
          <button
            type="button"
            onClick={onOpenPlans}
            className="rounded-full border border-accent/50 bg-accent/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-accent hover:bg-accent/25"
          >
            {plan && plan !== "free" ? "Manage plan" : "Plans / Upgrade"}
          </button>
        )}
        {onRefresh && (
          <button type="button" onClick={onRefresh} className="hud-btn">
            Sync book
          </button>
        )}
      </div>

      {pct != null && used != null && limit != null && (
        <div className="min-w-[200px] max-w-sm">
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-wider text-mist">
            <span>Comms quota</span>
            <span className="text-slate-200">
              {used}/{limit}
              {usage?.remaining != null ? ` · ${usage.remaining} left` : ""}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-ink ring-1 ring-line">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 90 ? "bg-bad" : pct >= 70 ? "bg-warn" : "bg-accent"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok == null ? "bg-slate-500" : ok ? "bg-good" : "bg-bad";
  return (
    <span className="hud-chip">
      <span className={`h-1.5 w-1.5 rounded-full ${color} ${ok ? "animate-pulse" : ""}`} />
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
      ? "border-good/35 text-good"
      : tone === "warn"
        ? "border-warn/35 text-warn"
        : tone === "accent"
          ? "border-accent/35 text-accent"
          : "border-line text-mist";
  return (
    <span className={`hud-chip ${cls}`}>{label}</span>
  );
}
