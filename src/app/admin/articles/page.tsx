import { Suspense, cache } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";

/** PPR プリレンダリング時の connection() 拒否はエラーではないため、ログをスキップ */
function isPprRejection(err: unknown): boolean {
  return (err instanceof Error && (err as { digest?: string }).digest === "HANGING_PROMISE_REJECTION");
}
import { AnalyticsSummaryCards } from "@/components/admin/AnalyticsSummaryCards";
import { TrendChart } from "@/components/admin/TrendChart";
import { ArticleRanking } from "@/components/admin/ArticleRanking";
import { ArticleTable } from "@/components/admin/ArticleTable";
import { CategoryChart } from "@/components/admin/CategoryChart";
import { getArticles, getCategories } from "@/lib/microcms/client";
import type { ArticleReviewItem, ArticleAnalytics, ArticleGrowthRate, TrendDataPoint, RankingData, RankingItem, CategoryTrendDataPoint, CategoryInfo } from "@/types/admin";
import type { ContentCategory } from "@/types/content";
import type { MicroCMSArticle } from "@/types/microcms";
import type { MicroCMSListResponse } from "microcms-js-sdk";

// ------------------------------------------------------------------
// Data fetching (microCMS から記事取得)
// ------------------------------------------------------------------

const EMPTY_MICROCMS_RESPONSE: MicroCMSListResponse<MicroCMSArticle> = {
  contents: [], totalCount: 0, offset: 0, limit: 100,
};

/** microCMS 生データ (キャッシュ) — fetchArticlesData と CategoryChartSection で共有 */
async function fetchRawArticles(): Promise<MicroCMSListResponse<MicroCMSArticle>> {
  try {
    await connection();
  } catch {
    return EMPTY_MICROCMS_RESPONSE;
  }
  try {
    return await getArticles({ limit: 100, orders: "-publishedAt" });
  } catch (err) {
    console.error("[admin/articles] microCMS fetch error:", err);
    return EMPTY_MICROCMS_RESPONSE;
  }
}

const getCachedRawArticles = cache(fetchRawArticles);

interface ArticlesResponse {
  articles: ArticleReviewItem[];
  total: number;
}

async function fetchArticlesData(): Promise<ArticlesResponse> {
  const response = await getCachedRawArticles();

  const articles: ArticleReviewItem[] = response.contents.map((item) => ({
    id: item.id,
    contentId: item.id,
    title: item.title,
    slug: item.slug ?? item.id,
    category: (item.category?.slug ?? "column") as ContentCategory,
    complianceScore: item.compliance_score ?? 0,
    status: "published" as const,
    generatedAt: item.publishedAt ?? item.createdAt,
    reviewedAt: null,
    reviewedBy: null,
    thumbnailUrl: item.thumbnail?.url ?? item.thumbnail_url ?? undefined,
  }));

  return { articles, total: response.totalCount };
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
    if (!isPprRejection(err)) console.error("[admin/articles] GA4/GSC fetch error:", err);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!isPprRejection(err)) console.error("[admin/articles] Analytics fetch error:", err);
  }

  return map;
}

// ------------------------------------------------------------------
// React.cache() wrappers for request-level deduplication
// ------------------------------------------------------------------

const getCachedArticlesData = cache(fetchArticlesData);
const getCachedAnalyticsData = cache(fetchAnalyticsData);

const getCachedCategories = cache(async (): Promise<CategoryInfo[]> => {
  try {
    await connection();
  } catch {
    return [];
  }
  try {
    const response = await getCategories();
    return response.contents.map((c) => ({ slug: c.slug ?? c.id, name: c.name }));
  } catch (err) {
    console.error("[admin/articles] Category fetch error:", err);
    return [];
  }
});

// ------------------------------------------------------------------
// Category article count helpers (日別/月別 × 作成/更新)
// ------------------------------------------------------------------

function buildArticleCountData(
  rawArticles: MicroCMSArticle[],
  categories: CategoryInfo[],
  getDate: (article: MicroCMSArticle) => string | undefined,
  groupBy: "day" | "month",
): CategoryTrendDataPoint[] {
  const categorySlugs = new Set(categories.map((c) => c.slug));
  const byKey = new Map<string, CategoryTrendDataPoint>();

  for (const article of rawArticles) {
    const dateStr = getDate(article);
    if (!dateStr) continue;

    const catSlug = article.category?.slug;
    if (!catSlug || !categorySlugs.has(catSlug)) continue;

    const d = new Date(dateStr);
    let key: string;
    let label: string;

    if (groupBy === "day") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      label = `${d.getMonth() + 1}/${d.getDate()}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      label = `${d.getFullYear()}/${d.getMonth() + 1}`;
    }

    let point = byKey.get(key);
    if (!point) {
      point = { date: label };
      for (const cat of categories) {
        point[cat.slug] = 0;
      }
      byKey.set(key, point);
    }

    (point[catSlug] as number) += 1;
  }

  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

// ------------------------------------------------------------------
// Category PV data (GA4 per-page PV → category aggregation)
// ------------------------------------------------------------------

async function fetchCategoryPvData(
  days: number,
  groupBy: "day" | "month",
): Promise<CategoryTrendDataPoint[]> {
  try {
    await connection();

    const { articles } = await getCachedArticlesData();
    const categories = await getCachedCategories();

    const slugToCategory = new Map<string, string>();
    for (const article of articles) {
      slugToCategory.set(article.slug ?? article.id, article.category);
    }
    const categorySlugs = new Set(categories.map((c) => c.slug));

    const { fetchGA4DailyMetrics, extractSlugFromPath } = await import("@/lib/analytics/ga4-client");
    const ga4Data = await fetchGA4DailyMetrics(`${days}daysAgo`, "today");

    const byKey = new Map<string, CategoryTrendDataPoint>();

    for (const row of ga4Data) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;

      const category = slugToCategory.get(slug);
      if (!category || !categorySlugs.has(category)) continue;

      const d = new Date(row.date);
      let key: string;
      let label: string;

      if (groupBy === "day") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        label = `${d.getMonth() + 1}/${d.getDate()}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = `${d.getFullYear()}/${d.getMonth() + 1}`;
      }

      let point = byKey.get(key);
      if (!point) {
        point = { date: label };
        for (const cat of categories) {
          point[cat.slug] = 0;
        }
        byKey.set(key, point);
      }

      (point[category] as number) += row.pageviews;
    }

    return [...byKey.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  } catch (err) {
    if (!isPprRejection(err)) console.error("[admin/articles] Category PV fetch error:", err);
    return [];
  }
}

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
    if (!isPprRejection(err)) console.error("[admin/articles] GA4 trend fetch error:", err);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (!isPprRejection(err)) console.error("[admin/articles] Trend fetch error:", err);
    return [];
  }
}

const getCachedTrendData = cache(() => fetchTrendData(90));

// ------------------------------------------------------------------
// Growth rate data (PV週次伸び率)
// ------------------------------------------------------------------

async function fetchGrowthRates(
  articles: ArticleReviewItem[]
): Promise<Map<string, ArticleGrowthRate>> {
  const map = new Map<string, ArticleGrowthRate>();

  const slugToArticle = new Map<string, ArticleReviewItem>();
  for (const a of articles) {
    slugToArticle.set(a.slug, a);
  }

  try {
    await connection();

    const { fetchGA4DailyMetrics, extractSlugFromPath } = await import("@/lib/analytics/ga4-client");

    // 今週 (7日) と先週 (14日前〜8日前) を並列取得
    const [thisWeekData, prevWeekData] = await Promise.all([
      fetchGA4DailyMetrics("7daysAgo", "today"),
      fetchGA4DailyMetrics("14daysAgo", "8daysAgo"),
    ]);

    // 今週PV集計
    const thisWeekPv = new Map<string, number>();
    for (const row of thisWeekData) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;
      thisWeekPv.set(slug, (thisWeekPv.get(slug) ?? 0) + row.pageviews);
    }

    // 先週PV集計
    const prevWeekPv = new Map<string, number>();
    for (const row of prevWeekData) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;
      prevWeekPv.set(slug, (prevWeekPv.get(slug) ?? 0) + row.pageviews);
    }

    // 伸び率計算
    for (const [slug, article] of slugToArticle) {
      const current = thisWeekPv.get(slug) ?? 0;
      const previous = prevWeekPv.get(slug) ?? 0;
      const growthRate = previous > 0 ? (current - previous) / previous : null;
      map.set(article.id, {
        articleId: article.id,
        currentWeekPv: current,
        previousWeekPv: previous,
        growthRate,
      });
    }
  } catch (err) {
    if (!isPprRejection(err)) console.error("[admin/articles] Growth rate fetch error:", err);
  }

  return map;
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[380px] animate-pulse rounded-lg bg-slate-200" />;
}

function RankingSkeleton() {
  return <div className="h-[380px] animate-pulse rounded-lg bg-slate-200" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-slate-200" />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Async Section Components (each independently streamable via Suspense)
// ------------------------------------------------------------------

async function ArticlesSummarySection() {
  const [{ articles, total }, trendData] = await Promise.all([
    getCachedArticlesData(),
    getCachedTrendData(),
  ]);
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
      trendData={trendData}
    />
  );
}

async function TrendChartSection() {
  const data = await getCachedTrendData();
  return <TrendChart data={data} />;
}

async function RankingSection() {
  const { articles } = await getCachedArticlesData();
  const analytics = await getCachedAnalyticsData(articles);
  const rankings = buildRankingData(articles, analytics);
  return <ArticleRanking rankings={rankings} />;
}

async function CategoryChartSection() {
  const { articles } = await getCachedArticlesData();
  const categories = await getCachedCategories();
  const rawResponse = await getCachedRawArticles();
  const rawArticles = rawResponse.contents;

  const getCreatedDate = (a: MicroCMSArticle) => a.publishedAt ?? a.createdAt;
  const getUpdatedDate = (a: MicroCMSArticle) => a.revisedAt ?? a.publishedAt ?? a.createdAt;

  // 記事数データ (4パターン)
  const dailyCreatedData = buildArticleCountData(rawArticles, categories, getCreatedDate, "day");
  const dailyUpdatedData = buildArticleCountData(rawArticles, categories, getUpdatedDate, "day");
  const monthlyCreatedData = buildArticleCountData(rawArticles, categories, getCreatedDate, "month");
  const monthlyUpdatedData = buildArticleCountData(rawArticles, categories, getUpdatedDate, "month");

  // PVデータ (日別/月別)
  const [dailyPvData, monthlyPvData] = await Promise.all([
    fetchCategoryPvData(90, "day"),
    fetchCategoryPvData(90, "month"),
  ]);

  // Count articles by category
  const articleCountByCategory: Record<string, number> = {};
  for (const article of articles) {
    articleCountByCategory[article.category] = (articleCountByCategory[article.category] ?? 0) + 1;
  }

  return (
    <CategoryChart
      dailyCreatedData={dailyCreatedData}
      dailyUpdatedData={dailyUpdatedData}
      monthlyCreatedData={monthlyCreatedData}
      monthlyUpdatedData={monthlyUpdatedData}
      dailyPvData={dailyPvData}
      monthlyPvData={monthlyPvData}
      categories={categories}
      articleCountByCategory={articleCountByCategory}
    />
  );
}

async function ArticlesTableSection() {
  const { articles } = await getCachedArticlesData();
  const [analytics, categories, growthRates] = await Promise.all([
    getCachedAnalyticsData(articles),
    getCachedCategories(),
    fetchGrowthRates(articles),
  ]);

  // 更新日マップ (microCMS revisedAt)
  const rawResponse = await getCachedRawArticles();
  const updatedAtMap = new Map<string, string>();
  for (const item of rawResponse.contents) {
    if (item.revisedAt) {
      updatedAtMap.set(item.id, item.revisedAt);
    }
  }

  return (
    <>
      <h3 className="mb-4 text-sm font-semibold text-slate-700">記事一覧</h3>
      <ArticleTable articles={articles} analytics={analytics} categories={categories} updatedAtMap={updatedAtMap} growthRates={growthRates} />
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
