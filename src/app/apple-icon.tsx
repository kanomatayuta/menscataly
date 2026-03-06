import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
          borderRadius: "36px",
          position: "relative",
        }}
      >
        {/* MENS text */}
        <span
          style={{
            fontSize: "48px",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-2px",
            lineHeight: 1,
          }}
        >
          MENS
        </span>
        {/* CATALY text in gold */}
        <span
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#d4a843",
            letterSpacing: "2px",
            lineHeight: 1,
            marginTop: "4px",
          }}
        >
          CATALY
        </span>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: "18px",
            width: "80px",
            height: "3px",
            background: "linear-gradient(90deg, #d4a843 0%, #e8c44a 100%)",
            borderRadius: "2px",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
