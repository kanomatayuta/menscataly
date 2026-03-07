import type { MicroCMSArticle } from "@/types/microcms";
import type { ArticleCategory } from "@/components/ui/Badge";

/**
 * 日付を日本語フォーマットに変換
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * サムネイルURL取得
 * 優先順位: thumbnail (microCMS手動設定) → thumbnail_url (Cloudinary自動生成) → null
 */
export function getImageUrl(article: MicroCMSArticle): string | null {
  // 1. microCMS管理画面から手動設定された画像を最優先
  if (article.thumbnail?.url) {
    return article.thumbnail.url;
  }
  // 2. Cloudinary等の外部URL (プレースホルダーは除外)
  const extUrl = article.thumbnail_url || null;
  if (!extUrl) return null;
  if (extUrl.includes("via.placeholder.com")) return null;
  if (
    extUrl.includes("res.cloudinary.com") &&
    extUrl.includes("/upload/")
  ) {
    return extUrl.replace("/upload/", "/upload/f_auto,q_auto,w_1200/");
  }
  return extUrl;
}

/**
 * MicroCMSArticle を Card コンポーネント用データに変換
 */
export function articleToCardData(article: MicroCMSArticle) {
  const category = (article.category?.slug ?? "aga") as ArticleCategory;
  return {
    slug: article.slug ?? article.id,
    title: article.title,
    excerpt: article.excerpt ?? "",
    category,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    eyecatch: (() => {
      const url =
        article.thumbnail?.url ||
        (article.thumbnail_url &&
        !article.thumbnail_url.includes("via.placeholder.com")
          ? article.thumbnail_url
          : null);
      if (!url) return undefined;
      return {
        url,
        width: article.thumbnail?.width ?? 1200,
        height: article.thumbnail?.height ?? 630,
      };
    })(),
  };
}

/**
 * HTMLコンテンツ内にアフィリエイトリンクが含まれるか判定
 */
export function hasAffiliateLinks(content: string | undefined): boolean {
  if (!content) return false;
  return content.includes('rel="sponsored"') || content.includes("data-asp");
}

/**
 * 読了時間を推定（日本語テキスト基準: 約500文字/分）
 * microCMS の reading_time フィールドがある場合はそちらを優先
 */
export function estimateReadingTime(article: MicroCMSArticle): number {
  if (article.reading_time && article.reading_time > 0) {
    return article.reading_time;
  }
  // HTMLタグを除去してテキスト文字数をカウント
  const text = (article.content ?? "").replace(/<[^>]*>/g, "");
  const charCount = text.length;
  // 日本語: 約500文字/分
  return Math.max(1, Math.ceil(charCount / 500));
}
