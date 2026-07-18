import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — larger Updraft mark */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a1018 0%, #121c2c 50%, #1a140f 100%)",
          borderRadius: 36,
          border: "3px solid rgba(34,211,238,0.35)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 40 40">
          <path
            d="M12.5 15v11"
            stroke="#64748b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect x="10" y="18" width="5" height="6.5" rx="1" fill="#64748b" opacity="0.75" />
          <path
            d="M20 10.5v19"
            stroke="#22d3ee"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <rect x="17.25" y="14.5" width="5.5" height="10.5" rx="1.15" fill="#22d3ee" />
          <path
            d="M27.5 9v15"
            stroke="#67e8f9"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <rect x="24.75" y="12" width="5.5" height="9" rx="1.15" fill="#67e8f9" />
          <path
            d="M10.5 27.5 L16 22.5 L20.5 17.5 L27 12.5"
            stroke="#22d3ee"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="30" cy="10.75" r="3.6" fill="#ecfeff" />
          <path
            d="M28.45 10.9l1.15 1.2 2.2-2.5"
            stroke="#0e7490"
            strokeWidth="1.55"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
