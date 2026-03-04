import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { getArticles } from "@/lib/microcms/client";
import type { MicroCMSArticle } from "@/types/microcms";
import type { ArticleCategory } from "@/components/ui/Badge";

interface RelatedArticlesProps {
  /** 現在の記事のスラッグ（除外用） */
  currentSlug: string;
  /** カテゴリスラッグ */
  category: string;
  /** 表示件数 (デフォルト: 4) */
  limit?: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getImageUrl(article: MicroCMSArticle): string | null {
  return article.thumbnail_url || article.thumbnail?.url || null;
}

export async function RelatedArticles({
  currentSlug,
  category,
  limit = 4,
}: RelatedArticlesProps) {
  // 同カテゴリの記事を取得（現在の記事を除外するため +1 件取得）
  const result = await getArticles({
    category,
    limit: limit + 1,
    orders: "-publishedAt",
  });

  // 現在の記事を除外
  const related = result.contents
    .filter((a) => (a.slug ?? a.id) !== currentSlug)
    .slice(0, limit);

  if (related.length === 0) return null;

  return (
    <section className="mt-10 border-t border-neutral-200 pt-8" aria-label="関連記事">
      <h2 className="mb-6 text-xl font-bold text-neutral-900">関連記事</h2>
      <ul
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        role="list"
      >
        {related.map((article) => {
          const slug = article.slug ?? article.id;
          const imageUrl = getImageUrl(article);
          const articleCategory = (article.category?.slug ?? "aga") as ArticleCategory;

          return (
            <li key={article.id}>
              <Link
                href={`/articles/${slug}`}
                className="group flex gap-3 rounded-lg border border-neutral-200 bg-white p-3 transition-shadow hover:shadow-md"
              >
                {/* サムネイル */}
                <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded bg-neutral-100">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={article.title}
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center" aria-hidden="true">
                      <svg
                        className="h-8 w-8 text-neutral-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* テキスト */}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="mb-1">
                      <Badge category={articleCategory} />
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-900 group-hover:text-primary-600">
                      {article.title}
                    </h3>
                  </div>
                  <time
                    dateTime={article.publishedAt}
                    className="text-xs text-neutral-500"
                  >
                    {formatDate(article.publishedAt)}
                  </time>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* カテゴリ全記事へのリンク */}
      <div className="mt-4 text-center">
        <Link
          href={`/articles?category=${category}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          このカテゴリの記事をもっと見る
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </section>
  );
}
