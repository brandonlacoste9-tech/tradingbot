import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "IndieTrades — AI paper trading desk. Research, policy, confirm.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #060b14 0%, #0c1524 45%, #1a120c 100%)",
          color: "#f1f5f9",
          padding: "56px 64px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#22d3ee",
            fontWeight: 600,
          }}
        >
          INDIETRADES · PAPER ONLY
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            AI paper trading desk
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#94a3b8",
              maxWidth: 820,
              lineHeight: 1.35,
            }}
          >
            Grok researches · policy gates risk · you confirm · PaperSim fills
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 18,
            color: "#67e8f9",
          }}
        >
          <span
            style={{
              border: "1px solid rgba(34,211,238,0.4)",
              borderRadius: 999,
              padding: "8px 16px",
            }}
          >
            indietrades.com
          </span>
          <span
            style={{
              border: "1px solid rgba(52,211,153,0.4)",
              borderRadius: 999,
              padding: "8px 16px",
              color: "#6ee7b7",
            }}
          >
            Not investment advice
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
