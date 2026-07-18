/**
 * Static pixel-faithful Trade floor chrome for marketing screenshots.
 * No auth · not linked in nav · /dev/trade-shot
 */
export default function TradeShotPage() {
  const watch = [
    { s: "AAPL", px: "190.12", chg: "+0.40%", up: true, active: true },
    { s: "SPY", px: "520.40", chg: "+0.22%", up: true, active: false },
    { s: "NVDA", px: "124.80", chg: "−0.61%", up: false, active: false },
    { s: "MSFT", px: "420.15", chg: "+0.18%", up: true, active: false },
    { s: "TSLA", px: "248.90", chg: "−0.33%", up: false, active: false },
  ];
  const candles = [
    { x: 28, o: 72, up: true },
    { x: 52, o: 68, up: false },
    { x: 76, o: 62, up: true },
    { x: 100, o: 58, up: true },
    { x: 124, o: 54, up: false },
    { x: 148, o: 48, up: true },
    { x: 172, o: 44, up: true },
    { x: 196, o: 40, up: true },
    { x: 220, o: 36, up: false },
    { x: 244, o: 32, up: true },
    { x: 268, o: 30, up: true },
  ];

  return (
    <div className="min-h-screen bg-ink p-4 sm:p-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-line/80 bg-panel/95 shadow-2xl shadow-accent/10 ring-1 ring-accent/20">
        {/* Sticky chrome */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-good/30 bg-panel px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-good/50 bg-good/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-good">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-good" />
              Paper only
            </span>
            <span className="rounded-full border border-good/40 px-2 py-0.5 font-mono text-[10px] text-good">
              US RTH open
            </span>
            <span className="font-mono text-[10px] text-mist">
              Quotes as of 3:42:11 PM
            </span>
          </div>
          <span className="font-mono text-[10px] text-accent">Trade floor</span>
        </div>

        {/* Account strip */}
        <div className="grid grid-cols-2 gap-2 border-b border-line/60 px-4 py-3 sm:grid-cols-5">
          {[
            ["Net liq", "$100,000.00"],
            ["Cash", "$100,000.00"],
            ["Buying power", "$100,000.00"],
            ["Day P&L", "$0.00"],
            ["Open P&L", "$0.00"],
          ].map(([l, v]) => (
            <div
              key={l}
              className="rounded-xl border border-line/70 bg-ink/50 px-3 py-2"
            >
              <p className="font-mono text-[9px] uppercase tracking-wider text-mist">
                {l}
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-white">
                {v}
              </p>
            </div>
          ))}
        </div>
        <p className="border-b border-line/50 px-4 py-1.5 font-mono text-[10px] text-mist">
          Simulated paper account — not a broker · market data may be delayed ·
          starting budget $100k
        </p>

        <div className="grid gap-0 lg:grid-cols-12">
          {/* Watchlist */}
          <section className="border-b border-line/60 p-3 lg:col-span-3 lg:border-b-0 lg:border-r">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Watchlist</h2>
              <span className="font-mono text-[10px] text-mist">Last · Chg%</span>
            </div>
            <div className="mb-1 grid grid-cols-[1fr_auto_auto] gap-2 px-1 font-mono text-[10px] uppercase text-mist">
              <span>Sym</span>
              <span className="text-right">Last</span>
              <span className="w-14 text-right">Chg%</span>
            </div>
            <ul className="divide-y divide-line/60">
              {watch.map((r) => (
                <li
                  key={r.s}
                  className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-1 py-2.5 font-mono text-sm ${
                    r.active ? "bg-accent/10 ring-1 ring-inset ring-accent/30" : ""
                  }`}
                >
                  <span className="font-bold text-white">{r.s}</span>
                  <span className="text-slate-200">{r.px}</span>
                  <span
                    className={`w-14 text-right text-xs font-semibold ${
                      r.up ? "text-good" : "text-bad"
                    }`}
                  >
                    {r.chg}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Chart + ticket */}
          <section className="flex flex-col gap-0 border-b border-line/60 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div className="border-b border-line/50 p-3">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xl font-bold text-white">
                      AAPL
                    </span>
                    <span className="font-mono text-lg text-slate-200">190.12</span>
                    <span className="font-mono text-sm font-semibold text-good">
                      +0.40%
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] text-mist">
                    Candles · yahoo · 12s ago ·{" "}
                    <span className="text-good">PAPER view</span>
                  </p>
                </div>
                <div className="flex rounded-full border border-line p-0.5">
                  <span className="rounded-full bg-ink px-3 py-1 font-mono text-[11px] font-semibold text-white">
                    1D
                  </span>
                  <span className="rounded-full px-3 py-1 font-mono text-[11px] text-mist">
                    1M
                  </span>
                </div>
              </div>
              <svg
                viewBox="0 0 300 120"
                className="h-[140px] w-full sm:h-[160px]"
                aria-hidden
              >
                {candles.map((bar, i) => {
                  const c = bar.up ? bar.o - 10 : bar.o + 10;
                  const h = bar.o - 16;
                  const l = bar.o + 18;
                  const color = bar.up ? "#22c55e" : "#ef4444";
                  const top = Math.min(bar.o, c);
                  const body = Math.max(2, Math.abs(c - bar.o));
                  return (
                    <g key={i}>
                      <line
                        x1={bar.x}
                        x2={bar.x}
                        y1={h}
                        y2={l}
                        stroke={color}
                        strokeWidth="1.5"
                      />
                      <rect
                        x={bar.x - 6}
                        y={top}
                        width="12"
                        height={body}
                        fill={color}
                        rx="1"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Order ticket</h2>
                <span className="rounded-full border border-good/30 bg-good/10 px-2 py-0.5 font-mono text-[10px] font-bold text-good">
                  PAPER
                </span>
              </div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-good py-3 text-center text-sm font-bold uppercase text-ink">
                  Buy
                </div>
                <div className="rounded-xl border border-line py-3 text-center text-sm font-bold uppercase text-mist">
                  Sell
                </div>
              </div>
              <div className="mb-2 grid grid-cols-3 gap-2 font-mono text-xs">
                {[
                  ["Qty", "10"],
                  ["Limit", "190.00"],
                  ["TIF", "Day"],
                ].map(([l, v]) => (
                  <div
                    key={l}
                    className="rounded-xl border border-line/70 bg-ink/40 px-2 py-2"
                  >
                    <p className="text-[9px] uppercase text-mist">{l}</p>
                    <p className="mt-0.5 font-semibold text-white">{v}</p>
                  </div>
                ))}
              </div>
              <p className="mb-2 font-mono text-[11px] text-mist">
                Est. $1,900.00 · Limit · TIF Day · paper
              </p>
              <div className="rounded-xl bg-accent py-3.5 text-center text-sm font-bold text-ink">
                Review paper order →
              </div>
            </div>
          </section>

          {/* Blotter */}
          <section className="p-3 lg:col-span-4">
            <div className="mb-3 flex gap-1 rounded-full border border-line p-0.5">
              {["Positions", "Orders", "Fills"].map((t, i) => (
                <span
                  key={t}
                  className={`flex-1 rounded-full py-2 text-center text-xs font-semibold ${
                    i === 0 ? "bg-ink text-white" : "text-mist"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="py-8 text-center text-sm text-mist">
              No positions — pick a symbol, review, confirm.
            </p>
            <p className="border-t border-line/50 pt-2 font-mono text-[10px] text-mist">
              Hybrid fills · aggressive instant · passive working · not exchange
              matching
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
