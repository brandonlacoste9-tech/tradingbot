"use client";

import type { ReactNode } from "react";

/**
 * Phase 2 Trade floor chart — pure green/red candles when OHLC is solid,
 * else line series. No fake bars; empty/error states are honest.
 */

export type ChartBar = {
  t?: string | number | null;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number | null;
};

type Props = {
  symbol: string;
  bars: ChartBar[];
  timeframe: "1Day" | "1Month";
  onTimeframe: (tf: "1Day" | "1Month") => void;
  source?: string | null;
  fetchedAt?: string | null;
  loading?: boolean;
  error?: string | null;
  lastPrice?: string | null;
  changePercent?: string | null;
};

const GREEN = "#22c55e";
const RED = "#ef4444";

function hasSolidOhlc(bars: ChartBar[]): boolean {
  if (bars.length < 2) return false;
  let ok = 0;
  for (const b of bars) {
    if (
      Number.isFinite(b.o) &&
      Number.isFinite(b.h) &&
      Number.isFinite(b.l) &&
      Number.isFinite(b.c) &&
      b.h >= Math.max(b.o, b.c) &&
      b.l <= Math.min(b.o, b.c)
    ) {
      ok++;
    }
  }
  return ok / bars.length >= 0.85;
}

function ageLabel(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0) return "just now";
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    return `${Math.floor(m / 60)}h ago`;
  } catch {
    return "—";
  }
}

export default function SymbolChart({
  symbol,
  bars,
  timeframe,
  onTimeframe,
  source,
  fetchedAt,
  loading,
  error,
  lastPrice,
  changePercent,
}: Props) {
  const candles = hasSolidOhlc(bars);
  const pct = changePercent != null ? Number(String(changePercent).replace("%", "")) : null;
  const upDay = pct != null ? pct >= 0 : bars.length >= 2 ? bars[bars.length - 1].c >= bars[0].c : true;
  const seriesColor = upDay ? GREEN : RED;

  const W = 640;
  const H = 220;
  const pad = { t: 12, r: 12, b: 22, l: 12 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  let chartBody: ReactNode = null;

  if (loading) {
    chartBody = (
      <div className="flex h-[200px] items-center justify-center text-sm text-mist">
        Loading {symbol} chart…
      </div>
    );
  } else if (error && bars.length === 0) {
    chartBody = (
      <div className="flex h-[200px] flex-col items-center justify-center gap-1 px-4 text-center text-sm text-mist">
        <span>No honest bars for {symbol}</span>
        <span className="font-mono text-xs text-slate-500">{error}</span>
      </div>
    );
  } else if (bars.length < 2) {
    chartBody = (
      <div className="flex h-[200px] items-center justify-center text-sm text-mist">
        Not enough data to chart {symbol}
      </div>
    );
  } else {
    const highs = bars.map((b) => b.h);
    const lows = bars.map((b) => b.l);
    const minY = Math.min(...lows);
    const maxY = Math.max(...highs);
    const span = maxY - minY || 1;
    const y = (v: number) => pad.t + innerH - ((v - minY) / span) * innerH;
    const n = bars.length;

    if (candles) {
      const slot = innerW / n;
      const bodyW = Math.max(2, Math.min(10, slot * 0.55));
      chartBody = (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[200px] w-full sm:h-[240px]"
          role="img"
          aria-label={`${symbol} candlestick chart`}
        >
          {bars.map((b, i) => {
            const cx = pad.l + slot * i + slot / 2;
            const color = b.c >= b.o ? GREEN : RED;
            const yO = y(b.o);
            const yC = y(b.c);
            const top = Math.min(yO, yC);
            const bot = Math.max(yO, yC);
            const bodyH = Math.max(1, bot - top);
            return (
              <g key={i}>
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(b.h)}
                  y2={y(b.l)}
                  stroke={color}
                  strokeWidth={1.25}
                />
                <rect
                  x={cx - bodyW / 2}
                  y={top}
                  width={bodyW}
                  height={bodyH}
                  fill={color}
                  rx={0.5}
                />
              </g>
            );
          })}
        </svg>
      );
    } else {
      const pts = bars
        .map((b, i) => {
          const x = pad.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
          return `${x},${y(b.c)}`;
        })
        .join(" ");
      const area = `${pad.l},${pad.t + innerH} ${pts} ${pad.l + innerW},${pad.t + innerH}`;
      chartBody = (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[200px] w-full sm:h-[240px]"
          role="img"
          aria-label={`${symbol} line chart`}
        >
          <polygon points={area} fill={seriesColor} fillOpacity={0.12} />
          <polyline
            points={pts}
            fill="none"
            stroke={seriesColor}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      );
    }
  }

  const pctLabel =
    pct != null && !Number.isNaN(pct)
      ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
      : null;

  return (
    <div className="hud-panel !py-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-lg font-bold text-white sm:text-xl">
              {symbol}
            </span>
            {lastPrice && (
              <span className="font-mono text-base text-slate-200 sm:text-lg">
                {Number(lastPrice).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            )}
            {pctLabel && (
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: upDay ? GREEN : RED }}
              >
                {pctLabel}
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-mist">
            {candles && bars.length >= 2 ? "Candles" : "Line"}
            {source ? ` · ${source}` : ""}
            {fetchedAt ? ` · ${ageLabel(fetchedAt)}` : ""}
            {" · "}
            <span className="text-good">PAPER view</span>
          </p>
        </div>
        <div className="flex rounded-full border border-line p-0.5">
          {(["1Day", "1Month"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onTimeframe(tf)}
              className={`min-h-9 rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
                timeframe === tf
                  ? "bg-ink text-white"
                  : "text-mist hover:text-white"
              }`}
            >
              {tf === "1Day" ? "1D" : "1M"}
            </button>
          ))}
        </div>
      </div>
      {chartBody}
    </div>
  );
}
