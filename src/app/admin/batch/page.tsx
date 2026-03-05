"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { BatchProgressBar } from "@/components/admin/BatchProgressBar";
import type { BatchJobStatus } from "@/types/admin";
import type { KeywordTarget, KeywordPriority } from "@/types/batch-generation";
import type { ContentCategory } from "@/types/content";
import type { KeywordEntry } from "@/lib/content/keyword-research";
import type { BatchJobItem } from "@/app/api/admin/batch-jobs/route";

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  aga: "AGA治療",
  "hair-removal": "医療脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
  column: "コラム",
};

const PRIORITY_LABELS: Record<KeywordPriority, { label: string; color: string }> = {
  high: { label: "高", color: "bg-red-100 text-red-700" },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-700" },
  low: { label: "低", color: "bg-neutral-100 text-neutral-600" },
};

const COST_PER_ARTICLE_USD = 0.28;

// ------------------------------------------------------------------
// Mock data (Supabase/API未設定時のフォールバック)
// ------------------------------------------------------------------

const MOCK_KEYWORDS: KeywordTarget[] = [
  {
    id: "kw-001",
    keyword: "AGA治療 費用",
    subKeywords: ["AGA 値段", "AGA 相場"],
    category: "aga",
    targetAudience: "30代男性、AGA初期",
    tone: "informative",
    targetLength: 4000,
    priority: "high",
    estimatedVolume: 12000,
    competitionScore: 72,
  },
  {
    id: "kw-002",
    keyword: "フィナステリド 効果",
    subKeywords: ["プロペシア 効果", "フィナステリド 副作用"],
    category: "aga",
    targetAudience: "20-40代男性",
    tone: "informative",
    targetLength: 3500,
    priority: "high",
    estimatedVolume: 8500,
    competitionScore: 65,
  },
  {
    id: "kw-003",
    keyword: "メンズ脱毛 おすすめ",
    subKeywords: ["メンズ脱毛 ランキング", "医療脱毛 メンズ"],
    category: "hair-removal",
    targetAudience: "20代男性",
    tone: "comparison",
    targetLength: 5000,
    priority: "high",
    estimatedVolume: 22000,
    competitionScore: 85,
  },
  {
    id: "kw-004",
    keyword: "ヒゲ脱毛 痛み",
    subKeywords: ["髭脱毛 痛い", "ヒゲ脱毛 麻酔"],
    category: "hair-removal",
    targetAudience: "20-30代男性",
    tone: "friendly",
    targetLength: 3000,
    priority: "medium",
    estimatedVolume: 6500,
    competitionScore: 45,
  },
  {
    id: "kw-005",
    keyword: "メンズスキンケア 順番",
    subKeywords: ["メンズ 化粧水 使い方", "メンズ 洗顔 おすすめ"],
    category: "skincare",
    targetAudience: "20代男性、初心者",
    tone: "friendly",
    targetLength: 3000,
    priority: "medium",
    estimatedVolume: 9800,
    competitionScore: 38,
  },
  {
    id: "kw-006",
    keyword: "ED治療 オンライン",
    subKeywords: ["ED治療 ネット診療", "ED薬 通販"],
    category: "ed",
    targetAudience: "30-50代男性",
    tone: "professional",
    targetLength: 3500,
    priority: "high",
    estimatedVolume: 5200,
    competitionScore: 55,
  },
  {
    id: "kw-007",
    keyword: "バイアグラ ジェネリック",
    subKeywords: ["シルデナフィル 価格", "バイアグラ 安い"],
    category: "ed",
    targetAudience: "30-50代男性",
    tone: "informative",
    targetLength: 3000,
    priority: "medium",
    estimatedVolume: 4800,
    competitionScore: 48,
  },
  {
    id: "kw-008",
    keyword: "メンズ 毛穴 黒ずみ",
    subKeywords: ["男 毛穴 ケア", "いちご鼻 メンズ"],
    category: "skincare",
    targetAudience: "20代男性",
    tone: "friendly",
    targetLength: 2500,
    priority: "low",
    estimatedVolume: 7200,
    competitionScore: 32,
  },
  {
    id: "kw-009",
    keyword: "AGA クリニック 選び方",
    subKeywords: ["AGAクリニック おすすめ", "AGA 病院"],
    category: "aga",
    targetAudience: "30代男性",
    tone: "comparison",
    targetLength: 4500,
    priority: "medium",
    estimatedVolume: 6800,
    competitionScore: 70,
  },
  {
    id: "kw-010",
    keyword: "VIO脱毛 メンズ",
    subKeywords: ["メンズVIO おすすめ", "VIO脱毛 恥ずかしい"],
    category: "hair-removal",
    targetAudience: "20-30代男性",
    tone: "friendly",
    targetLength: 3000,
    priority: "low",
    estimatedVolume: 11000,
    competitionScore: 58,
  },
];

interface BatchHistoryItem {
  id: string;
  status: BatchJobStatus;
  totalKeywords: number;
  completedCount: number;
  failedCount: number;
  startedAt: string;
  completedAt: string | null;
  totalCostUsd: number;
  keywords: string[];
}

const MOCK_HISTORY: BatchHistoryItem[] = [
  {
    id: "batch-001",
    status: "completed",
    totalKeywords: 10,
    completedCount: 10,
    failedCount: 0,
    startedAt: "2026-03-01T14:00:00+09:00",
    completedAt: "2026-03-01T15:30:00+09:00",
    totalCostUsd: 2.85,
    keywords: ["AGA治療 費用", "フィナステリド 効果", "メンズ脱毛 おすすめ"],
  },
  {
    id: "batch-002",
    status: "completed",
    totalKeywords: 15,
    completedCount: 13,
    failedCount: 2,
    startedAt: "2026-03-02T10:00:00+09:00",
    completedAt: "2026-03-02T11:45:00+09:00",
    totalCostUsd: 3.64,
    keywords: ["ヒゲ脱毛 痛み", "メンズスキンケア 順番", "ED治療 オンライン"],
  },
  {
    id: "batch-003",
    status: "failed",
    totalKeywords: 5,
    completedCount: 2,
    failedCount: 3,
    startedAt: "2026-03-02T16:00:00+09:00",
    completedAt: "2026-03-02T16:20:00+09:00",
    totalCostUsd: 0.52,
    keywords: ["バイアグラ ジェネリック", "メンズ 毛穴 黒ずみ"],
  },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * KeywordEntry (API返却形式) を KeywordTarget に変換する
 */
function entryToTarget(entry: KeywordEntry): KeywordTarget {
  const difficulty = entry.difficulty ?? 50;
  let priority: KeywordPriority = "medium";
  if (difficulty >= 70) priority = "high";
  else if (difficulty <= 30) priority = "low";

  return {
    id: entry.id,
    keyword: entry.keyword,
    subKeywords: entry.relatedKeywords ?? [],
    category: entry.category,
    targetAudience: "20〜40代男性",
    tone: "informative",
    targetLength: 3000,
    priority,
    estimatedVolume: entry.searchVolume,
    competitionScore: difficulty,
  };
}

/**
 * BatchJobItem (API返却形式) を BatchHistoryItem に変換する
 */
function jobItemToHistory(item: BatchJobItem): BatchHistoryItem {
  return {
    id: item.id,
    status: item.status,
    totalKeywords: item.totalKeywords,
    completedCount: item.completedCount,
    failedCount: item.failedCount,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    totalCostUsd: item.totalCostUsd,
    keywords: [],
  };
}

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function AdminBatchPage() {
  // Data state
  const [keywords, setKeywords] = useState<KeywordTarget[]>(MOCK_KEYWORDS);
  const [history, setHistory] = useState<BatchHistoryItem[]>(MOCK_HISTORY);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Keyword selection state
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<KeywordPriority | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [complianceThreshold, setComplianceThreshold] = useState(85);
  const [dryRun, setDryRun] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");

  // Progress state
  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    status: BatchJobStatus;
    total: number;
    completed: number;
    failed: number;
    currentKeywords: string[];
    estimatedRemainingSeconds?: number;
    totalCostUsd: number;
  } | null>(null);

  // Expanded history
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const loadKeywords = useCallback(async () => {
    setIsLoadingKeywords(true);
    try {
      const res = await fetch("/api/admin/keywords?limit=200&sortBy=volume&sortOrder=desc", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const entries: KeywordEntry[] = data.keywords ?? [];
        if (entries.length > 0) {
          setKeywords(entries.map(entryToTarget));
        }
        // entries が空の場合はモックデータのまま
      }
      // API 認証エラーや失敗の場合はモックデータのまま
    } catch {
      // ネットワークエラーの場合はモックデータのまま
    } finally {
      setIsLoadingKeywords(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/batch-jobs?limit=20", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        const jobs: BatchJobItem[] = data.jobs ?? [];
        if (jobs.length > 0) {
          setHistory(jobs.map(jobItemToHistory));
        }
        // jobs が空の場合はモックデータのまま
      }
      // API 認証エラーや失敗の場合はモックデータのまま
    } catch {
      // ネットワークエラーの場合はモックデータのまま
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadKeywords();
    loadHistory();
  }, [loadKeywords, loadHistory]);

  // ------------------------------------------------------------------
  // Derived state
  // ------------------------------------------------------------------

  const filteredKeywords = keywords.filter((kw) => {
    if (categoryFilter !== "all" && kw.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && kw.priority !== priorityFilter) return false;
    if (searchQuery && !kw.keyword.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const estimatedCostUsd = selectedKeywordIds.size * COST_PER_ARTICLE_USD;
  const estimatedCostJpy = Math.round(estimatedCostUsd * 150);

  // ------------------------------------------------------------------
  // Select/deselect helpers
  // ------------------------------------------------------------------

  const toggleKeyword = (id: string) => {
    setSelectedKeywordIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedKeywordIds(new Set(filteredKeywords.map((kw) => kw.id)));
  };

  const deselectAll = () => {
    setSelectedKeywordIds(new Set());
  };

  // ------------------------------------------------------------------
  // Polling
  // ------------------------------------------------------------------

  const pollProgress = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/batch/status/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveJob({
          jobId: data.jobId,
          status: data.status,
          total: data.total ?? data.totalKeywords,
          completed: data.completed ?? data.completedCount,
          failed: data.failed ?? data.failedCount,
          currentKeywords: data.currentKeywords ?? [],
          estimatedRemainingSeconds: data.estimatedRemainingSeconds,
          totalCostUsd: data.totalCostUsd ?? 0,
        });
        if (data.status === "running" || data.status === "queued") {
          return true;
        }
        // ジョブ完了後に履歴を再取得
        await loadHistory();
      }
    } catch {
      // Polling failed
    }
    return false;
  }, [loadHistory]);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== "running" && activeJob.status !== "queued")) {
      return;
    }

    const interval = setInterval(async () => {
      const shouldContinue = await pollProgress(activeJob.jobId);
      if (!shouldContinue) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJob, pollProgress]);

  // ------------------------------------------------------------------
  // Form submit
  // ------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage("");

    if (selectedKeywordIds.size === 0) {
      setFormMessage("キーワードを1つ以上選択してください。");
      return;
    }

    setIsSubmitting(true);

    // 選択されたキーワードの詳細を取得してバッチリクエストを作成
    const selectedKeywords = keywords.filter((kw) => selectedKeywordIds.has(kw.id));

    try {
      const res = await fetch("/api/batch/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keywords: selectedKeywords,
          maxConcurrent,
          complianceThreshold,
          dryRun,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveJob({
          jobId: data.jobId,
          status: "running",
          total: selectedKeywordIds.size,
          completed: 0,
          failed: 0,
          currentKeywords: [],
          totalCostUsd: 0,
        });
        setFormMessage(
          dryRun
            ? "ドライラン開始しました。"
            : "バッチ生成を開始しました。"
        );
      } else {
        setFormMessage(`バッチ生成の開始に失敗しました (${res.status})`);
      }
    } catch {
      setFormMessage("ネットワークエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <>
      <AdminHeader
        title="バッチ記事生成"
        breadcrumbs={[{ label: "バッチ生成" }]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Keyword selection (2 cols) */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            {/* Header with filters */}
            <div className="border-b border-neutral-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-800">
                  キーワード選択
                  {isLoadingKeywords && (
                    <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-blue-600 align-middle" />
                  )}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    すべて選択
                  </button>
                  <span className="text-neutral-300">|</span>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    選択解除
                  </button>
                </div>
              </div>

              {/* Search and filters */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="キーワード検索..."
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 placeholder-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as ContentCategory | "all")}
                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="all">全カテゴリ</option>
                  {(Object.keys(CATEGORY_LABELS) as ContentCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as KeywordPriority | "all")}
                  className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                >
                  <option value="all">全優先度</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
            </div>

            {/* Keywords list */}
            <div className="max-h-[480px] overflow-y-auto divide-y divide-neutral-100">
              {filteredKeywords.map((kw) => {
                const isSelected = selectedKeywordIds.has(kw.id);
                const priorityStyle = PRIORITY_LABELS[kw.priority];

                return (
                  <label
                    key={kw.id}
                    className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                      isSelected ? "bg-blue-50/50" : "hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleKeyword(kw.id)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          {kw.keyword}
                        </span>
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${priorityStyle.color}`}>
                          {priorityStyle.label}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                          {CATEGORY_LABELS[kw.category]}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {kw.subKeywords.map((sub) => (
                          <span
                            key={sub}
                            className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                        <span>
                          検索Vol: {kw.estimatedVolume?.toLocaleString() ?? "-"}
                        </span>
                        <span>
                          競合: {kw.competitionScore ?? "-"}%
                        </span>
                        <span>
                          目標: {kw.targetLength.toLocaleString()}文字
                        </span>
                        <span className="capitalize">
                          {kw.tone}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-2">
              <p className="text-xs text-neutral-500">
                {filteredKeywords.length} 件中 {selectedKeywordIds.size} 件選択
              </p>
            </div>
          </div>
        </div>

        {/* Right: Settings + Progress */}
        <div className="space-y-6">
          {/* Generation settings */}
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-lg font-semibold text-neutral-800">
              生成設定
            </h2>

            {/* Cost estimate */}
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-700">コスト見積もり</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-bold text-amber-900">
                  ${estimatedCostUsd.toFixed(2)}
                </span>
                <span className="text-xs text-amber-600">
                  (約{estimatedCostJpy.toLocaleString()}円)
                </span>
              </div>
              <p className="mt-0.5 text-xs text-amber-600">
                {selectedKeywordIds.size} 記事 x ${COST_PER_ARTICLE_USD}/記事
              </p>
            </div>

            {/* Max concurrent */}
            <div className="mb-4">
              <label
                htmlFor="max-concurrent"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                最大同時実行数
              </label>
              <input
                id="max-concurrent"
                type="number"
                min={1}
                max={10}
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>

            {/* Compliance threshold */}
            <div className="mb-4">
              <label
                htmlFor="compliance-threshold"
                className="mb-1.5 block text-sm font-medium text-neutral-700"
              >
                コンプライアンス閾値: {complianceThreshold}%
              </label>
              <input
                id="compliance-threshold"
                type="range"
                min={50}
                max={100}
                step={5}
                value={complianceThreshold}
                onChange={(e) => setComplianceThreshold(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-neutral-400">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Dry run */}
            <label className="mb-4 flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              ドライラン（実際の生成なし）
            </label>

            {formMessage && (
              <p
                className={`mb-3 text-sm ${
                  formMessage.includes("失敗") || formMessage.includes("エラー") || formMessage.includes("選択")
                    ? "text-red-600"
                    : "text-green-600"
                }`}
                role="status"
              >
                {formMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || selectedKeywordIds.size === 0}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting
                ? "開始中..."
                : dryRun
                  ? `ドライラン開始 (${selectedKeywordIds.size}件)`
                  : `バッチ生成開始 (${selectedKeywordIds.size}件)`}
            </button>
          </form>

          {/* Progress */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-neutral-800">
              進捗
            </h2>
            {activeJob ? (
              <div className="space-y-3">
                <BatchProgressBar
                  completed={activeJob.completed}
                  total={activeJob.total}
                  failed={activeJob.failed}
                  status={activeJob.status}
                />

                {/* Real-time info */}
                {(activeJob.status === "running" || activeJob.status === "queued") && (
                  <div className="rounded-lg border border-neutral-200 bg-white p-4">
                    {activeJob.currentKeywords.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs font-medium text-neutral-500 mb-1">現在生成中:</p>
                        <div className="flex flex-wrap gap-1">
                          {activeJob.currentKeywords.map((kw) => (
                            <span
                              key={kw}
                              className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                            >
                              <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeJob.estimatedRemainingSeconds != null && (
                      <p className="text-xs text-neutral-500">
                        推定残り時間: {Math.ceil(activeJob.estimatedRemainingSeconds / 60)}分
                      </p>
                    )}
                    <p className="text-xs text-neutral-500">
                      コスト: ${activeJob.totalCostUsd.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
                <p className="text-sm text-neutral-500">
                  アクティブなジョブはありません
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History section - Timeline style */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-800">
          生成履歴
          {isLoadingHistory && (
            <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border border-neutral-300 border-t-blue-600 align-middle" />
          )}
        </h2>

        <div className="space-y-4">
          {history.map((job) => {
            const isExpanded = expandedHistoryId === job.id;
            const statusStyles: Record<string, { bg: string; text: string; border: string }> = {
              completed: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
              failed: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
              running: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
              queued: { bg: "bg-neutral-100", text: "text-neutral-700", border: "border-neutral-200" },
              cancelled: { bg: "bg-neutral-100", text: "text-neutral-700", border: "border-neutral-200" },
            };
            const style = statusStyles[job.status] ?? statusStyles.queued;
            const duration =
              job.completedAt
                ? Math.round(
                    (new Date(job.completedAt).getTime() -
                      new Date(job.startedAt).getTime()) /
                      60000
                  )
                : null;

            return (
              <div
                key={job.id}
                className={`rounded-lg border bg-white shadow-sm transition-all ${
                  isExpanded ? style.border : "border-neutral-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedHistoryId(isExpanded ? null : job.id)
                  }
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    {/* Timeline dot */}
                    <div
                      className={`h-3 w-3 rounded-full ${
                        job.status === "completed"
                          ? "bg-green-500"
                          : job.status === "failed"
                            ? "bg-red-500"
                            : "bg-neutral-400"
                      }`}
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-neutral-800">
                          {job.id}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style.bg} ${style.text}`}
                        >
                          {job.status === "completed" ? "完了" : job.status === "failed" ? "失敗" : job.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {new Date(job.startedAt).toLocaleString("ja-JP")}
                        {duration != null && ` (${duration}分)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-600">
                      {job.completedCount}/{job.totalKeywords} 完了
                      {job.failedCount > 0 && (
                        <span className="ml-1 text-red-600">
                          ({job.failedCount} 失敗)
                        </span>
                      )}
                    </span>
                    <span className="text-neutral-600">
                      ${job.totalCostUsd.toFixed(2)}
                    </span>
                    <svg
                      className={`h-4 w-4 text-neutral-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-neutral-100 px-5 py-4">
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <div>
                        <p className="text-xs font-medium text-neutral-500">キーワード数</p>
                        <p className="mt-0.5 font-medium text-neutral-900">{job.totalKeywords}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-neutral-500">成功</p>
                        <p className="mt-0.5 font-medium text-green-700">{job.completedCount}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-neutral-500">失敗</p>
                        <p className="mt-0.5 font-medium text-red-700">{job.failedCount}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-neutral-500">合計コスト</p>
                        <p className="mt-0.5 font-medium text-neutral-900">${job.totalCostUsd.toFixed(2)}</p>
                      </div>
                    </div>

                    {job.keywords.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-neutral-500 mb-1">対象キーワード:</p>
                        <div className="flex flex-wrap gap-1">
                          {job.keywords.map((kw) => (
                            <span
                              key={kw}
                              className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400">
                      <span>開始: {new Date(job.startedAt).toLocaleString("ja-JP")}</span>
                      {job.completedAt && (
                        <span>完了: {new Date(job.completedAt).toLocaleString("ja-JP")}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
