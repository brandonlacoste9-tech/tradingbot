"use client";

import { useState } from "react";
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
  const [showDetails, setShowDetails] = useState(false);
  const used = usage?.used;
  const limit = usage?.limit;
  const pct =
    used != null && limit != null && limit > 0
      ? Math.min(100, Math.round((used / limit) * 100))
      : null;
  const primary = health?.market_data?.primary;
  const circuit = health?.llm_circuit || "closed";

  const planLabel =
    plan === "pro"
      ? "Indie Pro"
      : plan === "pro_plus"
        ? "Indie Pro+"
        : plan
          ? plan
          : null;

  return (
    <div className="space-y-2.5">
      {chatBlocked && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Service paused
          {blockReason ? `: ${blockReason}` : ""}
        </div>
      )}
      {health?.global_kill && !chatBlocked && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Trading paused (kill switch)
        </div>
      )}
      {circuit !== "closed" && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          Research temporarily limited — demo replies may run until recovery
        </div>
      )}

      {/* Primary: paper + plan + plans CTA only */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="hud-chip border-good/35 text-good">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
          Paper only
        </span>
        <Pill
          ok={apiOk}
          label={apiOk == null ? "Connecting…" : apiOk ? "Online" : "API down"}
        />
        {planLabel && (
          <button
            type="button"
            onClick={onOpenPlans}
            className="hud-chip border-accent/35 text-accent hover:bg-accent/10"
            title="Open plans"
          >
            {planLabel}
          </button>
        )}
        {onOpenPlans && (
          <button
            type="button"
            onClick={onOpenPlans}
            className="rounded-full border border-accent/50 bg-accent/15 px-3 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25"
          >
            Plans
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="hud-chip border-line text-mist hover:text-slate-200"
          aria-expanded={showDetails}
        >
          {showDetails ? "Hide status" : "Status"}
        </button>
        {onRefresh && showDetails && (
          <button type="button" onClick={onRefresh} className="hud-btn">
            Refresh book
          </button>
        )}
      </div>

      {showDetails && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip
            label={health?.broker_backend || "…"}
            tone="accent"
          />
          <Chip
            label={
              health?.llm_enabled
                ? (health.llm_provider || "llm").toUpperCase()
                : "demo agent"
            }
            tone={health?.llm_enabled ? "good" : "muted"}
          />
          {primary && <Chip label={`data: ${primary}`} tone="muted" />}
          {health?.version && (
            <Chip label={`api ${health.version}`} tone="muted" />
          )}
        </div>
      )}

      {pct != null && used != null && limit != null && (
        <div className="min-w-[200px] max-w-sm">
          <div className="mb-1 flex justify-between text-[10px] text-mist">
            <span>Daily chats</span>
            <span className="font-mono text-slate-200">
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
      <span
        className={`h-1.5 w-1.5 rounded-full ${color} ${ok ? "animate-pulse" : ""}`}
      />
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
  return <span className={`hud-chip ${cls}`}>{label}</span>;
}
