import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { getArticles } from "@/lib/microcms/client";
import type { ArticleReviewItem } from "@/types/admin";
import type { ContentCategory } from "@/types/content";

// ------------------------------------------------------------------
// Data fetching (microCMS から記事取得)
// ------------------------------------------------------------------

interface ArticlesResponse {
  articles: ArticleReviewItem[];
  total: number;
}

async function fetchArticlesData(): Promise<ArticlesResponse> {
  try {
    const response = await getArticles({ limit: 50, orders: "-publishedAt" });

    const articles: ArticleReviewItem[] = response.contents.map((item) => ({
      id: item.id,
      contentId: item.id,
      title: item.title,
      slug: item.slug ?? item.id,
      category: (item.category?.slug ?? "column") as ContentCategory,
      complianceScore: 0,
      status: "published" as const,
      generatedAt: item.publishedAt ?? item.createdAt,
      reviewedAt: null,
      reviewedBy: null,
    }));

    return { articles, total: response.totalCount };
  } catch (err) {
    console.error("[admin/articles] Error fetching from microCMS:", err);
    return { articles: [], total: 0 };
  }
}

// ------------------------------------------------------------------
// Async content component (wrapped in Suspense)
// ------------------------------------------------------------------

async function ArticlesContent() {
  const { articles, total } = await fetchArticlesData();

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">{total} 記事</p>
      </div>

      <ArticleTable articles={articles} />
    </>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminArticlesPage() {
  return (
    <>
      <AdminHeader title="記事一覧" breadcrumbs={[{ label: "記事一覧" }]} />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">
              記事を読み込み中...
            </span>
          </div>
        }
      >
        <ArticlesContent />
      </Suspense>
    </>
  );
}
