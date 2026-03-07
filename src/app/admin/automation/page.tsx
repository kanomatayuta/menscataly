import { Suspense, cache } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AutomationDashboard } from "@/components/admin/AutomationDashboard";
import { LivePipelineMonitor } from "@/components/admin/LivePipelineMonitor";
import { StatCard } from "@/components/admin/StatCard";
import { PipelineRunTable } from "@/components/admin/PipelineRunTable";
import { HealthScoreDistributionChart } from "@/components/admin/HealthScoreDistributionChart";
import { LowestHealthArticles } from "@/components/admin/LowestHealthArticles";
import type { PipelineStatus, PipelineType } from "@/lib/pipeline/types";
import type { HealthScoreInput } from "@/lib/content/health-score";
import type { ArticleReviewItem, ArticleAnalytics, MonitoringAlert } from "@/types/admin";
import type { MicroCMSArticle } from "@/types/microcms";
import type { MicroCMSListResponse } from "microcms-js-sdk";
import type { ContentCategory } from "@/types/content";

// ------------------------------------------------------------------
// PPR helper
// ------------------------------------------------------------------

function isPprRejection(err: unknown): boolean {
  return (err instanceof Error && (err as { digest?: string }).digest === "HANGING_PROMISE_REJECTION");
}

// ------------------------------------------------------------------
// Data fetching: Pipeline runs from Supabase
// ------------------------------------------------------------------

interface PipelineRunRow {
  id: string;
  type: PipelineType;
  status: PipelineStatus;
  started_at: string;
  completed_at: string | null;
  steps_json: unknown;
  error: string | null;
}

async function fetchPipelineRuns(): Promise<PipelineRunRow[]> {
  try {
    await connection();
  } catch {
    return [];
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return [];

  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("pipeline_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("[automation] Pipeline runs fetch error:", error.message);
      return [];
    }

    return (data ?? []) as PipelineRunRow[];
  } catch (err) {
    if (!isPprRejection(err)) console.error("[automation] Pipeline runs error:", err);
    return [];
  }
}

// ------------------------------------------------------------------
// Data fetching: Today's activity from Supabase
// ------------------------------------------------------------------

interface TodayActivity {
  articlesGenerated: number;
  articlesRewritten: number;
  complianceViolations: number;
  alertsFired: number;
}

async function fetchTodayActivity(): Promise<TodayActivity> {
  const defaults: TodayActivity = {
    articlesGenerated: 0,
    articlesRewritten: 0,
    complianceViolations: 0,
    alertsFired: 0,
  };

  try {
    await connection();
  } catch {
    return defaults;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return defaults;

  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createServerSupabaseClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    // Parallel queries
    const [pipelineResult, alertsResult] = await Promise.allSettled([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("pipeline_runs")
        .select("type, status, steps_json")
        .gte("started_at", todayStr),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("monitoring_alerts")
        .select("type, created_at")
        .gte("created_at", todayStr),
    ]);

    const pipelineRuns = pipelineResult.status === "fulfilled" ? (pipelineResult.value.data ?? []) : [];
    const alertRows = alertsResult.status === "fulfilled" ? (alertsResult.value.data ?? []) : [];

    // Count articles generated/rewritten from pipeline step logs
    let generated = 0;
    let rewritten = 0;
    for (const run of pipelineRuns) {
      if (run.type === "daily" && run.status === "success") generated++;
      if (run.type === "pdca" && run.status === "success") rewritten++;
    }

    // Count compliance violations from alerts
    const complianceAlerts = alertRows.filter(
      (a: { type?: string }) => a.type === "compliance_violation"
    ).length;

    return {
      articlesGenerated: generated,
      articlesRewritten: rewritten,
      complianceViolations: complianceAlerts,
      alertsFired: alertRows.length,
    };
  } catch (err) {
    if (!isPprRejection(err)) console.error("[automation] Today activity error:", err);
    return defaults;
  }
}

// ------------------------------------------------------------------
// Data fetching: Active alerts
// ------------------------------------------------------------------

async function _fetchActiveAlerts(): Promise<MonitoringAlert[]> {
  try {
    await connection();
  } catch {
    return [];
  }

  try {
    const { AlertManager } = await import("@/lib/monitoring/alert-manager");
    const alertManager = new AlertManager();
    return await alertManager.getActiveAlerts();
  } catch (err) {
    if (!isPprRejection(err)) console.error("[automation] Alerts fetch error:", err);
    return [];
  }
}

// ------------------------------------------------------------------
// Data fetching: Health scores (calculated on-the-fly)
// ------------------------------------------------------------------

const EMPTY_MICROCMS_RESPONSE: MicroCMSListResponse<MicroCMSArticle> = {
  contents: [], totalCount: 0, offset: 0, limit: 100,
};

const getCachedArticlesForHealth = cache(async () => {
  try {
    await connection();
  } catch {
    return EMPTY_MICROCMS_RESPONSE;
  }
  try {
    const { getArticles } = await import("@/lib/microcms/client");
    return await getArticles({ limit: 100, orders: "-publishedAt" });
  } catch (err) {
    console.error("[automation] microCMS fetch error:", err);
    return EMPTY_MICROCMS_RESPONSE;
  }
});

interface HealthScoreData {
  articleId: string;
  title: string;
  slug: string;
  total: number;
  status: "healthy" | "needs_improvement" | "critical";
  topRecommendation: string | null;
}

interface HealthDistribution {
  healthy: number;
  needsImprovement: number;
  critical: number;
}

interface HealthData {
  distribution: HealthDistribution;
  lowestScoring: HealthScoreData[];
  totalArticles: number;
}

async function fetchHealthData(): Promise<HealthData> {
  const emptyResult: HealthData = {
    distribution: { healthy: 0, needsImprovement: 0, critical: 0 },
    lowestScoring: [],
    totalArticles: 0,
  };

  try {
    await connection();
  } catch {
    return emptyResult;
  }

  try {
    const response = await getCachedArticlesForHealth();
    if (response.contents.length === 0) return emptyResult;

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
    }));

    // Fetch GA4 analytics for health score inputs
    const analyticsMap = await fetchAnalyticsForHealth(articles);

    // Calculate health scores
    const { calculateHealthScore, getHealthScoreDistribution } = await import("@/lib/content/health-score");

    const inputs: HealthScoreInput[] = articles.map((article) => {
      const stats = analyticsMap.get(article.id);
      return {
        articleId: article.id,
        rankingPosition: null,
        rankingChange7d: null,
        ctr: null,
        impressions: null,
        avgSessionDuration: null,
        bounceRate: null,
        pageviews7d: stats?.pageviews ?? null,
        aspClicks: stats?.affiliateClicks ?? null,
        aspConversions: stats?.conversions ?? null,
        aspRevenue: stats?.revenue ?? null,
      };
    });

    const scores = inputs.map((input) => calculateHealthScore(input));
    const distribution = getHealthScoreDistribution(scores);

    // Build combined data and sort by total score (ascending)
    const allScoreData: HealthScoreData[] = articles.map((article, i) => ({
      articleId: article.id,
      title: article.title,
      slug: article.slug,
      total: scores[i].total,
      status: scores[i].status,
      topRecommendation: scores[i].recommendations[0] ?? null,
    }));

    allScoreData.sort((a, b) => a.total - b.total);

    return {
      distribution,
      lowestScoring: allScoreData.slice(0, 5),
      totalArticles: articles.length,
    };
  } catch (err) {
    if (!isPprRejection(err)) console.error("[automation] Health data error:", err);
    return emptyResult;
  }
}

async function fetchAnalyticsForHealth(
  articles: ArticleReviewItem[]
): Promise<Map<string, ArticleAnalytics>> {
  const map = new Map<string, ArticleAnalytics>();

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
    const { fetchGA4DailyMetrics, extractSlugFromPath, fetchAffiliateClicks } = await import("@/lib/analytics/ga4-client");
    const [ga4Data, affiliateData] = await Promise.all([
      fetchGA4DailyMetrics("7daysAgo", "today"),
      fetchAffiliateClicks("7daysAgo", "today"),
    ]);

    for (const row of ga4Data) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;
      const article = slugToArticle.get(slug);
      if (!article) continue;
      const entry = ensure(article.id);
      entry.pageviews += row.pageviews;
    }

    for (const row of affiliateData) {
      const slug = extractSlugFromPath(row.pagePath);
      if (!slug) continue;
      const article = slugToArticle.get(slug);
      if (!article) continue;
      const entry = ensure(article.id);
      entry.affiliateClicks += row.clickCount;
    }
  } catch (err) {
    if (!isPprRejection(err)) console.error("[automation] GA4 health fetch error:", err);
  }

  return map;
}

// ------------------------------------------------------------------
// Cache wrappers
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// Data fetching: Recent error logs from monitoring_alerts
// ------------------------------------------------------------------

interface ErrorLogEntry {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
  resolved: boolean;
}

async function fetchRecentErrors(): Promise<ErrorLogEntry[]> {
  try {
    await connection();
  } catch {
    return [];
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return [];

  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/client");
    const supabase = createServerSupabaseClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("monitoring_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).map((row) => ({
      id: row.id,
      type: row.type ?? "unknown",
      severity: row.severity ?? "info",
      title: row.title ?? "",
      message: row.message ?? "",
      createdAt: row.created_at ?? "",
      resolved: row.resolved ?? false,
    }));
  } catch (err) {
    if (!isPprRejection(err)) console.error("[automation] Error logs fetch:", err);
    return [];
  }
}

// ------------------------------------------------------------------
// Data fetching: Cumulative stats
// ------------------------------------------------------------------

interface CumulativeStats {
  totalArticles: number;
  totalPipelineRuns: number;
  successRate: number;
  avgComplianceScore: number;
}

async function fetchCumulativeStats(): Promise<CumulativeStats> {
  const defaults: CumulativeStats = { totalArticles: 0, totalPipelineRuns: 0, successRate: 0, avgComplianceScore: 0 };

  try {
    await connection();
  } catch {
    return defaults;
  }

  try {
    const [articlesResponse, runsData] = await Promise.allSettled([
      getCachedArticlesForHealth(),
      getCachedPipelineRuns(),
    ]);

    const articles = articlesResponse.status === "fulfilled" ? articlesResponse.value : EMPTY_MICROCMS_RESPONSE;
    const runs = runsData.status === "fulfilled" ? runsData.value : [];

    const totalArticles = articles.totalCount;
    const totalRuns = runs.length;
    const successRuns = runs.filter((r) => r.status === "success").length;
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

    const scores = articles.contents
      .map((a) => a.compliance_score)
      .filter((s): s is number => s != null && s > 0);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return { totalArticles, totalPipelineRuns: totalRuns, successRate, avgComplianceScore: avgScore };
  } catch {
    return defaults;
  }
}

const getCachedPipelineRuns = cache(fetchPipelineRuns);
const getCachedTodayActivity = cache(fetchTodayActivity);
const getCachedHealthData = cache(fetchHealthData);
const getCachedRecentErrors = cache(fetchRecentErrors);
const getCachedCumulativeStats = cache(fetchCumulativeStats);

// ------------------------------------------------------------------
// Skeleton components
// ------------------------------------------------------------------

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-slate-200" />
      ))}
    </div>
  );
}

function HealthSkeleton() {
  return <div className="h-[300px] animate-pulse rounded-lg bg-slate-200" />;
}

// ------------------------------------------------------------------
// Async Section Components
// ------------------------------------------------------------------

async function PipelineStatusSection() {
  const runs = await getCachedPipelineRuns();

  const lastDaily = runs.find((r) => r.type === "daily");
  const lastPdca = runs.find((r) => r.type === "pdca");

  function formatRunInfo(run: PipelineRunRow | undefined, label: string) {
    if (!run) {
      return (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="text-sm font-medium text-slate-500">{label}</h4>
          <p className="mt-2 text-sm text-slate-400">データなし</p>
        </div>
      );
    }

    const statusColors: Record<string, string> = {
      success: "text-green-700 bg-green-100",
      failed: "text-red-700 bg-red-100",
      running: "text-blue-700 bg-blue-100",
      idle: "text-slate-700 bg-slate-100",
      partial: "text-amber-700 bg-amber-100",
    };

    const statusLabels: Record<string, string> = {
      success: "成功",
      failed: "失敗",
      running: "実行中",
      idle: "待機中",
      partial: "一部失敗",
    };

    const durationMs = run.completed_at
      ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
      : null;

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-slate-500">{label}</h4>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[run.status] ?? "text-slate-600 bg-slate-100"}`}>
            {statusLabels[run.status] ?? run.status}
          </span>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">最終実行</span>
            <span className="font-medium text-slate-700">
              {new Date(run.started_at).toLocaleString("ja-JP")}
            </span>
          </div>
          {durationMs !== null && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">所要時間</span>
              <span className="font-medium text-slate-700">
                {formatDuration(durationMs)}
              </span>
            </div>
          )}
          {run.error && (
            <div className="mt-2 truncate rounded bg-red-50 px-2 py-1 text-xs text-red-600">
              {run.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">パイプライン状況</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {formatRunInfo(lastDaily, "日次パイプライン (06:00 JST)")}
        {formatRunInfo(lastPdca, "PDCAバッチ (23:00 JST)")}
      </div>
    </div>
  );
}

async function TodayActivitySection() {
  const activity = await getCachedTodayActivity();

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">本日のアクティビティ</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          title="記事生成"
          value={activity.articlesGenerated}
          subtitle="本日生成された記事"
          variant={activity.articlesGenerated > 0 ? "success" : "default"}
        />
        <StatCard
          title="記事リライト"
          value={activity.articlesRewritten}
          subtitle="本日リライトされた記事"
          variant={activity.articlesRewritten > 0 ? "blue" : "default"}
        />
        <StatCard
          title="コンプラ違反"
          value={activity.complianceViolations}
          subtitle="検出された違反"
          variant={activity.complianceViolations > 0 ? "danger" : "default"}
        />
        <StatCard
          title="アラート"
          value={activity.alertsFired}
          subtitle="発火したアラート"
          variant={activity.alertsFired > 0 ? "warning" : "default"}
        />
      </div>
    </div>
  );
}

async function PipelineHistorySection() {
  const runs = await getCachedPipelineRuns();

  const formattedRuns = runs.map((run) => ({
    id: run.id,
    type: run.type,
    status: run.status,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    durationMs: run.completed_at
      ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
      : null,
    error: run.error,
  }));

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">実行履歴 (直近10件)</h2>
      <PipelineRunTable runs={formattedRuns} />
    </div>
  );
}

async function HealthOverviewSection() {
  const healthData = await getCachedHealthData();

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">ヘルススコア概要</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HealthScoreDistributionChart
          distribution={healthData.distribution}
          totalArticles={healthData.totalArticles}
        />
        <LowestHealthArticles articles={healthData.lowestScoring} />
      </div>
    </div>
  );
}

async function UpcomingActionsSection() {
  const healthData = await getCachedHealthData();

  // Calculate next pipeline run times
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000; // JST = UTC + 9

  function getNextRunTime(targetHour: number): Date {
    const nowJST = new Date(now.getTime() + jstOffset);
    const target = new Date(nowJST);
    target.setHours(targetHour, 0, 0, 0);

    if (target <= nowJST) {
      target.setDate(target.getDate() + 1);
    }

    // Convert back to UTC for display
    return new Date(target.getTime() - jstOffset);
  }

  const nextDaily = getNextRunTime(6);   // 06:00 JST
  const nextPdca = getNextRunTime(23);   // 23:00 JST

  // Articles queued for rewrite (critical + needs_improvement)
  const articlesNeedingRewrite = healthData.lowestScoring.filter(
    (a) => a.status === "critical" || a.status === "needs_improvement"
  ).length;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">予定されたアクション</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">次回日次パイプライン</p>
              <p className="text-sm font-semibold text-slate-800">
                {nextDaily.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
              <svg className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">次回PDCAバッチ</p>
              <p className="text-sm font-semibold text-slate-800">
                {nextPdca.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full ${articlesNeedingRewrite > 0 ? "bg-amber-100" : "bg-green-100"}`}>
              <svg className={`h-4 w-4 ${articlesNeedingRewrite > 0 ? "text-amber-600" : "text-green-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">リライト候補</p>
              <p className="text-sm font-semibold text-slate-800">
                {articlesNeedingRewrite}件
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// AI稼働ステータス (リアルタイムモニター)
// ------------------------------------------------------------------

async function AIStatusSection() {
  const [runs, stats] = await Promise.all([
    getCachedPipelineRuns(),
    getCachedCumulativeStats(),
  ]);

  // Map steps_json from unknown to StepLog[] for the client component
  const monitorRuns = runs.map((r) => ({
    ...r,
    steps_json: (Array.isArray(r.steps_json) ? r.steps_json : []) as import("@/lib/pipeline/types").StepLog[],
  }));

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">AI稼働ステータス</h2>
      <LivePipelineMonitor initialRuns={monitorRuns} initialStats={stats} />
    </div>
  );
}

// ------------------------------------------------------------------
// エラーログセクション
// ------------------------------------------------------------------

async function ErrorLogSection() {
  const errors = await getCachedRecentErrors();

  if (errors.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">エラーログ</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-green-600 font-medium">エラーなし — 正常に稼働中</p>
        </div>
      </div>
    );
  }

  const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
    critical: { color: "text-red-700", bg: "bg-red-100", label: "重大" },
    warning: { color: "text-amber-700", bg: "bg-amber-100", label: "警告" },
    info: { color: "text-blue-700", bg: "bg-blue-100", label: "情報" },
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">エラーログ (直近20件)</h2>
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">重要度</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">タイプ</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">タイトル</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">日時</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {errors.map((err) => {
                const sev = severityConfig[err.severity] ?? severityConfig.info;
                return (
                  <tr key={err.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sev.bg} ${sev.color}`}>
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{err.type}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-xs font-medium text-slate-800 truncate max-w-xs">{err.title}</p>
                      {err.message && (
                        <p className="text-xs text-slate-500 truncate max-w-xs">{err.message}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                      {err.createdAt ? new Date(err.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${err.resolved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {err.resolved ? "解決済" : "未解決"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Helper
// ------------------------------------------------------------------

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AutomationPage() {
  return (
    <>
      <AdminHeader
        title="パイプライン・自動化"
        breadcrumbs={[{ label: "パイプライン・自動化" }]}
      />

      {/* モードバナー + 自動化設定 + 手動実行 — 統合コンポーネント */}
      <div className="mb-6">
        <AutomationDashboard />
      </div>

      {/* AI稼働ステータス + ステップタイムライン + 累計統計 */}
      <Suspense fallback={<HealthSkeleton />}>
        <AIStatusSection />
      </Suspense>

      {/* Pipeline Status + Today's Activity */}
      <div className="mt-6">
        <Suspense fallback={<StatsSkeleton />}>
          <PipelineStatusSection />
        </Suspense>
      </div>

      <div className="mt-6">
        <Suspense fallback={<StatsSkeleton />}>
          <TodayActivitySection />
        </Suspense>
      </div>

      {/* Upcoming Actions */}
      <div className="mt-6">
        <Suspense fallback={<StatsSkeleton />}>
          <UpcomingActionsSection />
        </Suspense>
      </div>

      {/* エラーログ */}
      <div className="mt-6">
        <Suspense fallback={<PipelineSkeleton />}>
          <ErrorLogSection />
        </Suspense>
      </div>

      {/* Health Score Overview */}
      <div className="mt-6">
        <Suspense fallback={<HealthSkeleton />}>
          <HealthOverviewSection />
        </Suspense>
      </div>

      {/* Pipeline History */}
      <div className="mt-6">
        <Suspense fallback={<PipelineSkeleton />}>
          <PipelineHistorySection />
        </Suspense>
      </div>
    </>
  );
}
