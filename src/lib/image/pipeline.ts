/**
 * 画像処理パイプライン
 * Ideogram画像生成 → Cloudinaryアップロード → 複数サイズURL生成
 */

import { IdeogramClient } from "./ideogram";
import { CloudinaryClient, IMAGE_SIZES } from "./cloudinary";
import type {
  ArticleImages,
  ArticleImageRequest,
  ThumbnailRequest,
} from "./types";

// ============================================================
// ImagePipeline
// ============================================================

export class ImagePipeline {
  private readonly ideogram: IdeogramClient;
  private readonly cloudinary: CloudinaryClient;

  constructor(
    ideogram?: IdeogramClient,
    cloudinary?: CloudinaryClient
  ) {
    this.ideogram = ideogram ?? new IdeogramClient();
    this.cloudinary = cloudinary ?? new CloudinaryClient();
  }

  /**
   * 単一記事の画像を処理する
   * 1. Ideogramでサムネイル画像を生成
   * 2. 生成画像をCloudinaryにアップロード
   * 3. thumbnail / card / og の3サイズURLを返す
   *
   * 環境変数未設定時は全てプレースホルダー画像で動作する
   */
  async processArticleImage(article: ArticleImageRequest): Promise<ArticleImages> {
    const thumbnailRequest: ThumbnailRequest = {
      title: article.title,
      category: article.category,
      aspectRatio: "16:9",
    };

    // Step 1: Ideogramでサムネイル生成
    const thumbnailResult = await this.ideogram.generateThumbnail(thumbnailRequest);

    // Step 2: Cloudinaryにアップロード
    // プレースホルダーの場合はURL経由でアップロードを試みる
    let cloudinaryResult;
    const publicId = `menscataly/${article.category}/${article.slug}`;

    if (thumbnailResult.isPlaceholder) {
      // プレースホルダー時はCloudinaryもダミー結果を返す
      cloudinaryResult = await this.cloudinary.upload(Buffer.alloc(0), {
        folder: `menscataly/${article.category}`,
        publicId: article.slug,
      });
    } else {
      // 実際の画像URLから画像データを取得してアップロード
      try {
        const imageResponse = await fetch(thumbnailResult.url);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        cloudinaryResult = await this.cloudinary.upload(imageBuffer, {
          folder: `menscataly/${article.category}`,
          publicId: article.slug,
        });
      } catch (error) {
        console.error("[ImagePipeline] Failed to fetch and upload image:", error);
        // フォールバック: ダミー結果
        cloudinaryResult = await this.cloudinary.upload(Buffer.alloc(0), {
          folder: `menscataly/${article.category}`,
          publicId: article.slug,
        });
      }
    }

    // Step 3: 3サイズのURLを生成して返す
    if (cloudinaryResult.isPlaceholder) {
      return this.buildPlaceholderImages(publicId, article.category, thumbnailResult.prompt);
    }

    return {
      thumbnail: {
        url: this.cloudinary.getUrlForSize(cloudinaryResult.publicId, "thumbnail"),
        width: IMAGE_SIZES.thumbnail.width,
        height: IMAGE_SIZES.thumbnail.height,
      },
      card: {
        url: this.cloudinary.getUrlForSize(cloudinaryResult.publicId, "card"),
        width: IMAGE_SIZES.card.width,
        height: IMAGE_SIZES.card.height,
      },
      og: {
        url: this.cloudinary.getUrlForSize(cloudinaryResult.publicId, "og"),
        width: IMAGE_SIZES.og.width,
        height: IMAGE_SIZES.og.height,
      },
      publicId: cloudinaryResult.publicId,
      prompt: thumbnailResult.prompt,
    };
  }

  /**
   * 複数記事の画像を並列生成する
   * 並列数上限: concurrency（デフォルト3）
   */
  async processBatch(
    articles: ArticleImageRequest[],
    options: { concurrency?: number } = {}
  ): Promise<ArticleImages[]> {
    const concurrency = options.concurrency ?? 3;
    const results: ArticleImages[] = [];

    // concurrency単位でチャンク分割して並列処理
    for (let i = 0; i < articles.length; i += concurrency) {
      const chunk = articles.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map((article) => this.processArticleImage(article))
      );
      results.push(...chunkResults);
    }

    return results;
  }

  // ============================================================
  // 内部ユーティリティ
  // ============================================================

  /** プレースホルダー画像セットを生成する */
  private buildPlaceholderImages(
    publicId: string,
    category: string,
    prompt?: string
  ): ArticleImages {
    const makeUrl = (width: number, height: number) =>
      `https://via.placeholder.com/${width}x${height}/1a365d/ffffff?text=MENS+CATALY+${encodeURIComponent(category.toUpperCase())}`;

    return {
      thumbnail: {
        url: makeUrl(IMAGE_SIZES.thumbnail.width, IMAGE_SIZES.thumbnail.height),
        width: IMAGE_SIZES.thumbnail.width,
        height: IMAGE_SIZES.thumbnail.height,
      },
      card: {
        url: makeUrl(IMAGE_SIZES.card.width, IMAGE_SIZES.card.height),
        width: IMAGE_SIZES.card.width,
        height: IMAGE_SIZES.card.height,
      },
      og: {
        url: makeUrl(IMAGE_SIZES.og.width, IMAGE_SIZES.og.height),
        width: IMAGE_SIZES.og.width,
        height: IMAGE_SIZES.og.height,
      },
      publicId,
      prompt,
    };
  }
}

/** デフォルトパイプラインインスタンス */
export const imagePipeline = new ImagePipeline();
