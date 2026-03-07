"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StepLog, StepStatus, PipelineStatus, PipelineType } from "@/lib/pipeline/types";

// ============================================================
// Types
// ============================================================

interface PipelineRunData {
  id: string;
  type: PipelineType;
  status: PipelineStatus;
  started_at: string;
  completed_at: string | null;
  steps_json: StepLog[];
  error: string | null;
}

interface CumulativeStats {
  totalArticles: number;
  totalPipelineRuns: number;
  successRate: number;
  avgComplianceScore: number;
}

// ============================================================
// Status Config
// ============================================================

const STEP_STATUS: Record<StepStatus, { icon: string; color: string; bg: string; ring: string }> = {
  pending: { icon: "○", color: "text-slate-400", bg: "bg-slate-100", ring: "" },
  running: { icon: "●", color: "text-blue-600", bg: "bg-blue-100", ring: "ring-2 ring-blue-400 ring-offset-1" },
  success: { icon: "✓", color: "text-emerald-600", bg: "bg-emerald-100", ring: "" },
  failed: { icon: "✕", color: "text-red-600", bg: "bg-red-100", ring: "" },
  skipped: { icon: "–", color: "text-slate-400", bg: "bg-slate-100", ring: "" },
};

const RUN_STATUS: Record<PipelineStatus, { label: string; color: string; bg: string; dot: string; pulse: boolean }> = {
  idle: { label: "待機中", color: "text-slate-600", bg: "bg-slate-100", dot: "bg-slate-400", pulse: false },
  running: { label: "実行中", color: "text-blue-700", bg: "bg-blue-100", dot: "bg-blue-500", pulse: true },
  success: { label: "成功", color: "text-emerald-700", bg: "bg-emerald-100", dot: "bg-emerald-500", pulse: false },
  failed: { label: "失敗", color: "text-red-700", bg: "bg-red-100", dot: "bg-red-500", pulse: false },
  partial: { label: "一部失敗", color: "text-amber-700", bg: "bg-amber-100", dot: "bg-amber-500", pulse: false },
};

// ============================================================
// Helpers
// ============================================================

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}秒`;
  return `${Math.floor(s / 60)}分${s % 60}秒`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function getElapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}秒`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分${s % 60}秒`;
  const h = Math.floor(m / 60);
  return `${h}時間${m % 60}分`;
}

// ============================================================
// Step Progress Bar (horizontal)
// ============================================================

function StepProgressBar({ steps }: { steps: StepLog[] }) {
  if (steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.status === "success").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;
  const runningCount = steps.filter((s) => s.status === "running").length;
  const total = steps.length;
  const pct = Math.round(((completedCount + failedCount) / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{completedCount}/{total} ステップ完了{failedCount > 0 ? ` (${failedCount}件失敗)` : ""}</span>
        <span className="font-medium">{runningCount > 0 ? `${pct}%` : pct === 100 ? "完了" : `${pct}%`}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full flex transition-all duration-500">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
          {failedCount > 0 && (
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${(failedCount / total) * 100}%` }}
            />
          )}
          {runningCount > 0 && (
            <div
              className="bg-blue-500 animate-pulse transition-all duration-500"
              style={{ width: `${(runningCount / total) * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step Timeline (compact)
// ============================================================

function CompactTimeline({ steps }: { steps: StepLog[] }) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const sc = STEP_STATUS[step.status];
        const isRunning = step.status === "running";
        return (
          <div
            key={step.stepName}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
              isRunning ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
            }`}
          >
            {/* Step Number + Icon */}
            <div className="flex items-center gap-2 flex-shrink-0 w-8">
              <span className="text-[10px] text-slate-400 w-3">{i + 1}</span>
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${sc.bg} ${sc.color} ${sc.ring}`}>
                {isRunning ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                ) : (
                  sc.icon
                )}
              </div>
            </div>

            {/* Step Name */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isRunning ? "text-blue-800" : "text-slate-700"}`}>
                {step.stepName}
              </p>
            </div>

            {/* Duration / Time */}
            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-slate-500">
              {isRunning && step.startedAt && (
                <span className="text-blue-600 font-medium animate-pulse">
                  {getElapsedSince(step.startedAt)} 経過
                </span>
              )}
              {step.status === "success" && (
                <span className="text-emerald-600">{formatDuration(step.durationMs)}</span>
              )}
              {step.status === "failed" && (
                <span className="text-red-600">{formatDuration(step.durationMs)}</span>
              )}
              {step.startedAt && !isRunning && (
                <span>{formatTime(step.startedAt)}</span>
              )}
            </div>

            {/* Error */}
            {step.error && (
              <span className="text-xs text-red-500 truncate max-w-[200px]" title={step.error}>
                {step.error}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

interface LivePipelineMonitorProps {
  initialRuns: PipelineRunData[];
  initialStats: CumulativeStats;
}

export function LivePipelineMonitor({ initialRuns, initialStats }: LivePipelineMonitorProps) {
  const [runs, setRuns] = useState<PipelineRunData[]>(initialRuns);
  const [stats, setStats] = useState<CumulativeStats>(initialStats);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [elapsedText, setElapsedText] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const latestRun = runs[0];
  const steps = Array.isArray(latestRun?.steps_json) ? latestRun.steps_json : [];
  const isRunning = latestRun?.status === "running";
  const runStatus = latestRun ? RUN_STATUS[latestRun.status] : RUN_STATUS.idle;

  // Fetch latest data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pipeline/status", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();

      if (data.runs) setRuns(data.runs);
      if (data.stats) setStats(data.stats);
      setLastUpdated(new Date());
    } catch {
      // Silently fail polling
    }
  }, []);

  // Auto-poll when running (every 3s), otherwise every 30s
  useEffect(() => {
    clearInterval(pollingRef.current);
    const interval = isRunning ? 3000 : 30000;
    setIsPolling(true);
    pollingRef.current = setInterval(fetchData, interval);
    return () => clearInterval(pollingRef.current);
  }, [isRunning, fetchData]);

  // Elapsed time ticker (updates every second when running)
  useEffect(() => {
    clearInterval(tickRef.current);
    if (isRunning && latestRun?.started_at) {
      const update = () => setElapsedText(getElapsedSince(latestRun.started_at));
      update();
      tickRef.current = setInterval(update, 1000);
    } else {
      setElapsedText("");
    }
    return () => clearInterval(tickRef.current);
  }, [isRunning, latestRun?.started_at]);

  // Total duration
  const totalDuration = latestRun?.completed_at && latestRun?.started_at
    ? new Date(latestRun.completed_at).getTime() - new Date(latestRun.started_at).getTime()
    : null;

  return (
    <div className="space-y-4">
      {/* Header: Status + Stats */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Status Bar */}
        <div className={`px-5 py-3 ${isRunning ? "bg-blue-50" : latestRun?.status === "success" ? "bg-emerald-50" : latestRun?.status === "failed" ? "bg-red-50" : "bg-slate-50"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className={`block h-3 w-3 rounded-full ${runStatus.dot}`} />
                {runStatus.pulse && (
                  <span className={`absolute inset-0 h-3 w-3 animate-ping rounded-full ${runStatus.dot} opacity-40`} />
                )}
              </div>
              <div>
                <span className={`text-sm font-bold ${runStatus.color}`}>{runStatus.label}</span>
                {isRunning && elapsedText && (
                  <span className="ml-2 text-xs text-blue-600 font-medium">{elapsedText} 経過</span>
                )}
                {!isRunning && latestRun?.started_at && (
                  <span className="ml-2 text-xs text-slate-500">
                    最終: {formatDateTime(latestRun.started_at)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {totalDuration !== null && !isRunning && (
                <span className="text-xs text-slate-500">
                  所要: {formatDuration(totalDuration)}
                </span>
              )}
              {latestRun?.type && (
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                  {latestRun.type === "daily" ? "日次" : latestRun.type === "pdca" ? "PDCA" : "手動"}
                </span>
              )}
              <span className="text-[10px] text-slate-400" title={`最終更新: ${lastUpdated.toLocaleTimeString("ja-JP")}`}>
                {isPolling && <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 mr-1" />}
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 divide-x divide-slate-100">
          <div className="px-4 py-3 text-center">
            <p className="text-xl font-bold text-slate-800">{stats.totalArticles}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">総記事数</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xl font-bold text-slate-800">{stats.totalPipelineRuns}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">総実行数</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className={`text-xl font-bold ${stats.successRate >= 80 ? "text-emerald-600" : stats.successRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {stats.successRate}%
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">成功率</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className={`text-xl font-bold ${stats.avgComplianceScore >= 80 ? "text-emerald-600" : stats.avgComplianceScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {stats.avgComplianceScore}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">コンプラスコア</p>
          </div>
        </div>
      </div>

      {/* Progress + Steps */}
      {steps.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">
              {isRunning ? "実行中のパイプライン" : "最新の実行結果"}
            </h3>
            {latestRun?.error && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {latestRun.error}
              </span>
            )}
          </div>

          <StepProgressBar steps={steps} />

          <div className="mt-4">
            <CompactTimeline steps={steps} />
          </div>
        </div>
      )}
    </div>
  );
}
