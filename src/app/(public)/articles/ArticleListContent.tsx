import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { getArticles } from "@/lib/microcms/client";
import type { ArticleCategory } from "@/components/ui/Badge";
import { articleToCardData } from "@/lib/utils/article";

const CATEGORY_MAP: Record<string, ArticleCategory> = {
  aga: "aga",
  "hair-removal": "hair-removal",
  skincare: "skincare",
  ed: "ed",
  column: "column",
};

const CATEGORY_PAGE_TITLES: Record<ArticleCategory, string> = {
  aga: "AGA・薄毛",
  "hair-removal": "メンズ脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
  column: "コラム",
};

/** カテゴリのアクセントカラー（アクティブ時の背景・ボーダー） */
const CATEGORY_COLORS: Record<ArticleCategory | "", { bg: string; text: string; border: string; hoverBg: string }> = {
  "": { bg: "#1a365d", text: "#ffffff", border: "#1a365d", hoverBg: "#f0f0f0" },
  aga: { bg: "#2563eb", text: "#ffffff", border: "#2563eb", hoverBg: "#eff6ff" },
  "hair-removal": { bg: "#7c3aed", text: "#ffffff", border: "#7c3aed", hoverBg: "#f5f3ff" },
  skincare: { bg: "#059669", text: "#ffffff", border: "#059669", hoverBg: "#ecfdf5" },
  ed: { bg: "#dc2626", text: "#ffffff", border: "#dc2626", hoverBg: "#fef2f2" },
  column: { bg: "#d97706", text: "#ffffff", border: "#d97706", hoverBg: "#fffbeb" },
};

const ALL_CATEGORIES: { value: ArticleCategory | ""; label: string }[] = [
  { value: "", label: "すべて" },
  { value: "aga", label: "AGA・薄毛" },
  { value: "hair-removal", label: "メンズ脱毛" },
  { value: "skincare", label: "スキンケア" },
  { value: "ed", label: "ED治療" },
  { value: "column", label: "コラム" },
];

const ARTICLES_PER_PAGE = 12;

type Props = {
  searchParams: Promise<{ category?: string; page?: string }>;
};

// このコンポーネントは Suspense 内で searchParams を await する
export async function ArticleListContent({ searchParams }: Props) {
  const params = await searchParams;
  const categoryParam = params.category;
  const pageParam = params.page ? Math.max(1, parseInt(params.page, 10)) : 1;
  const activeCategory = categoryParam
    ? CATEGORY_MAP[categoryParam]
    : undefined;

  const offset = (pageParam - 1) * ARTICLES_PER_PAGE;

  // microCMS API から記事取得（環境変数未設定時はモックデータにフォールバック）
  const result = await getArticles({
    category: activeCategory,
    limit: ARTICLES_PER_PAGE,
    offset,
  });

  const articles = result.contents;
  const totalCount = result.totalCount;
  const totalPages = Math.ceil(totalCount / ARTICLES_PER_PAGE);

  const pageTitle = activeCategory
    ? `${CATEGORY_PAGE_TITLES[activeCategory]}の記事一覧`
    : "記事一覧";

  const basePath = activeCategory
    ? `/articles?category=${activeCategory}&`
    : "/articles?";

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
            const colors = CATEGORY_COLORS[value];

            return (
              <li key={value || "all"}>
                <Link
                  href={href}
                  className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "shadow-sm"
                      : "bg-white hover:shadow-sm"
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `2px solid ${colors.border}`,
                        }
                      : {
                          border: `2px solid ${colors.border}`,
                          color: colors.bg,
                        }
                  }
                  aria-current={isActive ? "page" : undefined}
                >
                  {label}
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
            {totalCount}件の記事
            {totalPages > 1 && (
              <span className="ml-2">
                （{pageParam} / {totalPages} ページ）
              </span>
            )}
          </p>
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

          {/* ページネーション */}
          {totalPages > 1 && (
            <nav
              aria-label="ページネーション"
              className="mt-10 flex items-center justify-center gap-2"
            >
              {/* 前のページ */}
              {pageParam > 1 && (
                <Link
                  href={`${basePath}page=${pageParam - 1}`}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  前へ
                </Link>
              )}

              {/* ページ番号 */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - pageParam) <= 2
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 text-neutral-500"
                    >
                      ...
                    </span>
                  ) : (
                    <Link
                      key={item}
                      href={`${basePath}page=${item}`}
                      aria-current={item === pageParam ? "page" : undefined}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                        item === pageParam
                          ? "text-white"
                          : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                      style={
                        item === pageParam
                          ? {
                              backgroundColor:
                                "var(--color-primary-500, #1a365d)",
                            }
                          : undefined
                      }
                    >
                      {item}
                    </Link>
                  )
                )}

              {/* 次のページ */}
              {pageParam < totalPages && (
                <Link
                  href={`${basePath}page=${pageParam + 1}`}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  次へ
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
              )}
            </nav>
          )}
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
