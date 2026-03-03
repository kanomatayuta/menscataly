/**
 * 画像パイプライン 型定義
 * Ideogram API + Cloudinary 画像管理
 */

import type { ContentCategory } from "@/types/content";

// ============================================================
// Ideogram API
// ============================================================

/** 画像スタイル */
export type ImageStyle =
  | "medical"      // 医療・クリニック風
  | "beauty"       // 美容・コスメ風
  | "abstract"     // 抽象的デザイン
  | "lifestyle";   // ライフスタイル

/** アスペクト比 */
export type AspectRatio = "16:9" | "1:1" | "4:3" | "3:2";

/** サムネイル生成リクエスト */
export interface ThumbnailRequest {
  /** 記事タイトル */
  title: string;
  /** コンテンツカテゴリ */
  category: ContentCategory;
  /** スタイル（省略時はカテゴリから自動判定） */
  style?: ImageStyle;
  /** アスペクト比（デフォルト: 16:9） */
  aspectRatio?: AspectRatio;
}

/** サムネイル生成結果 */
export interface ThumbnailResult {
  /** 生成された画像URL */
  url: string;
  /** 画像幅（ピクセル） */
  width: number;
  /** 画像高さ（ピクセル） */
  height: number;
  /** 使用したプロンプト */
  prompt: string;
  /** プレースホルダーフラグ（API未設定時） */
  isPlaceholder?: boolean;
}

// ============================================================
// Cloudinary
// ============================================================

/** Cloudinaryアップロードオプション */
export interface UploadOptions {
  /** フォルダパス（例: "menscataly/articles"） */
  folder?: string;
  /** パブリックID（省略時は自動生成） */
  publicId?: string;
  /** アップロード時のトランスフォーメーション */
  transformation?: TransformOptions;
}

/** トランスフォームオプション */
export interface TransformOptions {
  /** 幅（ピクセル） */
  width?: number;
  /** 高さ（ピクセル） */
  height?: number;
  /** クロップモード */
  crop?: "fill" | "fit" | "limit" | "pad" | "scale" | "thumb";
  /** 品質（1-100 または "auto"） */
  quality?: number | "auto";
  /** 出力フォーマット */
  format?: "webp" | "jpg" | "png" | "avif";
}

/** Cloudinaryアップロード結果 */
export interface CloudinaryResult {
  /** Cloudinaryパブリックグローバルプレフィックス付きID */
  publicId: string;
  /** HTTPS CDN URL */
  secureUrl: string;
  /** 画像幅（ピクセル） */
  width: number;
  /** 画像高さ（ピクセル） */
  height: number;
  /** フォーマット（例: "webp"） */
  format: string;
  /** ファイルサイズ（バイト） */
  bytes: number;
  /** プレースホルダーフラグ（API未設定時） */
  isPlaceholder?: boolean;
}

// ============================================================
// 画像サイズバリアント
// ============================================================

/** 画像サイズバリアント */
export interface ImageVariant {
  /** CDN URL */
  url: string;
  /** 幅（ピクセル） */
  width: number;
  /** 高さ（ピクセル） */
  height: number;
}

/** 記事用画像セット */
export interface ArticleImages {
  /** サムネイル画像（400x225） */
  thumbnail: ImageVariant;
  /** カード画像（800x450） */
  card: ImageVariant;
  /** OGP画像（1200x630） */
  og: ImageVariant;
  /** Cloudinaryパブリック ID（削除・更新用） */
  publicId: string;
  /** 元画像プロンプト（Ideogram使用時） */
  prompt?: string;
}

// ============================================================
// パイプライン
// ============================================================

/** バッチ処理対象記事 */
export interface ArticleImageRequest {
  /** 記事タイトル */
  title: string;
  /** コンテンツカテゴリ */
  category: ContentCategory;
  /** URLスラッグ */
  slug: string;
}
