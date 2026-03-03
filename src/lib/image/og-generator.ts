/**
 * OGP画像フォールバックジェネレーター
 * Next.js ImageResponse API を使ったOGP画像生成
 * Ideogram画像が生成できない場合のバックアップ
 *
 * ブランドカラー:
 *   紺: #1a365d
 *   ゴールド: #c8a951
 */

import type { ContentCategory } from "@/types/content";

// ============================================================
// 定数
// ============================================================

/** OGP画像サイズ */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

/** ブランドカラー */
const BRAND_COLORS = {
  navy: "#1a365d",
  gold: "#c8a951",
  white: "#ffffff",
  lightNavy: "#2a4a7f",
} as const;

/** カテゴリ表示名 */
const CATEGORY_LABELS: Record<ContentCategory, string> = {
  aga: "AGA・薄毛治療",
  "hair-removal": "医療脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
};

/** カテゴリアクセントカラー */
const CATEGORY_COLORS: Record<ContentCategory, string> = {
  aga: "#4a90d9",
  "hair-removal": "#c8a951",
  skincare: "#4a7c59",
  ed: "#6b7280",
};

// ============================================================
// SVGベースのOGP画像生成
// ============================================================

/**
 * SVG文字列からOGP画像Bufferを生成する
 *
 * Next.js ImageResponse (next/og) は Edge Runtime専用のため、
 * サーバーサイドバッチ処理ではSVGバッファを返す。
 * Vercel Edge Functionでの利用時はImageResponseを使用すること。
 */
export async function generateOGImage(
  title: string,
  category: ContentCategory
): Promise<Buffer> {
  const categoryLabel = CATEGORY_LABELS[category];
  const accentColor = CATEGORY_COLORS[category];

  // タイトルを表示用に整形（長い場合は省略）
  const displayTitle = title.length > 40 ? `${title.slice(0, 40)}…` : title;

  const svgContent = buildOGSvg({
    title: displayTitle,
    categoryLabel,
    accentColor,
  });

  return Buffer.from(svgContent, "utf-8");
}

// ============================================================
// SVG構築
// ============================================================

interface OGSvgParams {
  title: string;
  categoryLabel: string;
  accentColor: string;
}

/**
 * OGP用SVGを生成する
 * ブランドカラー（紺 #1a365d + ゴールド #c8a951）を使用
 */
function buildOGSvg({ title, categoryLabel, accentColor }: OGSvgParams): string {
  const { navy, gold, white, lightNavy } = BRAND_COLORS;

  // タイトルを2行に分割（20文字で折り返し）
  const titleLines = splitTitleIntoLines(title, 22);
  const titleY1 = titleLines.length > 1 ? 260 : 300;
  const titleY2 = titleY1 + 72;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}"
  xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- 背景グラデーション -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${navy};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${lightNavy};stop-opacity:1" />
    </linearGradient>
    <!-- ゴールドアクセントグラデーション -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${gold};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e8c96a;stop-opacity:1" />
    </linearGradient>
    <!-- テキストシャドウフィルター -->
    <filter id="textShadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.4)" />
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bgGrad)" />

  <!-- 装飾: 右上の円形要素 -->
  <circle cx="${OG_WIDTH + 100}" cy="-50" r="350" fill="${lightNavy}" opacity="0.4" />
  <circle cx="${OG_WIDTH}" cy="${OG_HEIGHT}" r="250" fill="${lightNavy}" opacity="0.3" />

  <!-- 左サイドバー装飾 -->
  <rect x="0" y="0" width="8" height="${OG_HEIGHT}" fill="url(#goldGrad)" />

  <!-- カテゴリバッジ -->
  <rect x="60" y="60" width="220" height="44" rx="22" fill="${accentColor}" opacity="0.9" />
  <text x="170" y="89" font-family="Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif"
    font-size="18" font-weight="700" fill="${white}" text-anchor="middle"
    letter-spacing="2">
    ${escapeXml(categoryLabel)}
  </text>

  <!-- メインタイトル -->
  <text x="60" y="${titleY1}"
    font-family="Hiragino Kaku Gothic ProN, Yu Gothic, Noto Sans JP, sans-serif"
    font-size="64" font-weight="900" fill="${white}"
    filter="url(#textShadow)" letter-spacing="-1">
    ${escapeXml(titleLines[0] ?? "")}
  </text>
  ${
    titleLines[1]
      ? `<text x="60" y="${titleY2}"
        font-family="Hiragino Kaku Gothic ProN, Yu Gothic, Noto Sans JP, sans-serif"
        font-size="64" font-weight="900" fill="${white}"
        filter="url(#textShadow)" letter-spacing="-1">
        ${escapeXml(titleLines[1])}
      </text>`
      : ""
  }

  <!-- ゴールドアクセントライン（タイトル下） -->
  <rect x="60" y="${titleLines[1] ? titleY2 + 20 : titleY1 + 20}" width="120" height="4"
    rx="2" fill="url(#goldGrad)" />

  <!-- サイトブランド -->
  <text x="${OG_WIDTH - 60}" y="${OG_HEIGHT - 50}"
    font-family="Georgia, Times New Roman, serif"
    font-size="28" font-weight="700" fill="${gold}"
    text-anchor="end" letter-spacing="3">
    MENS CATALY
  </text>
  <text x="${OG_WIDTH - 60}" y="${OG_HEIGHT - 22}"
    font-family="Hiragino Kaku Gothic ProN, Yu Gothic, sans-serif"
    font-size="16" fill="${white}" opacity="0.7"
    text-anchor="end" letter-spacing="1">
    メンズカタリ | 医療・美容メディア
  </text>
</svg>`;
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * タイトルを指定文字数で行分割する
 */
function splitTitleIntoLines(title: string, maxLength: number): string[] {
  if (title.length <= maxLength) {
    return [title];
  }

  // 最大2行に分割
  const line1 = title.slice(0, maxLength);
  const line2 = title.slice(maxLength, maxLength * 2);
  return line2 ? [line1, line2] : [line1];
}

/**
 * XML特殊文字をエスケープする
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ============================================================
// OGP画像のContent-Type
// ============================================================

/** generateOGImageが返すバッファのContent-Type */
export const OG_IMAGE_CONTENT_TYPE = "image/svg+xml";
