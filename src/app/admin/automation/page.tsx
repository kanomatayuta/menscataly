import { Suspense, cache } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AutomationDashboard } from "@/components/admin/AutomationDashboard";
import { LivePipelineMonitor } from "@/components/admin/LivePipelineMonitor";
import { PipelineRunTable } from "@/components/admin/PipelineRunTable";
import type { PipelineStatus, PipelineType } from "@/lib/pipeline/types";
import type { MicroCMSArticle } from "@/types/microcms";
import type { MicroCMSListResponse } from "microcms-js-sdk";

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

    let generated = 0;
    let rewritten = 0;
    for (const run of pipelineRuns) {
      if (run.type === "daily" && run.status === "success") generated++;
      if (run.type === "pdca" && run.status === "success") rewritten++;
    }

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
// Data fetching: Cumulative stats
// ------------------------------------------------------------------

interface CumulativeStats {
  totalArticles: number;
  totalPipelineRuns: number;
  successRate: number;
  avgComplianceScore: number;
}

const EMPTY_MICROCMS_RESPONSE: MicroCMSListResponse<MicroCMSArticle> = {
  contents: [], totalCount: 0, offset: 0, limit: 100,
};

const getCachedArticles = cache(async () => {
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

async function fetchCumulativeStats(): Promise<CumulativeStats> {
  const defaults: CumulativeStats = { totalArticles: 0, totalPipelineRuns: 0, successRate: 0, avgComplianceScore: 0 };

  try {
    await connection();
  } catch {
    return defaults;
  }

  try {
    const [articlesResponse, runsData] = await Promise.allSettled([
      getCachedArticles(),
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

// ------------------------------------------------------------------
// Cache wrappers
// ------------------------------------------------------------------

const getCachedPipelineRuns = cache(fetchPipelineRuns);
const getCachedTodayActivity = cache(fetchTodayActivity);
const getCachedCumulativeStats = cache(fetchCumulativeStats);

// ------------------------------------------------------------------
// Skeleton components
// ------------------------------------------------------------------

function MonitorSkeleton() {
  return <div className="h-[280px] animate-pulse rounded-xl bg-slate-200" />;
}

function CompactSkeleton() {
  return <div className="h-[200px] animate-pulse rounded-lg bg-slate-200" />;
}

// ------------------------------------------------------------------
// Async Section Components
// ------------------------------------------------------------------

async function AIStatusSection() {
  const [runs, stats, todayActivity] = await Promise.all([
    getCachedPipelineRuns(),
    getCachedCumulativeStats(),
    getCachedTodayActivity(),
  ]);

  const monitorRuns = runs.map((r) => ({
    ...r,
    steps_json: (Array.isArray(r.steps_json) ? r.steps_json : []) as import("@/lib/pipeline/types").StepLog[],
  }));

  return (
    <LivePipelineMonitor
      initialRuns={monitorRuns}
      initialStats={stats}
      todayActivity={todayActivity}
    />
  );
}

async function PipelineHistorySection() {
  const runs = await getCachedPipelineRuns();

  const formattedRuns = runs.slice(0, 5).map((run) => ({
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
      <h2 className="mb-3 text-lg font-semibold text-slate-800">実行履歴 (直近5件)</h2>
      <PipelineRunTable runs={formattedRuns} />
    </div>
  );
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

      {/* [1] モードバナー + 自動化設定 + 手動実行 */}
      <div className="mb-6">
        <AutomationDashboard />
      </div>

      {/* [2] リアルタイムモニター (ステータス + 統計 + 本日 + ステップ) */}
      <Suspense fallback={<MonitorSkeleton />}>
        <AIStatusSection />
      </Suspense>

      {/* [3] 実行履歴 */}
      <div className="mt-6">
        <Suspense fallback={<CompactSkeleton />}>
          <PipelineHistorySection />
        </Suspense>
      </div>
    </>
  );
}
