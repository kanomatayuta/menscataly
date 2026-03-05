import { Suspense } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { getArticles } from "@/lib/microcms/client";
import type { ArticleReviewItem, ArticleAnalytics } from "@/types/admin";
import type { ContentCategory } from "@/types/content";

// ------------------------------------------------------------------
// Data fetching (microCMS から記事取得)
// ------------------------------------------------------------------

interface ArticlesResponse {
  articles: ArticleReviewItem[];
  total: number;
}

async function fetchArticlesData(): Promise<ArticlesResponse> {
  // PPR対応: プリレンダリング時は空データを返す
  try {
    await connection();
  } catch {
    return { articles: [], total: 0 };
  }

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
// Analytics fetching (Supabase からPV・クリック・CV・収益)
// ------------------------------------------------------------------

async function fetchAnalyticsData(): Promise<Map<string, ArticleAnalytics>> {
  const map = new Map<string, ArticleAnalytics>();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return map;

  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createServerSupabaseClient();

    const ensure = (articleId: string): ArticleAnalytics => {
      let entry = map.get(articleId);
      if (!entry) {
        entry = { articleId, pageviews: 0, clicks: 0, conversions: 0, revenue: 0 };
        map.set(articleId, entry);
      }
      return entry;
    };

    // affiliate_links 集計
    const { data: affData } = await (supabase as any)
      .from("affiliate_links")
      .select("article_id, click_count, conversion_count, revenue");

    if (affData) {
      for (const row of affData) {
        if (!row.article_id) continue;
        const entry = ensure(row.article_id);
        entry.clicks += row.click_count ?? 0;
        entry.conversions += row.conversion_count ?? 0;
        entry.revenue += row.revenue ?? 0;
      }
    }

    // analytics_daily 30日間PV集計
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const since = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: dailyData } = await (supabase as any)
      .from("analytics_daily")
      .select("article_id, pageviews")
      .gte("date", since);

    if (dailyData) {
      for (const row of dailyData) {
        if (!row.article_id) continue;
        const entry = ensure(row.article_id);
        entry.pageviews += row.pageviews ?? 0;
      }
    }
  } catch (err) {
    console.error("[admin/articles] Analytics fetch error:", err);
  }

  return map;
}

// ------------------------------------------------------------------
// Async content component (wrapped in Suspense)
// ------------------------------------------------------------------

async function ArticlesContent() {
  const [{ articles, total }, analytics] = await Promise.all([
    fetchArticlesData(),
    fetchAnalyticsData(),
  ]);

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">{total} 記事</p>
      </div>

      <ArticleTable articles={articles} analytics={analytics} />
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
