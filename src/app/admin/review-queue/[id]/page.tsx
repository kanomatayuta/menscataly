"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type {
  ReviewStatus,
  ReviewComment,
  ComplianceScoreBreakdown,
} from "@/types/admin";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface ReviewQueueDetail {
  id: string;
  articleId: string;
  title: string;
  slug: string;
  complianceScore: number;
  eeatScore: number;
  violationCount: number;
  violations: string[];
  status: ReviewStatus;
  createdAt: string;
  complianceBreakdown: ComplianceScoreBreakdown;
  reviewHistory: ReviewComment[];
}

// ------------------------------------------------------------------
// Score ring
// ------------------------------------------------------------------

function ScoreRing({
  score,
  label,
  size = 56,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color =
    score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-xs font-bold"
          fill={color}
        >
          {score}
        </text>
      </svg>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

// ------------------------------------------------------------------
// Action icon helpers
// ------------------------------------------------------------------

function actionIcon(action: ReviewComment["action"]): React.ReactNode {
  switch (action) {
    case "approve":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-4 w-4 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      );
    case "reject":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-4 w-4 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
      );
    case "revision":
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-4 w-4 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
      );
    case "comment":
    default:
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
          <svg
            className="h-4 w-4 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
      );
  }
}

const ACTION_LABELS: Record<ReviewComment["action"], string> = {
  approve: "承認",
  reject: "却下",
  revision: "修正依頼",
  comment: "コメント",
};

// ------------------------------------------------------------------
// Mock data
// ------------------------------------------------------------------

const MOCK_DETAILS: Record<string, ReviewQueueDetail> = {
  "rq-1": {
    id: "rq-1",
    articleId: "art-1",
    title: "AGA治療の基礎知識 -- 原因・治療法・費用を徹底解説",
    slug: "aga-basic-guide",
    complianceScore: 96,
    eeatScore: 94,
    violationCount: 0,
    violations: [],
    status: "approved",
    createdAt: "2026-03-01T06:30:00+09:00",
    complianceBreakdown: { yakkinhou: 98, keihinhou: 95, sutema: 96, eeat: 94 },
    reviewHistory: [
      {
        id: "rc-1",
        author: "admin",
        content: "薬機法チェック完了。問題なし。E-E-A-T要件も満たしています。",
        action: "approve",
        createdAt: "2026-03-01T10:00:00+09:00",
      },
    ],
  },
  "rq-2": {
    id: "rq-2",
    articleId: "art-2",
    title: "メンズ医療脱毛おすすめクリニック比較2026",
    slug: "mens-hair-removal-clinics-2026",
    complianceScore: 91,
    eeatScore: 90,
    violationCount: 0,
    violations: [],
    status: "pending",
    createdAt: "2026-03-02T06:30:00+09:00",
    complianceBreakdown: { yakkinhou: 92, keihinhou: 88, sutema: 95, eeat: 90 },
    reviewHistory: [],
  },
  "rq-3": {
    id: "rq-3",
    articleId: "art-3",
    title: "ED治療薬の種類と効果 -- バイアグラ・シアリス・レビトラ",
    slug: "ed-medication-comparison",
    complianceScore: 55,
    eeatScore: 62,
    violationCount: 3,
    violations: [
      "「確実に効果がある」- 薬機法NG表現",
      "「副作用なし」- 薬機法NG表現",
      "「業界最安値」- 景表法NG表現",
    ],
    status: "rejected",
    createdAt: "2026-03-02T06:35:00+09:00",
    complianceBreakdown: { yakkinhou: 45, keihinhou: 52, sutema: 70, eeat: 55 },
    reviewHistory: [
      {
        id: "rc-2",
        author: "admin",
        content:
          "薬機法スコアが基準値を下回っています。NG表現が3件検出されました。修正してください。",
        action: "reject",
        createdAt: "2026-03-02T11:00:00+09:00",
      },
    ],
  },
  "rq-5": {
    id: "rq-5",
    articleId: "art-5",
    title: "フィナステリドとデュタステリドの違い -- 効果・副作用・選び方",
    slug: "finasteride-vs-dutasteride",
    complianceScore: 72,
    eeatScore: 68,
    violationCount: 2,
    violations: [
      "「副作用のリスクがゼロ」- 薬機法NG表現",
      "監修者情報が不十分 - E-E-A-T要件",
    ],
    status: "revision",
    createdAt: "2026-03-03T06:35:00+09:00",
    complianceBreakdown: { yakkinhou: 70, keihinhou: 75, sutema: 80, eeat: 62 },
    reviewHistory: [
      {
        id: "rc-5",
        author: "admin",
        content:
          "E-E-A-Tスコアが低めです。監修者情報と参考文献を追加してください。薬機法スコアも改善が必要です。",
        action: "revision",
        createdAt: "2026-03-03T09:00:00+09:00",
      },
    ],
  },
};

// ------------------------------------------------------------------
// Date formatter
// ------------------------------------------------------------------

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function ReviewQueueDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [detail, setDetail] = useState<ReviewQueueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/review-queue/${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ReviewQueueDetail;
      setDetail(json);
    } catch {
      // API未接続時はモックデータにフォールバック
      setDetail(MOCK_DETAILS[id] ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const handleAction = async (action: "approve" | "reject" | "revision") => {
    if (!comment.trim() && action !== "approve") {
      setActionError("コメントを入力してください");
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const articleId = detail?.articleId ?? id;
      const res = await fetch(
        `/api/admin/articles/${encodeURIComponent(articleId)}/review`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            comment: comment.trim() || `${ACTION_LABELS[action]}しました`,
          }),
        },
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error((errBody as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setActionSuccess(`${ACTION_LABELS[action]}が完了しました`);
      setComment("");

      // Refresh detail data
      await fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "アクションの実行に失敗しました",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <>
        <AdminHeader
          title="レビュー詳細"
          breadcrumbs={[
            { label: "レビューキュー", href: "/admin/review-queue" },
            { label: "読み込み中..." },
          ]}
        />
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </>
    );
  }

  // Not found
  if (!detail) {
    return (
      <>
        <AdminHeader
          title="レビューが見つかりません"
          breadcrumbs={[
            { label: "レビューキュー", href: "/admin/review-queue" },
            { label: "Not Found" },
          ]}
        />
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-500">
            ID &quot;{id}&quot; のレビューは見つかりませんでした。
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin/review-queue")}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            一覧に戻る
          </button>
        </div>
      </>
    );
  }

  const { complianceBreakdown } = detail;

  return (
    <>
      <AdminHeader
        title="レビュー詳細"
        breadcrumbs={[
          { label: "レビューキュー", href: "/admin/review-queue" },
          { label: detail.title },
        ]}
      />

      {/* Article info card */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-900">{detail.title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              slug: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{detail.slug}</code>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={detail.status} size="md" />
              <span className="text-xs text-slate-400">
                作成: {formatDateTime(detail.createdAt)}
              </span>
            </div>
          </div>

          {/* Score rings */}
          <div className="flex shrink-0 gap-4">
            <ScoreRing score={detail.complianceScore} label="コンプラ" />
            <ScoreRing score={detail.eeatScore} label="E-E-A-T" />
          </div>
        </div>

        {/* Compliance breakdown */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            { key: "yakkinhou" as const, label: "薬機法" },
            { key: "keihinhou" as const, label: "景表法" },
            { key: "sutema" as const, label: "ステマ規制" },
            { key: "eeat" as const, label: "E-E-A-T" },
          ]).map(({ key, label }) => {
            const score = complianceBreakdown[key];
            const barColor =
              score >= 80
                ? "bg-green-500"
                : score >= 60
                  ? "bg-yellow-500"
                  : "bg-red-500";
            return (
              <div key={key} className="rounded-md bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600">
                    {label}
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {score}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-200">
                  <div
                    className={`h-1.5 rounded-full ${barColor}`}
                    style={{ width: `${Math.min(100, score)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Violations */}
        {detail.violations.length > 0 && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-red-800">
              違反事項 ({detail.violationCount}件)
            </h3>
            <ul className="space-y-1">
              {detail.violations.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  {v}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview link */}
        <div className="mt-4">
          <Link
            href={`/admin/articles/${detail.articleId}/preview`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            プレビューを表示
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Review history (timeline) */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">
            レビュー履歴
          </h3>
          {detail.reviewHistory.length === 0 ? (
            <p className="text-sm text-slate-400">
              レビュー履歴はまだありません
            </p>
          ) : (
            <div className="space-y-4">
              {detail.reviewHistory.map((entry, index) => (
                <div key={entry.id} className="flex gap-3">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    {actionIcon(entry.action)}
                    {index < detail.reviewHistory.length - 1 && (
                      <div className="mt-1 w-px flex-1 bg-slate-200" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1 pb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {entry.author}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {ACTION_LABELS[entry.action]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {entry.content}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action panel */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">
            レビューアクション
          </h3>

          {/* Comment input */}
          <label className="mb-1 block text-xs font-medium text-slate-600">
            コメント
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="レビューコメントを入力..."
            rows={4}
            className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={submitting}
          />

          {/* Error / Success messages */}
          {actionError && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {actionSuccess}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleAction("approve")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              承認
            </button>

            <button
              type="button"
              onClick={() => void handleAction("revision")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-yellow-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              修正依頼
            </button>

            <button
              type="button"
              onClick={() => void handleAction("reject")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              却下
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
