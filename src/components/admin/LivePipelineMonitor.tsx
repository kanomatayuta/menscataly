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

interface TodayActivity {
  articlesGenerated: number;
  articlesRewritten: number;
  complianceViolations: number;
  alertsFired: number;
}

// ============================================================
// Status Config
// ============================================================

const STEP_STATUS: Record<StepStatus, { icon: string; color: string; bg: string; ring: string }> = {
  pending: { icon: "\u25CB", color: "text-slate-400", bg: "bg-slate-100", ring: "" },
  running: { icon: "\u25CF", color: "text-blue-600", bg: "bg-blue-100", ring: "ring-2 ring-blue-400 ring-offset-1" },
  success: { icon: "\u2713", color: "text-emerald-600", bg: "bg-emerald-100", ring: "" },
  failed: { icon: "\u2715", color: "text-red-600", bg: "bg-red-100", ring: "" },
  skipped: { icon: "\u2013", color: "text-slate-400", bg: "bg-slate-100", ring: "" },
};

const RUN_STATUS: Record<PipelineStatus, { label: string; color: string; dot: string; pulse: boolean }> = {
  idle: { label: "\u5F85\u6A5F\u4E2D", color: "text-slate-600", dot: "bg-slate-400", pulse: false },
  running: { label: "\u5B9F\u884C\u4E2D", color: "text-blue-700", dot: "bg-blue-500", pulse: true },
  success: { label: "\u6210\u529F", color: "text-emerald-700", dot: "bg-emerald-500", pulse: false },
  failed: { label: "\u5931\u6557", color: "text-red-700", dot: "bg-red-500", pulse: false },
  partial: { label: "\u4E00\u90E8\u5931\u6557", color: "text-amber-700", dot: "bg-amber-500", pulse: false },
};

const STATUS_DOT: Record<PipelineStatus, string> = {
  idle: "bg-slate-400",
  running: "bg-blue-500",
  success: "bg-emerald-500",
  failed: "bg-red-500",
  partial: "bg-amber-500",
};

// ============================================================
// Helpers
// ============================================================

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}\u79D2`;
  return `${Math.floor(s / 60)}\u5206${s % 60}\u79D2`;
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
  if (s < 60) return `${s}\u79D2`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}\u5206${s % 60}\u79D2`;
  const h = Math.floor(m / 60);
  return `${h}\u6642\u9593${m % 60}\u5206`;
}

function getNextRunTime(targetHour: number): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const target = new Date(jst);
  target.setHours(targetHour, 0, 0, 0);
  if (target <= jst) target.setDate(target.getDate() + 1);
  const utc = new Date(target.getTime() - 9 * 60 * 60 * 1000);
  return utc.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
}

// ============================================================
// Step Progress Bar
// ============================================================

function StepProgressBar({ steps }: { steps: StepLog[] }) {
  if (steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.status === "success").length;
  const failedCount = steps.filter((s) => s.status === "failed").length;
  const runningCount = steps.filter((s) => s.status === "running").length;
  const total = steps.length;
  const pct = Math.round(((completedCount + failedCount) / total) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{completedCount}/{total} \u5B8C\u4E86{failedCount > 0 ? ` (${failedCount}\u5931\u6557)` : ""}</span>
        <span className="font-medium">{runningCount > 0 ? `${pct}%` : pct === 100 ? "\u5B8C\u4E86" : `${pct}%`}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full flex transition-all duration-500">
          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${(completedCount / total) * 100}%` }} />
          {failedCount > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${(failedCount / total) * 100}%` }} />}
          {runningCount > 0 && <div className="bg-blue-500 animate-pulse transition-all duration-500" style={{ width: `${(runningCount / total) * 100}%` }} />}
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
    <div className="space-y-0.5">
      {steps.map((step, i) => {
        const sc = STEP_STATUS[step.status];
        const isRunning = step.status === "running";
        return (
          <div
            key={step.stepName}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-all ${
              isRunning ? "bg-blue-50 border border-blue-200" : "hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-1.5 flex-shrink-0 w-7">
              <span className="text-[10px] text-slate-400 w-3">{i + 1}</span>
              <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${sc.bg} ${sc.color} ${sc.ring}`}>
                {isRunning ? (
                  <div className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                ) : (
                  sc.icon
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${isRunning ? "text-blue-800" : "text-slate-700"}`}>
                {step.stepName}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-slate-500">
              {isRunning && step.startedAt && (
                <span className="text-blue-600 font-medium animate-pulse">{getElapsedSince(step.startedAt)}</span>
              )}
              {step.status === "success" && <span className="text-emerald-600">{formatDuration(step.durationMs)}</span>}
              {step.status === "failed" && <span className="text-red-600">{formatDuration(step.durationMs)}</span>}
              {step.startedAt && !isRunning && <span>{formatTime(step.startedAt)}</span>}
            </div>
            {step.error && (
              <span className="text-[10px] text-red-500 truncate max-w-[150px]" title={step.error}>{step.error}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Mini Pipeline Status (daily / pdca)
// ============================================================

function MiniPipelineStatus({ run, label }: { run: PipelineRunData | undefined; label: string }) {
  if (!run) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="block h-2 w-2 rounded-full bg-slate-300" />
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-[10px] text-slate-400 ml-auto">\u672A\u5B9F\u884C</span>
      </div>
    );
  }

  const durationMs = run.completed_at
    ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
    : null;

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className={`block h-2 w-2 rounded-full ${STATUS_DOT[run.status]}`} />
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <span className="text-[10px] text-slate-500 ml-auto">
        {formatDateTime(run.started_at)}
        {durationMs !== null && <span className="ml-1.5 text-slate-400">({formatDuration(durationMs)})</span>}
      </span>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

interface LivePipelineMonitorProps {
  initialRuns: PipelineRunData[];
  initialStats: CumulativeStats;
  todayActivity?: TodayActivity;
}

export function LivePipelineMonitor({ initialRuns, initialStats, todayActivity }: LivePipelineMonitorProps) {
  const [runs, setRuns] = useState<PipelineRunData[]>(initialRuns);
  const [stats, setStats] = useState<CumulativeStats>(initialStats);
  const [isPolling, setIsPolling] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [elapsedText, setElapsedText] = useState("");
  const [forceFastPoll, setForceFastPoll] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fastPollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const latestRun = runs[0];
  const steps = Array.isArray(latestRun?.steps_json) ? latestRun.steps_json : [];
  const isRunning = latestRun?.status === "running";
  const runStatus = latestRun ? RUN_STATUS[latestRun.status] : RUN_STATUS.idle;

  const lastDaily = runs.find((r) => r.type === "daily");
  const lastPdca = runs.find((r) => r.type === "pdca");

  const fetchData = useCallback(async () => {
    setIsFetching(true);
    try {
      const res = await fetch("/api/pipeline/status", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.runs) setRuns(data.runs);
      if (data.stats) setStats(data.stats);
      setLastUpdated(new Date());
    } catch {
      // Silently fail polling
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Listen for pipeline-triggered event from AutomationDashboard
  useEffect(() => {
    const handleTriggered = () => {
      // Immediately fetch, then force fast polling for 2 minutes
      fetchData();
      setForceFastPoll(true);
      clearTimeout(fastPollTimerRef.current);
      fastPollTimerRef.current = setTimeout(() => setForceFastPoll(false), 120000);
    };
    window.addEventListener("pipeline-triggered", handleTriggered);
    return () => {
      window.removeEventListener("pipeline-triggered", handleTriggered);
      clearTimeout(fastPollTimerRef.current);
    };
  }, [fetchData]);

  // Auto-poll: 3s when running or force-fast, 30s otherwise
  useEffect(() => {
    clearInterval(pollingRef.current);
    const interval = (isRunning || forceFastPoll) ? 3000 : 30000;
    setIsPolling(true);
    pollingRef.current = setInterval(fetchData, interval);
    return () => clearInterval(pollingRef.current);
  }, [isRunning, forceFastPoll, fetchData]);

  // Stop force-fast-poll once we detect running state (natural fast poll takes over)
  useEffect(() => {
    if (isRunning && forceFastPoll) {
      setForceFastPoll(false);
      clearTimeout(fastPollTimerRef.current);
    }
  }, [isRunning, forceFastPoll]);

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

  const totalDuration = latestRun?.completed_at && latestRun?.started_at
    ? new Date(latestRun.completed_at).getTime() - new Date(latestRun.started_at).getTime()
    : null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Status Bar */}
        <div className={`px-4 py-2.5 ${isRunning || forceFastPoll ? "bg-blue-50" : latestRun?.status === "success" ? "bg-emerald-50" : latestRun?.status === "failed" ? "bg-red-50" : "bg-slate-50"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <span className={`block h-2.5 w-2.5 rounded-full ${runStatus.dot}`} />
                {runStatus.pulse && (
                  <span className={`absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full ${runStatus.dot} opacity-40`} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${runStatus.color}`}>{runStatus.label}</span>
                {isRunning && elapsedText && (
                  <span className="text-xs text-blue-600 font-medium">{elapsedText} 経過</span>
                )}
                {!isRunning && forceFastPoll && (
                  <span className="text-xs text-blue-600 font-medium animate-pulse flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
                    パイプライン起動中...
                  </span>
                )}
                {!isRunning && !forceFastPoll && latestRun?.started_at && (
                  <span className="text-xs text-slate-500">最終: {formatDateTime(latestRun.started_at)}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {totalDuration !== null && !isRunning && (
                <span className="text-xs text-slate-500">\u6240\u8981: {formatDuration(totalDuration)}</span>
              )}
              {latestRun?.type && (
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200">
                  {latestRun.type === "daily" ? "\u65E5\u6B21" : latestRun.type === "pdca" ? "PDCA" : "\u624B\u52D5"}
                </span>
              )}
              <span className="text-[10px] text-slate-400">
                \u6B21\u56DE {getNextRunTime(6)}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1" title={`最終更新: ${lastUpdated.toLocaleTimeString("ja-JP")}`}>
                {isFetching ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-blue-500" />
                ) : isPolling ? (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                ) : null}
                LIVE
              </span>
            </div>
          </div>
        </div>

        {/* Daily / PDCA mini status */}
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
          <MiniPipelineStatus run={lastDaily} label="\u65E5\u6B21 06:00" />
          <MiniPipelineStatus run={lastPdca} label="PDCA 23:00" />
        </div>

        {/* Stats Grid - Cumulative */}
        <div className="grid grid-cols-4 divide-x divide-slate-100">
          <div className="px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-slate-800">{stats.totalArticles}</p>
            <p className="text-[10px] text-slate-500">\u7DCF\u8A18\u4E8B\u6570</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="text-lg font-bold text-slate-800">{stats.totalPipelineRuns}</p>
            <p className="text-[10px] text-slate-500">\u7DCF\u5B9F\u884C\u6570</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className={`text-lg font-bold ${stats.successRate >= 80 ? "text-emerald-600" : stats.successRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
              {stats.successRate}%
            </p>
            <p className="text-[10px] text-slate-500">\u6210\u529F\u7387</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className={`text-lg font-bold ${stats.avgComplianceScore >= 80 ? "text-emerald-600" : stats.avgComplianceScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {stats.avgComplianceScore}
            </p>
            <p className="text-[10px] text-slate-500">\u30B3\u30F3\u30D7\u30E9\u30B9\u30B3\u30A2</p>
          </div>
        </div>

        {/* Stats Grid - Today */}
        {todayActivity && (
          <div className="grid grid-cols-4 divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50">
            <div className="px-3 py-2 text-center">
              <p className={`text-sm font-bold ${todayActivity.articlesGenerated > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                {todayActivity.articlesGenerated}
              </p>
              <p className="text-[10px] text-slate-500">\u672C\u65E5\u751F\u6210</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className={`text-sm font-bold ${todayActivity.articlesRewritten > 0 ? "text-blue-600" : "text-slate-400"}`}>
                {todayActivity.articlesRewritten}
              </p>
              <p className="text-[10px] text-slate-500">\u30EA\u30E9\u30A4\u30C8</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className={`text-sm font-bold ${todayActivity.complianceViolations > 0 ? "text-red-600" : "text-slate-400"}`}>
                {todayActivity.complianceViolations}
              </p>
              <p className="text-[10px] text-slate-500">\u30B3\u30F3\u30D7\u30E9\u9055\u53CD</p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className={`text-sm font-bold ${todayActivity.alertsFired > 0 ? "text-amber-600" : "text-slate-400"}`}>
                {todayActivity.alertsFired}
              </p>
              <p className="text-[10px] text-slate-500">\u30A2\u30E9\u30FC\u30C8</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress + Steps */}
      {steps.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {isRunning ? "\u5B9F\u884C\u4E2D\u306E\u30D1\u30A4\u30D7\u30E9\u30A4\u30F3" : "\u6700\u65B0\u306E\u5B9F\u884C\u7D50\u679C"}
            </h3>
            {latestRun?.error && (
              <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {latestRun.error}
              </span>
            )}
          </div>
          <StepProgressBar steps={steps} />
          <div className="mt-3">
            <CompactTimeline steps={steps} />
          </div>
        </div>
      )}
    </div>
  );
}
