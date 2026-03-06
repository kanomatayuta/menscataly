import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

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
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)",
          borderRadius: "6px",
          position: "relative",
        }}
      >
        <span
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1px",
            lineHeight: 1,
          }}
        >
          M
        </span>
        {/* Gold accent dot */}
        <div
          style={{
            position: "absolute",
            bottom: "4px",
            width: "10px",
            height: "2px",
            background: "#d4a843",
            borderRadius: "1px",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
