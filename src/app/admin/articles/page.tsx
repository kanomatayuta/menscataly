import { Suspense } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AnalyticsSummaryCards } from "@/components/admin/AnalyticsSummaryCards";
import { TrendChart } from "@/components/admin/TrendChart";
import { ArticleRanking } from "@/components/admin/ArticleRanking";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { getArticles } from "@/lib/microcms/client";
import type { ArticleReviewItem, ArticleAnalytics, TrendDataPoint, RankingData, RankingItem } from "@/types/admin";
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
    await connection();
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
// Trend data fetching (日別集計)
// ------------------------------------------------------------------

async function fetchTrendData(days: number): Promise<TrendDataPoint[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return [];

  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createServerSupabaseClient();

    await connection();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];

    const { data } = await (supabase as any)
      .from("analytics_daily")
      .select("date, pageviews, ctr, conversions")
      .gte("date", sinceStr)
      .order("date", { ascending: true });

    if (!data) return [];

    // Group by date
    const byDate = new Map<string, TrendDataPoint>();
    for (const row of data) {
      const d = row.date as string;
      let point = byDate.get(d);
      if (!point) {
        const dateObj = new Date(d);
        point = {
          date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
          pageviews: 0,
          clicks: 0,
          conversions: 0,
        };
        byDate.set(d, point);
      }
      point.pageviews += row.pageviews ?? 0;
      point.clicks += Math.round((row.ctr ?? 0) * (row.pageviews ?? 0));
      point.conversions += row.conversions ?? 0;
    }

    return [...byDate.values()];
  } catch (err) {
    console.error("[admin/articles] Trend fetch error:", err);
    return [];
  }
}

// ------------------------------------------------------------------
// Ranking data (from analytics map + articles)
// ------------------------------------------------------------------

function buildRankingData(
  articles: ArticleReviewItem[],
  analytics: Map<string, ArticleAnalytics>,
): RankingData {
  const makeItems = (
    sorted: { article: ArticleReviewItem; stats: ArticleAnalytics }[],
    formatter: (v: number) => string,
    getValue: (s: ArticleAnalytics) => number,
  ): RankingItem[] =>
    sorted.slice(0, 10).map((item, i) => ({
      rank: i + 1,
      articleId: item.article.id,
      title: item.article.title,
      slug: item.article.slug,
      value: getValue(item.stats),
      formattedValue: formatter(getValue(item.stats)),
    }));

  const withStats = articles
    .map((a) => ({ article: a, stats: analytics.get(a.id) }))
    .filter((x): x is { article: ArticleReviewItem; stats: ArticleAnalytics } => !!x.stats);

  const byPV = [...withStats].sort((a, b) => b.stats.pageviews - a.stats.pageviews);
  const byCTR = [...withStats]
    .filter((x) => x.stats.pageviews > 0)
    .sort((a, b) => {
      const ctrA = a.stats.clicks / a.stats.pageviews;
      const ctrB = b.stats.clicks / b.stats.pageviews;
      return ctrB - ctrA;
    });
  const byRevenue = [...withStats].sort((a, b) => b.stats.revenue - a.stats.revenue);

  return {
    pageviews: makeItems(byPV, (v) => v.toLocaleString("ja-JP"), (s) => s.pageviews),
    ctr: makeItems(
      byCTR,
      (v) => `${(v * 100).toFixed(1)}%`,
      (s) => s.clicks / s.pageviews,
    ),
    revenue: makeItems(byRevenue, (v) => `¥${v.toLocaleString("ja-JP")}`, (s) => s.revenue),
  };
}

// ------------------------------------------------------------------
// Skeleton components
// ------------------------------------------------------------------

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-200" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[380px] animate-pulse rounded-lg bg-neutral-200" />;
}

function RankingSkeleton() {
  return <div className="h-[380px] animate-pulse rounded-lg bg-neutral-200" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-neutral-200" />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Async Section Components (each independently streamable via Suspense)
// ------------------------------------------------------------------

async function ArticlesSummarySection() {
  const analytics = await fetchAnalyticsData();
  const values = [...analytics.values()];
  const totalPageviews = values.reduce((s, a) => s + a.pageviews, 0);
  const totalClicks = values.reduce((s, a) => s + a.clicks, 0);
  const totalConversions = values.reduce((s, a) => s + a.conversions, 0);
  const totalRevenue = values.reduce((s, a) => s + a.revenue, 0);

  return (
    <AnalyticsSummaryCards
      totalPageviews={totalPageviews}
      totalClicks={totalClicks}
      totalConversions={totalConversions}
      totalRevenue={totalRevenue}
    />
  );
}

async function TrendChartSection() {
  const data = await fetchTrendData(90);
  return <TrendChart data={data} />;
}

async function RankingSection() {
  const [{ articles }, analytics] = await Promise.all([
    fetchArticlesData(),
    fetchAnalyticsData(),
  ]);
  const rankings = buildRankingData(articles, analytics);
  return <ArticleRanking rankings={rankings} />;
}

async function ArticlesTableSection() {
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
      <AdminHeader title="記事管理" breadcrumbs={[{ label: "記事管理" }]} />

      <Suspense fallback={<SummaryCardsSkeleton />}>
        <ArticlesSummarySection />
      </Suspense>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Suspense fallback={<ChartSkeleton />}>
            <TrendChartSection />
          </Suspense>
        </div>
        <div className="lg:col-span-5">
          <Suspense fallback={<RankingSkeleton />}>
            <RankingSection />
          </Suspense>
        </div>
      </div>

      <div className="mt-6">
        <Suspense fallback={<TableSkeleton />}>
          <ArticlesTableSection />
        </Suspense>
      </div>
    </>
  );
}
