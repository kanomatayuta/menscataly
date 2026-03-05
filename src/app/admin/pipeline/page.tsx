"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { PipelineRunTable } from "@/components/admin/PipelineRunTable";
import { PipelineStepTimeline } from "@/components/admin/PipelineStepTimeline";
import { PipelineTriggerButton } from "@/components/admin/PipelineTriggerButton";
import type { PipelineStatus, PipelineType, StepLog } from "@/lib/pipeline/types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface PipelineRun {
  id: string;
  type: PipelineType;
  status: PipelineStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

// ------------------------------------------------------------------
// Mock data (Supabase未設定時のフォールバック)
// ------------------------------------------------------------------

const MOCK_RUNS: PipelineRun[] = [
  {
    id: "run-20260303-001",
    type: "daily",
    status: "success",
    startedAt: "2026-03-03T06:00:00+09:00",
    completedAt: "2026-03-03T06:30:00+09:00",
    durationMs: 1800000,
    error: null,
  },
  {
    id: "run-20260302-001",
    type: "daily",
    status: "partial",
    startedAt: "2026-03-02T06:00:00+09:00",
    completedAt: "2026-03-02T06:28:00+09:00",
    durationMs: 1680000,
    error: null,
  },
  {
    id: "run-20260301-001",
    type: "daily",
    status: "failed",
    startedAt: "2026-03-01T06:00:00+09:00",
    completedAt: "2026-03-01T06:15:00+09:00",
    durationMs: 900000,
    error: "Ideogram API returned 503 Service Unavailable",
  },
  {
    id: "run-20260228-001",
    type: "manual",
    status: "success",
    startedAt: "2026-02-28T14:00:00+09:00",
    completedAt: "2026-02-28T14:25:00+09:00",
    durationMs: 1500000,
    error: null,
  },
  {
    id: "run-20260228-pdca",
    type: "pdca",
    status: "success",
    startedAt: "2026-02-28T23:00:00+09:00",
    completedAt: "2026-02-28T23:10:00+09:00",
    durationMs: 600000,
    error: null,
  },
];

const MOCK_LATEST_STEPS: StepLog[] = [
  {
    stepName: "Trend Analysis",
    status: "success",
    startedAt: "2026-03-03T06:00:00+09:00",
    completedAt: "2026-03-03T06:05:00+09:00",
    durationMs: 300000,
    error: null,
    metadata: { keywordsFound: 5 },
  },
  {
    stepName: "Content Generation",
    status: "success",
    startedAt: "2026-03-03T06:05:00+09:00",
    completedAt: "2026-03-03T06:18:00+09:00",
    durationMs: 780000,
    error: null,
    metadata: { articlesGenerated: 2 },
  },
  {
    stepName: "Compliance Check",
    status: "success",
    startedAt: "2026-03-03T06:18:00+09:00",
    completedAt: "2026-03-03T06:20:00+09:00",
    durationMs: 120000,
    error: null,
    metadata: { avgScore: 94.5 },
  },
  {
    stepName: "Image Generation",
    status: "success",
    startedAt: "2026-03-03T06:20:00+09:00",
    completedAt: "2026-03-03T06:25:00+09:00",
    durationMs: 300000,
    error: null,
    metadata: { imagesGenerated: 4 },
  },
  {
    stepName: "Publish to microCMS",
    status: "success",
    startedAt: "2026-03-03T06:25:00+09:00",
    completedAt: "2026-03-03T06:30:00+09:00",
    durationMs: 300000,
    error: null,
    metadata: { articlesPublished: 2 },
  },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * pipeline_runs の DB行を PipelineRun 型にマップする
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRunRecord(row: Record<string, any>): PipelineRun {
  const startedAt = row.started_at ?? row.startedAt ?? "";
  const completedAt = row.completed_at ?? row.completedAt ?? null;
  const durationMs =
    completedAt && startedAt
      ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
      : (row.duration_ms ?? row.durationMs ?? null);

  return {
    id: row.id,
    type: row.type as PipelineType,
    status: row.status as PipelineStatus,
    startedAt,
    completedAt,
    durationMs,
    error: row.error ?? null,
  };
}

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function AdminPipelinePage() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [latestSteps, setLatestSteps] = useState<StepLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // パイプライン実行履歴を取得
      const historyRes = await fetch("/api/pipeline/history?limit=20", {
        credentials: "include",
      });

      if (!historyRes.ok) {
        // API認証エラー等の場合はモックデータにフォールバック
        setRuns(MOCK_RUNS);
        setLatestSteps(MOCK_LATEST_STEPS);
        return;
      }

      const historyData = await historyRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fetchedRuns: PipelineRun[] = (historyData.runs ?? []).map((r: Record<string, any>) =>
        mapRunRecord(r)
      );

      if (fetchedRuns.length === 0) {
        // DBにデータがない場合はモックデータで表示
        setRuns(MOCK_RUNS);
        setLatestSteps(MOCK_LATEST_STEPS);
        return;
      }

      setRuns(fetchedRuns);

      // 最新runのステップログを取得
      const statusRes = await fetch("/api/pipeline/status", {
        credentials: "include",
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const steps: StepLog[] = statusData.stepLogs ?? [];
        setLatestSteps(steps.length > 0 ? steps : MOCK_LATEST_STEPS);
      } else {
        setLatestSteps(MOCK_LATEST_STEPS);
      }
    } catch {
      // ネットワークエラー等ではモックデータを表示
      setRuns(MOCK_RUNS);
      setLatestSteps(MOCK_LATEST_STEPS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <>
        <AdminHeader
          title="Pipeline"
          breadcrumbs={[{ label: "Pipeline" }]}
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
            <p className="text-sm text-neutral-500">読み込み中...</p>
          </div>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------
  if (error) {
    return (
      <>
        <AdminHeader
          title="Pipeline"
          breadcrumbs={[{ label: "Pipeline" }]}
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="mb-2 text-sm font-medium text-neutral-900">
              データの取得に失敗しました
            </p>
            <p className="mb-4 text-xs text-neutral-500">{error}</p>
            <button
              type="button"
              onClick={loadData}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              再試行
            </button>
          </div>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------
  return (
    <>
      <AdminHeader
        title="Pipeline"
        breadcrumbs={[{ label: "Pipeline" }]}
      />

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Pipeline execution history and manual trigger
        </p>
        <PipelineTriggerButton />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run history */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Run History
          </h2>
          <PipelineRunTable runs={runs} />
        </div>

        {/* Latest run steps */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Latest Run Steps
          </h2>
          <PipelineStepTimeline steps={latestSteps} />
        </div>
      </div>
    </>
  );
}
