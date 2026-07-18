/**
 * IndieTrades brand mark — "Updraft"
 * Candles + ascending path + confirm node (policy/you approve).
 * Uses currentColor so dark (cyan) and light (cognac) themes both work.
 */

type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  /** default = framed tile; plain = symbol only; compact = header size */
  variant?: "default" | "plain";
};

export function IndieTradesMark({
  size = 36,
  className = "",
  variant = "default",
}: {
  size?: number;
  className?: string;
  variant?: "default" | "plain";
}) {
  const uid = `it${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="6" y1="2" x2="38" y2="38">
          <stop stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.04" />
        </linearGradient>
      </defs>

      {variant !== "plain" && (
        <>
          <rect
            x="1.25"
            y="1.25"
            width="37.5"
            height="37.5"
            rx="10"
            fill={`url(#${uid}-bg)`}
            stroke="currentColor"
            strokeOpacity="0.4"
            strokeWidth="1.25"
          />
          <g opacity="0.1" stroke="currentColor" strokeWidth="0.55">
            <path d="M9 13h22M9 20h22M9 27h22" />
          </g>
        </>
      )}

      {/* Left candle (muted) */}
      <path
        d="M12.5 15v11"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <rect
        x="10"
        y="18"
        width="5"
        height="6.5"
        rx="1"
        fill="currentColor"
        fillOpacity="0.28"
      />

      {/* Mid candle */}
      <path
        d="M20 10.5v19"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <rect
        x="17.25"
        y="14.5"
        width="5.5"
        height="10.5"
        rx="1.15"
        fill="currentColor"
        fillOpacity="0.88"
      />

      {/* Right candle */}
      <path
        d="M27.5 9v15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect
        x="24.75"
        y="12"
        width="5.5"
        height="9"
        rx="1.15"
        fill="currentColor"
      />

      {/* Updraft path */}
      <path
        d="M10.5 27.5 L16 22.5 L20.5 17.5 L27 12.5"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Confirm node + check — the product moat */}
      <circle cx="30" cy="10.75" r="4.8" fill="currentColor" fillOpacity="0.18" />
      <circle cx="30" cy="10.75" r="3.15" fill="currentColor" />
      <path
        d="M28.35 10.85l1.15 1.2 2.25-2.55"
        stroke="var(--primary-btn-fg, #060b14)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function IndieTradesLogo({
  size = 36,
  withWordmark = true,
  className = "",
  variant = "default",
}: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <IndieTradesMark
        size={size}
        variant={variant}
        className="shrink-0 text-accent"
      />
      {withWordmark && (
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-wide text-white sm:text-[15px]">
            Indie<span className="text-accent">Trades</span>
          </span>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-accent/55 sm:block">
            paper desk
          </span>
        </span>
      )}
    </span>
  );
}

export default IndieTradesLogo;
