import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getArticlesByCategory } from "@/lib/mock/articles";
import type { ArticleCategory } from "@/components/ui/Badge";

// TODO: microCMS接続後は src/lib/microcms/ のクライアントに差し替える

const CATEGORY_MAP: Record<string, ArticleCategory> = {
  aga: "aga",
  "hair-removal": "hair-removal",
  skincare: "skincare",
  ed: "ed",
};

const CATEGORY_PAGE_TITLES: Record<ArticleCategory, string> = {
  aga: "AGA治療",
  "hair-removal": "医療脱毛",
  skincare: "メンズスキンケア",
  ed: "ED治療",
};

const ALL_CATEGORIES: { value: ArticleCategory | ""; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "aga", label: "AGA治療" },
  { value: "hair-removal", label: "医療脱毛" },
  { value: "skincare", label: "メンズスキンケア" },
  { value: "ed", label: "ED治療" },
];

type Props = {
  searchParams: Promise<{ category?: string }>;
};

// このコンポーネントは Suspense 内で searchParams を await する
export async function ArticleListContent({ searchParams }: Props) {
  const params = await searchParams;
  const categoryParam = params.category;
  const activeCategory = categoryParam
    ? CATEGORY_MAP[categoryParam]
    : undefined;

  const articles = getArticlesByCategory(activeCategory);

  const pageTitle = activeCategory
    ? `${CATEGORY_PAGE_TITLES[activeCategory]}の記事一覧`
    : "記事一覧";

  return (
    <>
      {/* ページヘッダー */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          {pageTitle}
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          専門医監修のもと、信頼性の高い情報をお届けします。
        </p>
      </header>

      {/* カテゴリフィルター */}
      <nav aria-label="カテゴリフィルター" className="mb-8">
        <ul className="flex flex-wrap gap-2" role="list">
          {ALL_CATEGORIES.map(({ value, label }) => {
            const isActive =
              (!value && !activeCategory) || value === activeCategory;
            const href = value ? `/articles?category=${value}` : "/articles";

            return (
              <li key={value || "all"}>
                <Link
                  href={href}
                  className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-white"
                      : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor:
                            "var(--color-primary-500, #1a365d)",
                        }
                      : undefined
                  }
                  aria-current={isActive ? "page" : undefined}
                >
                  {value ? (
                    <Badge
                      category={value as ArticleCategory}
                      className={`p-0 text-sm ${isActive ? "bg-transparent text-white" : ""}`}
                    />
                  ) : (
                    label
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 記事グリッド */}
      {articles.length > 0 ? (
        <>
          <p className="mb-4 text-sm text-neutral-500">
            {articles.length}件の記事
          </p>
          <ul
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
          >
            {articles.map((article) => (
              <li key={article.slug}>
                <Card article={article} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="py-16 text-center">
          <p className="text-neutral-500">
            このカテゴリの記事はまだありません。
          </p>
        </div>
      )}
    </>
  );
}
