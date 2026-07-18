import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** App icon — cognac IT mark for light/dark tabs */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#9a4d1c",
          borderRadius: 6,
          color: "#fffaf4",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: -0.5,
        }}
      >
        IT
      </div>
    ),
    { ...size }
  );
}
