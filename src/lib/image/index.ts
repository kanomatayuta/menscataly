/**
 * 画像パイプライン モジュール エントリポイント
 * Ideogram API + Cloudinary 画像管理
 */

// ============================================================
// 型定義
// ============================================================
export type {
  ThumbnailRequest,
  ThumbnailResult,
  UploadOptions,
  TransformOptions,
  CloudinaryResult,
  ImageVariant,
  ArticleImages,
  ArticleImageRequest,
  ImageStyle,
  AspectRatio,
} from "./types";

// ============================================================
// Ideogram APIクライアント
// ============================================================
export { IdeogramClient, ideogramClient } from "./ideogram";

// ============================================================
// Cloudinary画像管理クライアント
// ============================================================
export {
  CloudinaryClient,
  cloudinaryClient,
  IMAGE_SIZES,
} from "./cloudinary";
export type { ImageSizeName } from "./cloudinary";

// ============================================================
// 画像パイプライン
// ============================================================
export { ImagePipeline, imagePipeline } from "./pipeline";

// ============================================================
// OGP画像ジェネレーター
// ============================================================
export {
  generateOGImage,
  OG_IMAGE_CONTENT_TYPE,
} from "./og-generator";
