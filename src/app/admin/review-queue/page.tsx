"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { ReviewStatus } from "@/types/admin";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface ReviewQueueItem {
  id: string;
  title: string;
  slug: string;
  complianceScore: number;
  eeatScore: number;
  violationCount: number;
  status: ReviewStatus;
  createdAt: string;
}

interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ------------------------------------------------------------------
// Status tab config
// ------------------------------------------------------------------

type FilterTab = "all" | "pending" | "approved" | "rejected" | "revision";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "全件" },
  { key: "pending", label: "保留中" },
  { key: "approved", label: "承認済" },
  { key: "rejected", label: "却下" },
  { key: "revision", label: "修正中" },
];

// ------------------------------------------------------------------
// Score badge
// ------------------------------------------------------------------

function ScoreBadge({ score, label }: { score: number; label?: string }) {
  let bg: string;
  let text: string;
  if (score >= 80) {
    bg = "bg-green-100";
    text = "text-green-800";
  } else if (score >= 60) {
    bg = "bg-yellow-100";
    text = "text-yellow-800";
  } else {
    bg = "bg-red-100";
    text = "text-red-800";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
      title={label}
    >
      {score}
    </span>
  );
}

// ------------------------------------------------------------------
// Mock data (API未接続時のフォールバック)
// ------------------------------------------------------------------

const MOCK_ITEMS: ReviewQueueItem[] = [
  {
    id: "rq-1",
    title: "AGA治療の基礎知識 -- 原因・治療法・費用を徹底解説",
    slug: "aga-basic-guide",
    complianceScore: 96,
    eeatScore: 94,
    violationCount: 0,
    status: "approved",
    createdAt: "2026-03-01T06:30:00+09:00",
  },
  {
    id: "rq-2",
    title: "メンズ医療脱毛おすすめクリニック比較2026",
    slug: "mens-hair-removal-clinics-2026",
    complianceScore: 91,
    eeatScore: 90,
    violationCount: 0,
    status: "pending",
    createdAt: "2026-03-02T06:30:00+09:00",
  },
  {
    id: "rq-3",
    title: "ED治療薬の種類と効果 -- バイアグラ・シアリス・レビトラ",
    slug: "ed-medication-comparison",
    complianceScore: 55,
    eeatScore: 62,
    violationCount: 3,
    status: "rejected",
    createdAt: "2026-03-02T06:35:00+09:00",
  },
  {
    id: "rq-4",
    title: "メンズスキンケア入門 -- 肌タイプ別おすすめルーティン",
    slug: "mens-skincare-routine",
    complianceScore: 98,
    eeatScore: 96,
    violationCount: 0,
    status: "approved",
    createdAt: "2026-03-03T06:30:00+09:00",
  },
  {
    id: "rq-5",
    title: "フィナステリドとデュタステリドの違い -- 効果・副作用・選び方",
    slug: "finasteride-vs-dutasteride",
    complianceScore: 72,
    eeatScore: 68,
    violationCount: 2,
    status: "revision",
    createdAt: "2026-03-03T06:35:00+09:00",
  },
  {
    id: "rq-6",
    title: "ミノキシジルの効果と正しい使い方",
    slug: "minoxidil-guide",
    complianceScore: 85,
    eeatScore: 80,
    violationCount: 1,
    status: "pending",
    createdAt: "2026-03-04T06:30:00+09:00",
  },
  {
    id: "rq-7",
    title: "メンズVIO脱毛のメリット・デメリット・おすすめクリニック",
    slug: "mens-vio-hair-removal",
    complianceScore: 48,
    eeatScore: 55,
    violationCount: 5,
    status: "rejected",
    createdAt: "2026-03-04T06:35:00+09:00",
  },
  {
    id: "rq-8",
    title: "AGA治療薬の個人輸入リスクと正規ルートの選び方",
    slug: "aga-import-risk",
    complianceScore: 78,
    eeatScore: 75,
    violationCount: 1,
    status: "pending",
    createdAt: "2026-03-05T06:30:00+09:00",
  },
];

function getMockResponse(
  status: FilterTab,
  page: number,
  limit: number,
): ReviewQueueResponse {
  const filtered =
    status === "all"
      ? MOCK_ITEMS
      : MOCK_ITEMS.filter((item) => item.status === status);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);
  return { items, total, page, limit, totalPages };
}

// ------------------------------------------------------------------
// Date formatter
// ------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

const ITEMS_PER_PAGE = 10;

export default function ReviewQueuePage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (tab: FilterTab, p: number) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(p),
          limit: String(ITEMS_PER_PAGE),
        });
        if (tab !== "all") {
          params.set("status", tab);
        }

        const res = await fetch(`/api/admin/review-queue?${params.toString()}`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = (await res.json()) as ReviewQueueResponse;
        setData(json);
      } catch {
        // API未接続時はモックデータにフォールバック
        const mock = getMockResponse(tab, p, ITEMS_PER_PAGE);
        setData(mock);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchData(activeTab, page);
  }, [activeTab, page, fetchData]);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <>
      <AdminHeader
        title="レビューキュー"
        breadcrumbs={[{ label: "レビューキュー" }]}
      />

      {/* Status tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-4" aria-label="ステータスフィルター">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
              aria-current={activeTab === tab.key ? "page" : undefined}
            >
              {tab.label}
              {data && tab.key === "all" && (
                <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {data.total}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  タイトル
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  スラッグ
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  コンプラ
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  E-E-A-T
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  違反数
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ステータス
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  作成日
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data && (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="h-5 animate-pulse rounded bg-slate-200" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {data && data.items.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    該当するレビューキューはありません
                  </td>
                </tr>
              )}

              {data &&
                data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="max-w-xs truncate px-4 py-3 text-sm font-medium text-slate-900">
                      <Link
                        href={`/admin/review-queue/${item.id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {item.title}
                      </Link>
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-500">
                      {item.slug}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge
                        score={item.complianceScore}
                        label="コンプライアンススコア"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ScoreBadge
                        score={item.eeatScore}
                        label="E-E-A-Tスコア"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.violationCount > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          {item.violationCount}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">
              {data.total}件中 {(data.page - 1) * data.limit + 1}--
              {Math.min(data.page * data.limit, data.total)}件を表示
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                前へ
              </button>
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map(
                (p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      p === page
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page >= data.totalPages}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
