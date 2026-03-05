import { Suspense } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ArticleTable } from "@/components/admin/ArticleTable";
import type { ArticleReviewItem } from "@/types/admin";

// ------------------------------------------------------------------
// モックデータ (Supabase 未設定時フォールバック)
// ------------------------------------------------------------------

function getMockArticles(): ArticleReviewItem[] {
  return [
    {
      id: "review-1",
      contentId: "article-1",
      title: "AGA治療の費用相場と選び方ガイド",
      slug: "aga-treatment-cost-guide",
      category: "aga",
      complianceScore: 96.5,
      status: "pending",
      generatedAt: "2026-03-01T00:00:00.000Z",
      reviewedAt: null,
      reviewedBy: null,
    },
    {
      id: "review-2",
      contentId: "article-2",
      title: "メンズ医療脱毛おすすめクリニック比較",
      slug: "mens-hair-removal-comparison",
      category: "hair-removal",
      complianceScore: 98.0,
      status: "approved",
      generatedAt: "2026-02-28T00:00:00.000Z",
      reviewedAt: "2026-03-01T00:00:00.000Z",
      reviewedBy: "admin",
    },
  ];
}

// ------------------------------------------------------------------
// Data fetching (直接 Supabase クエリ)
// ------------------------------------------------------------------

interface ArticlesResponse {
  articles: ArticleReviewItem[];
  total: number;
}

async function fetchArticlesData(): Promise<ArticlesResponse> {
  await connection();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const articles = getMockArticles();
    return { articles, total: articles.length };
  }

  try {
    const { createServerSupabaseClient } = await import(
      "@/lib/supabase/client"
    );
    const supabase = createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error, count } = await (supabase as any)
      .from("article_review_queue")
      .select("*", { count: "exact" })
      .order("generated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[admin/articles] Query error:", error.message);
      return { articles: [], total: 0 };
    }

    const articles: ArticleReviewItem[] = (data ?? []).map(
      (row: Record<string, unknown>) => ({
        id: row.id,
        contentId: row.article_id ?? row.id,
        title: row.title,
        slug: row.slug,
        category: row.category,
        complianceScore: parseFloat(String(row.compliance_score ?? "0")),
        status: row.status,
        generatedAt: row.generated_at,
        reviewedAt: row.reviewed_at ?? null,
        reviewedBy: row.reviewed_by ?? null,
      }),
    );

    return { articles, total: count ?? 0 };
  } catch (err) {
    console.error("[admin/articles] Error:", err);
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
        <p className="text-sm text-neutral-500">{total} articles total</p>
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
      <AdminHeader title="Articles" breadcrumbs={[{ label: "Articles" }]} />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">
              Loading articles...
            </span>
          </div>
        }
      >
        <ArticlesContent />
      </Suspense>
    </>
  );
}
