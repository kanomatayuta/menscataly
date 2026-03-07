import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getArticleBySlug } from "@/lib/microcms/client";

export const alt = "MENS CATALY 記事";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const CATEGORY_LABELS: Record<string, string> = {
  aga: "AGA・薄毛",
  "hair-removal": "メンズ脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
  column: "コラム",
};

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default async function OGImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();

  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  const title = article?.title ?? "記事が見つかりません";
  const categorySlug = article?.category?.slug ?? "";
  const categoryLabel = CATEGORY_LABELS[categorySlug] ?? "";
  const updatedAt = article?.updatedAt ? formatDate(article.updatedAt) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #1a202c 0%, #2d3748 50%, #1a365d 100%)",
          fontFamily: "sans-serif",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Top bar accent */}
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

        {/* Logo top-left */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-1px",
            }}
          >
            MENS
          </span>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "#c8a951",
              letterSpacing: "-1px",
            }}
          >
            CATALY
          </span>
        </div>

        {/* Article title center */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            paddingTop: "20px",
            paddingBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: title.length > 40 ? "36px" : title.length > 25 ? "42px" : "48px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
            }}
          >
            {title}
          </div>
        </div>

        {/* Bottom row: category badge left, domain right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {categoryLabel && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(200, 169, 81, 0.2)",
                  border: "2px solid #c8a951",
                  borderRadius: "8px",
                  padding: "8px 20px",
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#c8a951",
                }}
              >
                {categoryLabel}
              </div>
            )}
            {updatedAt && (
              <span
                style={{
                  fontSize: "18px",
                  color: "#a0aec0",
                }}
              >
                {updatedAt} 更新
              </span>
            )}
          </div>

          <span
            style={{
              fontSize: "20px",
              color: "#718096",
              fontWeight: 500,
            }}
          >
            menscataly.com
          </span>
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
