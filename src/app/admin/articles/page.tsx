import { Suspense, cache } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AnalyticsSummaryCards } from "@/components/admin/AnalyticsSummaryCards";
import { TrendChart } from "@/components/admin/TrendChart";
import { ArticleRanking } from "@/components/admin/ArticleRanking";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { CategoryChart } from "@/components/admin/CategoryChart";
import { getArticles } from "@/lib/microcms/client";
import { extractSlugFromPath } from "@/lib/analytics/ga4-client";
import type { ArticleReviewItem, ArticleAnalytics, TrendDataPoint, RankingData, RankingItem, CategoryTrendDataPoint } from "@/types/admin";
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
// Analytics fetching (GA4 API直接 → Supabase フォールバック)
// ------------------------------------------------------------------

async function fetchAnalyticsFromGA4(
  articles: ArticleReviewItem[]
): Promise<Map<string, ArticleAnalytics>> {
  const map = new Map<string, ArticleAnalytics>();

  // slug → article マッピング
  const slugToArticle = new Map<string, ArticleReviewItem>();
  for (const a of articles) {
    slugToArticle.set(a.slug, a);
  }

  const ensure = (articleId: string): ArticleAnalytics => {
    let entry = map.get(articleId);
    if (!entry) {
      entry = { articleId, pageviews: 0, searchClicks: 0, affiliateClicks: 0, conversions: 0, revenue: 0 };
      map.set(articleId, entry);
    }
    return entry;
  };

  try {
    await connection(); // PPR: Date.now() 使用前に必須

    // 1. GA4 PVデータ + アフィリエイトクリックデータを並列取得
    const { fetchGA4DailyMetrics, extractSlugFromPath, fetchAffiliateClicks } = await import("@/lib/analytics/ga4-client");
    const [ga4Data, affiliateData] = await Promise.all([
      fetchGA4DailyMetrics("30daysAgo", "today"),
      fetchAffiliateClicks("30daysAgo", "today"),
    ]);

    for (const row of ga4Data) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;
      const article = slugToArticle.get(slug);
      if (!article) continue;
      const entry = ensure(article.id);
      entry.pageviews += row.pageviews;
    }

    // アフィリエイトクリックデータをマッピング
    for (const row of affiliateData) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;
      const article = slugToArticle.get(slug);
      if (!article) continue;
      const entry = ensure(article.id);
      entry.affiliateClicks += row.clickCount;
    }

    // 2. GSC 検索クリック・CTRデータ取得
    const { fetchGSCData, extractSlugFromGSCPage } = await import("@/lib/analytics/gsc-client");
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sinceStr = thirtyDaysAgo.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    const gscData = await fetchGSCData(sinceStr, todayStr);

    for (const row of gscData) {
      const slug = extractSlugFromGSCPage(row.page);
      if (!slug) continue;
      const article = slugToArticle.get(slug);
      if (!article) continue;
      const entry = ensure(article.id);
      entry.searchClicks += row.clicks;
    }
  } catch (err) {
    console.error("[admin/articles] GA4/GSC fetch error:", err);
  }

  return map;
}

async function fetchAnalyticsData(
  articles: ArticleReviewItem[] = []
): Promise<Map<string, ArticleAnalytics>> {
  // まず GA4 API から直接取得を試みる
  const ga4Map = await fetchAnalyticsFromGA4(articles);
  if (ga4Map.size > 0) return ga4Map;

  // GA4 が使えない場合は Supabase フォールバック
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
        entry = { articleId, pageviews: 0, searchClicks: 0, affiliateClicks: 0, conversions: 0, revenue: 0 };
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
        entry.affiliateClicks += row.click_count ?? 0;
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
// React.cache() wrappers for request-level deduplication
// ------------------------------------------------------------------

const getCachedArticlesData = cache(fetchArticlesData);
const getCachedAnalyticsData = cache(fetchAnalyticsData);

// ------------------------------------------------------------------
// Category trend data fetching (GA4 per-page PV → category aggregation)
// ------------------------------------------------------------------

async function fetchCategoryTrendData(days: number): Promise<CategoryTrendDataPoint[]> {
  try {
    await connection();

    const { articles } = await getCachedArticlesData();

    // Build slug → category map
    const slugToCategory = new Map<string, string>();
    for (const article of articles) {
      const slug = article.slug ?? article.id;
      slugToCategory.set(slug, article.category);
    }

    // Category key mapping (ContentCategory → CategoryTrendDataPoint key)
    const categoryKeyMap: Record<string, keyof Omit<CategoryTrendDataPoint, "date">> = {
      "aga": "aga",
      "ed": "ed",
      "hair-removal": "hairRemoval",
      "skincare": "skincare",
      "column": "supplement",  // column category maps to supplement
    };

    const { fetchGA4DailyMetrics } = await import("@/lib/analytics/ga4-client");
    const ga4Data = await fetchGA4DailyMetrics(`${days}daysAgo`, "today");

    const byDate = new Map<string, CategoryTrendDataPoint>();

    for (const row of ga4Data) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;

      const category = slugToCategory.get(slug);
      if (!category) continue;

      const catKey = categoryKeyMap[category];
      if (!catKey) continue;

      let point = byDate.get(row.date);
      if (!point) {
        const dateObj = new Date(row.date);
        point = {
          date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
          aga: 0,
          ed: 0,
          hairRemoval: 0,
          skincare: 0,
          supplement: 0,
        };
        byDate.set(row.date, point);
      }

      point[catKey] += row.pageviews;
    }

    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  } catch (err) {
    console.error("[admin/articles] Category trend fetch error:", err);
    return [];
  }
}

const getCachedCategoryTrendData = cache(fetchCategoryTrendData);

// ------------------------------------------------------------------
// Trend data fetching (GA4 API直接 → Supabase フォールバック)
// ------------------------------------------------------------------

async function fetchTrendData(days: number): Promise<TrendDataPoint[]> {
  // GA4 (PV) + GSC (クリック) から直接取得
  try {
    await connection(); // PPR: Date.now() 使用前に必須

    const byDate = new Map<string, TrendDataPoint>();
    const ensurePoint = (dateStr: string): TrendDataPoint => {
      let point = byDate.get(dateStr);
      if (!point) {
        const dateObj = new Date(dateStr);
        point = {
          date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
          pageviews: 0,
          searchClicks: 0,
          affiliateClicks: 0,
          conversions: 0,
        };
        byDate.set(dateStr, point);
      }
      return point;
    };

    // GA4 PVデータ + アフィリエイトクリックデータ + GSC を並列取得
    const { fetchGA4DailyMetrics, fetchAffiliateClicks } = await import("@/lib/analytics/ga4-client");
    const { fetchGSCData } = await import("@/lib/analytics/gsc-client");
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = since.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    const [ga4Data, affiliateData, gscData] = await Promise.all([
      fetchGA4DailyMetrics(`${days}daysAgo`, "today"),
      fetchAffiliateClicks(sinceStr, todayStr),
      fetchGSCData(sinceStr, todayStr, ["page", "date"]),
    ]);

    for (const row of ga4Data) {
      const point = ensurePoint(row.date);
      point.pageviews += row.pageviews;
    }

    // アフィリエイトクリック日別データをマッピング
    for (const row of affiliateData) {
      const point = ensurePoint(row.date);
      point.affiliateClicks += row.clickCount;
    }

    // GSC 検索クリックデータ (日別)
    for (const row of gscData) {
      if (!row.date) continue;
      const point = ensurePoint(row.date);
      point.searchClicks += row.clicks;
    }

    if (byDate.size > 0) {
      return [...byDate.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v);
    }
  } catch (err) {
    console.error("[admin/articles] GA4 trend fetch error:", err);
  }

  // Supabase フォールバック
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

    const byDate = new Map<string, TrendDataPoint>();
    for (const row of data) {
      const d = row.date as string;
      let point = byDate.get(d);
      if (!point) {
        const dateObj = new Date(d);
        point = {
          date: `${dateObj.getMonth() + 1}/${dateObj.getDate()}`,
          pageviews: 0,
          searchClicks: 0,
          affiliateClicks: 0,
          conversions: 0,
        };
        byDate.set(d, point);
      }
      point.pageviews += row.pageviews ?? 0;
      point.searchClicks += Math.round((row.ctr ?? 0) * (row.pageviews ?? 0));
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
      const ctrA = a.stats.affiliateClicks / a.stats.pageviews;
      const ctrB = b.stats.affiliateClicks / b.stats.pageviews;
      return ctrB - ctrA;
    });
  const byRevenue = [...withStats].sort((a, b) => b.stats.revenue - a.stats.revenue);

  return {
    pageviews: makeItems(byPV, (v) => v.toLocaleString("ja-JP"), (s) => s.pageviews),
    affiliateCtr: makeItems(
      byCTR,
      (v) => `${(v * 100).toFixed(1)}%`,
      (s) => s.affiliateClicks / s.pageviews,
    ),
    revenue: makeItems(byRevenue, (v) => `¥${v.toLocaleString("ja-JP")}`, (s) => s.revenue),
  };
}

// ------------------------------------------------------------------
// Skeleton components
// ------------------------------------------------------------------

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
  const { articles, total } = await getCachedArticlesData();
  const analytics = await getCachedAnalyticsData(articles);
  const values = [...analytics.values()];
  const totalPageviews = values.reduce((s, a) => s + a.pageviews, 0);
  const totalSearchClicks = values.reduce((s, a) => s + a.searchClicks, 0);
  const totalAffiliateClicks = values.reduce((s, a) => s + a.affiliateClicks, 0);
  const totalRevenue = values.reduce((s, a) => s + a.revenue, 0);

  return (
    <AnalyticsSummaryCards
      totalPageviews={totalPageviews}
      totalSearchClicks={totalSearchClicks}
      totalAffiliateClicks={totalAffiliateClicks}
      totalRevenue={totalRevenue}
      totalArticles={total}
    />
  );
}

async function TrendChartSection() {
  const data = await fetchTrendData(90);
  return <TrendChart data={data} />;
}

async function RankingSection() {
  const { articles } = await getCachedArticlesData();
  const analytics = await getCachedAnalyticsData(articles);
  const rankings = buildRankingData(articles, analytics);
  return <ArticleRanking rankings={rankings} />;
}

async function CategoryChartSection() {
  const data = await getCachedCategoryTrendData(90);
  const { articles } = await getCachedArticlesData();

  // Count articles by category
  const articleCountByCategory: Record<string, number> = {};
  const categoryKeyMap: Record<string, string> = {
    "aga": "aga",
    "ed": "ed",
    "hair-removal": "hairRemoval",
    "skincare": "skincare",
    "column": "supplement",
  };

  for (const article of articles) {
    const catKey = categoryKeyMap[article.category] ?? article.category;
    articleCountByCategory[catKey] = (articleCountByCategory[catKey] ?? 0) + 1;
  }

  return <CategoryChart data={data} articleCountByCategory={articleCountByCategory} />;
}

async function ArticlesTableSection() {
  const { articles, total } = await getCachedArticlesData();
  const analytics = await getCachedAnalyticsData(articles);

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
        <div className="lg:col-span-5">
          <Suspense fallback={<ChartSkeleton />}>
            <TrendChartSection />
          </Suspense>
        </div>
        <div className="lg:col-span-7">
          <Suspense fallback={<RankingSkeleton />}>
            <RankingSection />
          </Suspense>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="mt-6">
        <Suspense fallback={<ChartSkeleton />}>
          <CategoryChartSection />
        </Suspense>
      </div>

      <div className="mt-6">
        <Suspense fallback={<TableSkeleton />}>
          <ArticlesTableSection />
        </Suspense>
      </div>
    </>
  );
}
