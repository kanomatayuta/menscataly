/**
 * Cloudinary画像管理クライアント
 * 画像アップロード・最適化・CDN URL生成
 * https://cloudinary.com/
 */

import { v2 as cloudinaryV2 } from "cloudinary";
import type {
  UploadOptions,
  TransformOptions,
  CloudinaryResult,
} from "./types";

// ============================================================
// Cloudinary設定
// ============================================================

/**
 * Cloudinaryを環境変数から設定する
 * 環境変数未設定時はダミーモードで動作
 */
function configureCloudinary(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }

  cloudinaryV2.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return true;
}

// ============================================================
// 定数
// ============================================================

/** レスポンシブ画像サイズ定義 */
export const IMAGE_SIZES = {
  thumbnail: { width: 400, height: 225 },
  card: { width: 800, height: 450 },
  og: { width: 1200, height: 630 },
} as const;

export type ImageSizeName = keyof typeof IMAGE_SIZES;

// ============================================================
// CloudinaryClient
// ============================================================

export class CloudinaryClient {
  private readonly isConfigured: boolean;
  private readonly cloudName: string | undefined;

  constructor() {
    this.isConfigured = configureCloudinary();
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  }

  /**
   * 画像バッファをCloudinaryにアップロードする
   * 自動WebP変換・品質自動最適化・レスポンシブサイズ生成を行う
   * 環境変数未設定時はダミー結果を返す
   */
  async upload(
    imageBuffer: Buffer,
    options: UploadOptions = {}
  ): Promise<CloudinaryResult> {
    if (!this.isConfigured) {
      return this.getDummyUploadResult(options);
    }

    try {
      // Base64エンコードしてData URIとして渡す
      const base64Data = imageBuffer.toString("base64");
      const dataUri = `data:image/jpeg;base64,${base64Data}`;

      const uploadOptions: Record<string, unknown> = {
        folder: options.folder ?? "menscataly/articles",
        resource_type: "image",
        // 自動WebP変換・品質最適化
        format: "webp",
        quality: "auto",
        // レスポンシブ対応（eager変換）
        eager: [
          {
            width: IMAGE_SIZES.thumbnail.width,
            height: IMAGE_SIZES.thumbnail.height,
            crop: "fill",
            gravity: "center",
            format: "webp",
            quality: "auto",
          },
          {
            width: IMAGE_SIZES.card.width,
            height: IMAGE_SIZES.card.height,
            crop: "fill",
            gravity: "center",
            format: "webp",
            quality: "auto",
          },
          {
            width: IMAGE_SIZES.og.width,
            height: IMAGE_SIZES.og.height,
            crop: "fill",
            gravity: "center",
            format: "webp",
            quality: "auto",
          },
        ],
        eager_async: false,
      };

      if (options.publicId) {
        uploadOptions.public_id = options.publicId;
      }

      const result = await cloudinaryV2.uploader.upload(dataUri, uploadOptions);

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        isPlaceholder: false,
      };
    } catch (error) {
      console.error("[CloudinaryClient] upload failed:", error);
      return this.getDummyUploadResult(options);
    }
  }

  /**
   * CDN最適化URLを生成する
   */
  getOptimizedUrl(publicId: string, transform: TransformOptions = {}): string {
    if (!this.isConfigured || !this.cloudName) {
      return this.getDummyUrl(
        transform.width ?? 800,
        transform.height ?? 450
      );
    }

    const transformations: string[] = [];

    if (transform.width) transformations.push(`w_${transform.width}`);
    if (transform.height) transformations.push(`h_${transform.height}`);
    if (transform.crop) transformations.push(`c_${transform.crop}`);
    else if (transform.width && transform.height) transformations.push("c_fill");
    if (transform.quality) transformations.push(`q_${transform.quality}`);
    else transformations.push("q_auto");

    const format = transform.format ?? "webp";
    transformations.push(`f_${format}`);

    const transformStr = transformations.join(",");
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformStr}/${publicId}`;
  }

  /**
   * Cloudinaryから画像を削除する
   */
  async delete(publicId: string): Promise<void> {
    if (!this.isConfigured) {
      console.warn("[CloudinaryClient] delete skipped: Cloudinary not configured");
      return;
    }

    try {
      await cloudinaryV2.uploader.destroy(publicId);
    } catch (error) {
      console.error(`[CloudinaryClient] delete failed for publicId=${publicId}:`, error);
      throw error;
    }
  }

  /**
   * 指定サイズのCDN URLを生成する（publicIdから）
   */
  getUrlForSize(publicId: string, sizeName: ImageSizeName): string {
    const size = IMAGE_SIZES[sizeName];
    return this.getOptimizedUrl(publicId, {
      width: size.width,
      height: size.height,
      crop: "fill",
      quality: "auto",
      format: "webp",
    });
  }

  // ============================================================
  // ダミー/プレースホルダー生成
  // ============================================================

  private getDummyUploadResult(options: UploadOptions): CloudinaryResult {
    const publicId = options.publicId ?? `menscataly/placeholder/${Date.now()}`;
    return {
      publicId,
      secureUrl: this.getDummyUrl(1280, 720),
      width: 1280,
      height: 720,
      format: "webp",
      bytes: 0,
      isPlaceholder: true,
    };
  }

  private getDummyUrl(width: number, height: number): string {
    return `https://via.placeholder.com/${width}x${height}/1a365d/ffffff?text=MENS+CATALY`;
  }
}

/** デフォルトクライアントインスタンス */
export const cloudinaryClient = new CloudinaryClient();
