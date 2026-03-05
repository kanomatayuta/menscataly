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
          background: "linear-gradient(135deg, #1e293b 0%, #1a365d 100%)",
          borderRadius: "36px",
        }}
      >
        {/* MC イニシャル */}
        <span
          style={{
            fontSize: "80px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-3px",
            lineHeight: 1,
          }}
        >
          MC
        </span>

        {/* 下部アクセントライン */}
        <div
          style={{
            position: "absolute",
            bottom: "20px",
            width: "60px",
            height: "3px",
            background: "linear-gradient(90deg, #c8a951 0%, #d8b633 100%)",
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
