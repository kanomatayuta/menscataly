import { ImageResponse } from "next/og";
import { connection } from "next/server";

export const alt = "MENS CATALY - 記事一覧";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const CATEGORIES = [
  "AGA・薄毛",
  "医療脱毛",
  "スキンケア",
  "ED治療",
];

export default async function OGImage() {
  await connection();

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
          background: "linear-gradient(135deg, #1a365d 0%, #2c4f8a 50%, #1a202c 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: "absolute",
            top: "0",
            left: "0",
            right: "0",
            height: "6px",
            background: "linear-gradient(90deg, #c8a951 0%, #d8b633 100%)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
          }}
        >
          <span
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-2px",
            }}
          >
            MENS
          </span>
          <span
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#c8a951",
              letterSpacing: "-2px",
            }}
          >
            CATALY
          </span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: "20px",
            fontSize: "28px",
            color: "#b3c5e0",
            letterSpacing: "4px",
          }}
        >
          メンズ医療・美容の総合メディア
        </div>

        {/* Category badges */}
        <div
          style={{
            marginTop: "40px",
            display: "flex",
            gap: "16px",
          }}
        >
          {CATEGORIES.map((cat) => (
            <div
              key={cat}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "rgba(200, 169, 81, 0.15)",
                border: "2px solid rgba(200, 169, 81, 0.5)",
                borderRadius: "8px",
                padding: "8px 20px",
                fontSize: "18px",
                fontWeight: 600,
                color: "#c8a951",
              }}
            >
              {cat}
            </div>
          ))}
        </div>

        {/* Bottom bar accent */}
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
