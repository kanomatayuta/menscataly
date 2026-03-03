/**
 * Ideogram APIクライアント
 * AI画像生成（サムネイル自動生成）
 * https://ideogram.ai/
 */

import type { ContentCategory } from "@/types/content";
import type {
  ThumbnailRequest,
  ThumbnailResult,
  AspectRatio,
} from "./types";

// ============================================================
// Ideogram API 型定義（内部用）
// ============================================================

interface IdeogramGenerateRequest {
  image_request: {
    prompt: string;
    aspect_ratio: string;
    model: string;
    magic_prompt_option: string;
    style_type?: string;
  };
}

interface IdeogramImage {
  url: string;
  prompt: string;
  resolution: string;
  is_image_safe: boolean;
  seed: number;
}

interface IdeogramGenerateResponse {
  created: string;
  data: IdeogramImage[];
}

// ============================================================
// カテゴリ別スタイル設定
// ============================================================

/** カテゴリ別プロンプト設定 */
const CATEGORY_STYLE_CONFIG: Record<
  ContentCategory,
  {
    subject: string;
    style: string;
    mood: string;
    colors: string;
  }
> = {
  aga: {
    subject: "clean professional Japanese man in his 30s, medical clinic setting, hair treatment consultation",
    style: "medical photography, clinic interior, white and light blue tones",
    mood: "trustworthy, professional, hopeful",
    colors: "white, light blue, clean minimal palette",
  },
  "hair-removal": {
    subject: "smooth skin texture close-up, professional beauty treatment, laser aesthetic device",
    style: "beauty photography, spa clinic, soft natural lighting",
    mood: "clean, smooth, relaxing, professional",
    colors: "soft beige, white, pastel tones",
  },
  skincare: {
    subject: "premium skincare cosmetic products arranged elegantly, clean skin texture, serum bottle",
    style: "product photography, minimalist flat lay, studio lighting",
    mood: "luxurious, clean, fresh, effective",
    colors: "white, gold accents, light neutral tones",
  },
  ed: {
    subject: "abstract minimal geometric shapes, privacy-respecting health concept, calm lifestyle",
    style: "abstract graphic design, geometric, modern minimal",
    mood: "discreet, professional, calm, trustworthy",
    colors: "navy blue, grey, subtle gradient",
  },
};

/** アスペクト比マッピング（Ideogram API形式） */
const ASPECT_RATIO_MAP: Record<AspectRatio, string> = {
  "16:9": "ASPECT_16_9",
  "1:1": "ASPECT_1_1",
  "4:3": "ASPECT_4_3",
  "3:2": "ASPECT_3_2",
};

/** アスペクト比別解像度 */
const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "3:2": { width: 1200, height: 800 },
};

// ============================================================
// IdeogramClient
// ============================================================

export class IdeogramClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl = "https://api.ideogram.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.IDEOGRAM_API_KEY;
  }

  /**
   * 記事タイトル・カテゴリからサムネイルを生成する
   * APIキー未設定の場合はプレースホルダー画像URLを返す
   */
  async generateThumbnail(params: ThumbnailRequest): Promise<ThumbnailResult> {
    const aspectRatio = params.aspectRatio ?? "16:9";
    const dimensions = ASPECT_RATIO_DIMENSIONS[aspectRatio];
    const prompt = this.generatePrompt(params.title, params.category);

    // APIキー未設定時はプレースホルダー画像を返す
    if (!this.apiKey) {
      return {
        url: this.getPlaceholderUrl(dimensions.width, dimensions.height, params.category),
        width: dimensions.width,
        height: dimensions.height,
        prompt,
        isPlaceholder: true,
      };
    }

    try {
      const requestBody: IdeogramGenerateRequest = {
        image_request: {
          prompt,
          aspect_ratio: ASPECT_RATIO_MAP[aspectRatio],
          model: "V_2",
          magic_prompt_option: "AUTO",
          style_type: "REALISTIC",
        },
      };

      const response = await fetch(`${this.baseUrl}/generate`, {
        method: "POST",
        headers: {
          "Api-Key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Ideogram API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = (await response.json()) as IdeogramGenerateResponse;

      if (!data.data || data.data.length === 0) {
        throw new Error("Ideogram API returned no images");
      }

      const image = data.data[0];

      return {
        url: image.url,
        width: dimensions.width,
        height: dimensions.height,
        prompt: image.prompt || prompt,
        isPlaceholder: false,
      };
    } catch (error) {
      console.error("[IdeogramClient] generateThumbnail failed:", error);
      // エラー時もプレースホルダーにフォールバック
      return {
        url: this.getPlaceholderUrl(dimensions.width, dimensions.height, params.category),
        width: dimensions.width,
        height: dimensions.height,
        prompt,
        isPlaceholder: true,
      };
    }
  }

  /**
   * カテゴリ別の画像生成プロンプトを生成する
   */
  generatePrompt(title: string, category: ContentCategory): string {
    const config = CATEGORY_STYLE_CONFIG[category];

    // タイトルから主要キーワードを抽出（最大50文字）
    const truncatedTitle = title.slice(0, 50);

    const prompt = [
      `Professional thumbnail image for Japanese men's health and beauty article: "${truncatedTitle}".`,
      `Subject: ${config.subject}.`,
      `Visual style: ${config.style}.`,
      `Mood: ${config.mood}.`,
      `Color palette: ${config.colors}.`,
      "High quality, photorealistic, clean composition, suitable for medical and beauty media.",
      "No text, no watermarks, safe for all audiences.",
    ].join(" ");

    return prompt;
  }

  /**
   * プレースホルダー画像URLを生成する
   * via.placeholder.com を使用
   */
  private getPlaceholderUrl(
    width: number,
    height: number,
    category: ContentCategory
  ): string {
    const colorMap: Record<ContentCategory, { bg: string; text: string }> = {
      aga: { bg: "1a365d", text: "ffffff" },
      "hair-removal": { bg: "c8a951", text: "ffffff" },
      skincare: { bg: "4a7c59", text: "ffffff" },
      ed: { bg: "2d3748", text: "c8a951" },
    };

    const colors = colorMap[category];
    const label = encodeURIComponent(`MENS+CATALY+${category.toUpperCase()}`);
    return `https://via.placeholder.com/${width}x${height}/${colors.bg}/${colors.text}?text=${label}`;
  }
}

/** デフォルトクライアントインスタンス */
export const ideogramClient = new IdeogramClient();
