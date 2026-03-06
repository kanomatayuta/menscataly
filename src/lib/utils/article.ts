import type { MicroCMSArticle } from "@/types/microcms";

/**
 * 日付を日本語フォーマットに変換
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
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
