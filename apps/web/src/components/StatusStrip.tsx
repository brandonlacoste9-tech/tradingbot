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
};

export default function StatusStrip({
  health,
  apiOk,
  usage,
  plan,
  chatBlocked,
  blockReason,
  onRefresh,
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
    <div className="space-y-2">
      {chatBlocked && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Service paused
          {blockReason ? `: ${blockReason}` : ""}. Chat and confirms are blocked.
        </div>
      )}
      {health?.global_kill && !chatBlocked && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          Global kill switch is active on the API.
        </div>
      )}
      {circuit !== "closed" && (
        <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          LLM circuit: <span className="font-mono">{circuit}</span> — demo agent
          may answer until the provider recovers.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Pill
          ok={apiOk}
          label={apiOk == null ? "API…" : apiOk ? "API up" : "API down"}
        />
        <Chip
          label={`broker: ${health?.broker_backend || "…"}`}
          tone="accent"
        />
        <Chip
          label={
            health?.llm_enabled
              ? `llm: ${health.llm_provider || "on"}`
              : "llm: demo"
          }
          tone={health?.llm_enabled ? "good" : "muted"}
        />
        <Chip
          label={health?.paper_only ? "paper only" : "live risk"}
          tone={health?.paper_only ? "good" : "warn"}
        />
        {primary && (
          <Chip label={`data: ${primary}`} tone="muted" />
        )}
        {plan && <Chip label={`plan: ${plan}`} tone="accent" />}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-line bg-ink px-3 py-1.5 text-xs text-slate-200 hover:border-accent"
          >
            Refresh paper
          </button>
        )}
      </div>

      {pct != null && used != null && limit != null && (
        <div className="max-w-md">
          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span>Chats today</span>
            <span className="font-mono text-slate-200">
              {used} / {limit}
              {usage?.remaining != null ? ` · ${usage.remaining} left` : ""}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink">
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
