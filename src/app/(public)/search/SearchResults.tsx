import { Card } from "@/components/ui/Card";
import { getArticles } from "@/lib/microcms/client";
import type { MicroCMSArticle } from "@/types/microcms";
import type { ArticleCategory } from "@/components/ui/Badge";
import Link from "next/link";

/**
 * MicroCMSArticle を Card コンポーネント用データに変換
 * (ArticleListContent.tsx と同一のロジック)
 */
function articleToCardData(article: MicroCMSArticle) {
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

const SEARCH_SUGGESTIONS = [
  { label: "AGA治療", query: "AGA" },
  { label: "医療脱毛", query: "脱毛" },
  { label: "スキンケア", query: "スキンケア" },
  { label: "ED治療", query: "ED" },
  { label: "クリニック", query: "クリニック" },
  { label: "費用", query: "費用" },
] as const;

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export async function SearchResults({ searchParams }: Props) {
  const params = await searchParams;
  const keyword = params.q?.trim() ?? "";

  if (!keyword) {
    return (
      <div className="py-16 text-center">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-neutral-200"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <p className="text-lg font-medium text-neutral-700">
          検索キーワードを入力してください
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          AGA治療・医療脱毛・スキンケア・ED治療など
        </p>

        {/* Quick search suggestions */}
        <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
          {SEARCH_SUGGESTIONS.map((s) => (
            <Link
              key={s.query}
              href={`/search?q=${encodeURIComponent(s.query)}`}
              className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const result = await getArticles({ q: keyword, limit: 20 });
  const articles = result.contents;
  const totalCount = result.totalCount;

  return (
    <>
      {/* 検索結果ヘッダー */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          「{keyword}」の検索結果
        </h1>
        {articles.length > 0 && (
          <p className="mt-2 text-sm text-neutral-600">
            {totalCount}件の記事が見つかりました
          </p>
        )}
      </header>

      {/* 検索結果 */}
      {articles.length > 0 ? (
        <ul
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {articles.map((article) => (
            <li key={article.id}>
              <Card article={articleToCardData(article)} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16 text-center">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-neutral-200"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <p className="text-lg font-medium text-neutral-700">
            「{keyword}」に一致する記事が見つかりませんでした
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            キーワードを変更するか、以下のカテゴリから探してみてください。
          </p>

          {/* Alternative suggestions */}
          <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
            {SEARCH_SUGGESTIONS.map((s) => (
              <Link
                key={s.query}
                href={`/search?q=${encodeURIComponent(s.query)}`}
                className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-4 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              >
                {s.label}
              </Link>
            ))}
          </div>

          {/* Link to browse all articles */}
          <div className="mt-8">
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
            >
              全記事一覧を見る
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
