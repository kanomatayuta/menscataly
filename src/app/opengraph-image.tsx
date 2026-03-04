import { ImageResponse } from "next/og";

export const alt = "MENS CATALY - メンズ医療・美容の総合メディア";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OGImage() {
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
          background: "linear-gradient(135deg, #1a365d 0%, #2c4f8a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* ロゴテキスト */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
          }}
        >
          <span
            style={{
              fontSize: "80px",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-2px",
            }}
          >
            MENS
          </span>
          <span
            style={{
              fontSize: "80px",
              fontWeight: 700,
              color: "#c8a951",
              letterSpacing: "-2px",
            }}
          >
            CATALY
          </span>
        </div>

        {/* サブテキスト */}
        <div
          style={{
            marginTop: "24px",
            fontSize: "28px",
            color: "#b3c5e0",
            letterSpacing: "4px",
          }}
        >
          メンズ医療・美容の総合メディア
        </div>

        {/* 下部バー */}
        <div
          style={{
            position: "absolute",
            bottom: "0",
            left: "0",
            right: "0",
            height: "6px",
            background: "linear-gradient(90deg, #c8a951 0%, #d8b633 100%)",
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
