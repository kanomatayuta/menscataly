import { Card } from "@/components/ui/Card";
import { getArticles } from "@/lib/microcms/client";
import type { MicroCMSArticle } from "@/types/microcms";
import type { ArticleCategory } from "@/components/ui/Badge";

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
      const url = article.thumbnail?.url || (article.thumbnail_url && !article.thumbnail_url.includes('via.placeholder.com') ? article.thumbnail_url : null);
      if (!url) return undefined;
      return { url, width: article.thumbnail?.width ?? 1200, height: article.thumbnail?.height ?? 630 };
    })(),
  };
}

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export async function SearchResults({ searchParams }: Props) {
  const params = await searchParams;
  const keyword = params.q?.trim() ?? "";

  if (!keyword) {
    return (
      <div className="py-16 text-center">
        <p className="text-neutral-500">
          検索キーワードを入力してください。
        </p>
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
            {totalCount}件の検索結果
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
            className="mx-auto mb-4 h-12 w-12 text-neutral-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <p className="text-neutral-500">
            検索結果がありません
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            別のキーワードで検索してみてください。
          </p>
        </div>
      )}
    </>
  );
}
