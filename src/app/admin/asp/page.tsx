"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import type { AspName, AspProgram } from "@/types/asp-config";
import type { ContentCategory } from "@/types/content";

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const ASP_DISPLAY_NAMES: Record<AspName, string> = {
  afb: "afb",
  a8: "A8.net",
  accesstrade: "アクセストレード",
  valuecommerce: "バリューコマース",
  felmat: "Felmat",
  moshimo: "もしもアフィリエイト",
};

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  aga: "AGA治療",
  "hair-removal": "医療脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
  column: "コラム",
};

// ------------------------------------------------------------------
// Auth helper
// ------------------------------------------------------------------

function getApiKey(): string {
  // 1. sessionStorage (set via /admin/login page)
  if (typeof window !== "undefined") {
    const sessionKey = sessionStorage.getItem("adminApiKey");
    if (sessionKey) return sessionKey;
  }
  // 2. NEXT_PUBLIC env var (Vercel public env)
  if (process.env.NEXT_PUBLIC_ADMIN_API_KEY) {
    return process.env.NEXT_PUBLIC_ADMIN_API_KEY;
  }
  return "";
}

// ------------------------------------------------------------------
// API helpers
// ------------------------------------------------------------------

interface FetchProgramsResponse {
  programs: AspProgram[];
  total: number;
}

async function fetchPrograms(): Promise<FetchProgramsResponse> {
  const apiKey = getApiKey();
  const res = await fetch("/api/admin/asp?active=false&limit=200", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json();
}

async function updateProgram(
  id: string,
  updates: Partial<Pick<AspProgram, "itpSupport" | "isActive">>
): Promise<AspProgram> {
  const apiKey = getApiKey();
  const res = await fetch(`/api/admin/asp/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.program;
}

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function AdminAspPage() {
  const [filterAsp, setFilterAsp] = useState<AspName | "all">("all");
  const [filterCategory, setFilterCategory] = useState<ContentCategory | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [programs, setPrograms] = useState<AspProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Fetch programs on mount
  const loadPrograms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPrograms();
      setPrograms(data.programs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const filteredPrograms = programs.filter((p) => {
    if (filterAsp !== "all" && p.aspName !== filterAsp) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterActive === "active" && !p.isActive) return false;
    if (filterActive === "inactive" && p.isActive) return false;
    return true;
  });

  const handleToggleItp = async (id: string) => {
    setUpdateError(null);
    const program = programs.find((p) => p.id === id);
    if (!program) return;

    const newValue = !program.itpSupport;

    // Optimistic update
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, itpSupport: newValue } : p
      )
    );

    try {
      await updateProgram(id, { itpSupport: newValue });
    } catch (err) {
      // Revert on error
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, itpSupport: !newValue } : p
        )
      );
      setUpdateError(
        `ITP設定の更新に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`
      );
    }
  };

  const handleToggleActive = async (id: string) => {
    setUpdateError(null);
    const program = programs.find((p) => p.id === id);
    if (!program) return;

    const newValue = !program.isActive;

    // Optimistic update
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isActive: newValue } : p
      )
    );

    try {
      await updateProgram(id, { isActive: newValue });
    } catch (err) {
      // Revert on error
      setPrograms((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, isActive: !newValue } : p
        )
      );
      setUpdateError(
        `有効/無効の切り替えに失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`
      );
    }
  };

  // Summary stats
  const totalPrograms = programs.length;
  const activePrograms = programs.filter((p) => p.isActive).length;
  const itpSupportCount = programs.filter((p) => p.itpSupport).length;
  const avgEpc =
    programs.length > 0
      ? programs.reduce((sum, p) => sum + (p.epc ?? 0), 0) / programs.length
      : 0;

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <>
        <AdminHeader
          title="ASPリンク管理"
          breadcrumbs={[{ label: "ASP管理" }]}
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
          title="ASPリンク管理"
          breadcrumbs={[{ label: "ASP管理" }]}
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
              onClick={loadPrograms}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              再試行
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title="ASPリンク管理"
        breadcrumbs={[{ label: "ASP管理" }]}
      />

      {/* Update error toast */}
      {updateError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">{updateError}</p>
          <button
            type="button"
            onClick={() => setUpdateError(null)}
            className="ml-4 text-sm font-medium text-red-600 hover:text-red-800"
          >
            閉じる
          </button>
        </div>
      )}

      {/* PR表記 notice */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">
              広告表示・PR表記について
            </p>
            <p className="mt-1 text-xs text-blue-700">
              ステマ規制に基づき、アフィリエイトリンクを含む全記事に「【PR】本記事には広告・アフィリエイトリンクが含まれています」のPR表記が自動挿入されます。
              ITP対応タグが有効なプログラムには各ASPの計測用スクリプトが自動で埋め込まれます。
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">全プログラム数</p>
          <p className="mt-1 text-xl font-bold text-neutral-900">{totalPrograms}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">有効</p>
          <p className="mt-1 text-xl font-bold text-green-700">{activePrograms}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">ITP対応</p>
          <p className="mt-1 text-xl font-bold text-blue-700">{itpSupportCount}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-neutral-500">平均EPC</p>
          <p className="mt-1 text-xl font-bold text-neutral-900">{Math.round(avgEpc)}円</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="filter-asp" className="mr-2 text-xs font-medium text-neutral-600">
            ASP:
          </label>
          <select
            id="filter-asp"
            value={filterAsp}
            onChange={(e) => setFilterAsp(e.target.value as AspName | "all")}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="all">すべて</option>
            {(Object.keys(ASP_DISPLAY_NAMES) as AspName[]).map((asp) => (
              <option key={asp} value={asp}>
                {ASP_DISPLAY_NAMES[asp]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-category" className="mr-2 text-xs font-medium text-neutral-600">
            カテゴリ:
          </label>
          <select
            id="filter-category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ContentCategory | "all")}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="all">すべて</option>
            {(Object.keys(CATEGORY_LABELS) as ContentCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-active" className="mr-2 text-xs font-medium text-neutral-600">
            ステータス:
          </label>
          <select
            id="filter-active"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="all">すべて</option>
            <option value="active">有効のみ</option>
            <option value="inactive">無効のみ</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-neutral-500">
          {filteredPrograms.length} 件表示
        </div>
      </div>

      {/* Programs table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 font-medium text-neutral-600">プログラム名</th>
              <th className="px-4 py-3 font-medium text-neutral-600">ASP</th>
              <th className="px-4 py-3 font-medium text-neutral-600">カテゴリ</th>
              <th className="px-4 py-3 font-medium text-neutral-600">報酬</th>
              <th className="px-4 py-3 font-medium text-neutral-600">成果条件</th>
              <th className="px-4 py-3 font-medium text-neutral-600">承認率</th>
              <th className="px-4 py-3 font-medium text-neutral-600">EPC</th>
              <th className="px-4 py-3 font-medium text-neutral-600">ITP</th>
              <th className="px-4 py-3 font-medium text-neutral-600">有効</th>
              <th className="px-4 py-3 font-medium text-neutral-600">優先度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredPrograms.map((program) => {
              const aspColor = ({
                afb: "bg-purple-100 text-purple-700",
                a8: "bg-orange-100 text-orange-700",
                accesstrade: "bg-cyan-100 text-cyan-700",
                valuecommerce: "bg-emerald-100 text-emerald-700",
                felmat: "bg-pink-100 text-pink-700",
                moshimo: "bg-teal-100 text-teal-700",
              } as Record<AspName, string>)[program.aspName];

              return (
                <tr
                  key={program.id}
                  className={`hover:bg-neutral-50 ${!program.isActive ? "opacity-60" : ""}`}
                >
                  <td className="max-w-[200px] truncate px-4 py-3 font-medium text-neutral-900">
                    <div>
                      <p className="truncate">{program.programName}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-neutral-400">
                        {program.affiliateUrl.slice(0, 40)}...
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${aspColor}`}>
                      {ASP_DISPLAY_NAMES[program.aspName]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {CATEGORY_LABELS[program.category]}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {program.rewardAmount.toLocaleString()}円
                  </td>
                  <td className="max-w-[150px] truncate px-4 py-3 text-neutral-600">
                    {program.conversionCondition}
                  </td>
                  <td className="px-4 py-3">
                    {program.approvalRate != null ? (
                      <span
                        className={`text-sm font-medium ${
                          program.approvalRate >= 80
                            ? "text-green-700"
                            : program.approvalRate >= 60
                              ? "text-yellow-700"
                              : "text-red-700"
                        }`}
                      >
                        {program.approvalRate}%
                      </span>
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {program.epc != null ? `${program.epc}円` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleItp(program.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        program.itpSupport ? "bg-blue-500" : "bg-neutral-300"
                      }`}
                      aria-label={`ITP対応を${program.itpSupport ? "無効" : "有効"}にする`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          program.itpSupport ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(program.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        program.isActive ? "bg-green-500" : "bg-neutral-300"
                      }`}
                      aria-label={`プログラムを${program.isActive ? "無効" : "有効"}にする`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          program.isActive ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        program.priority === 1
                          ? "bg-yellow-100 text-yellow-800"
                          : program.priority === 2
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-neutral-50 text-neutral-400"
                      }`}
                    >
                      {program.priority}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredPrograms.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-neutral-500">
              条件に一致するプログラムがありません
            </p>
          </div>
        )}
      </div>

      {/* Category mapping section */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-800">
          カテゴリ別マッピング設定
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CATEGORY_LABELS) as ContentCategory[])
            .filter((cat) => cat !== "column")
            .map((category) => {
              const categoryPrograms = programs.filter(
                (p) => p.category === category && p.isActive
              );
              const avgApproval =
                categoryPrograms.length > 0
                  ? Math.round(
                      categoryPrograms.reduce(
                        (sum, p) => sum + (p.approvalRate ?? 0),
                        0
                      ) / categoryPrograms.length
                    )
                  : 0;
              const totalReward = categoryPrograms.reduce(
                (sum, p) => sum + p.rewardAmount,
                0
              );

              return (
                <div
                  key={category}
                  className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-800">
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {categoryPrograms.length}件
                    </span>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">有効プログラム</dt>
                      <dd className="font-medium text-neutral-900">
                        {categoryPrograms.length}件
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">平均承認率</dt>
                      <dd
                        className={`font-medium ${
                          avgApproval >= 80
                            ? "text-green-700"
                            : avgApproval >= 60
                              ? "text-yellow-700"
                              : "text-red-700"
                        }`}
                      >
                        {avgApproval}%
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">合計報酬</dt>
                      <dd className="font-medium text-neutral-900">
                        {totalReward.toLocaleString()}円
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">ITP対応率</dt>
                      <dd className="font-medium text-blue-700">
                        {categoryPrograms.length > 0
                          ? Math.round(
                              (categoryPrograms.filter((p) => p.itpSupport)
                                .length /
                                categoryPrograms.length) *
                                100
                            )
                          : 0}
                        %
                      </dd>
                    </div>
                  </dl>

                  {/* Programs list */}
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <ul className="space-y-1">
                      {categoryPrograms
                        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
                        .map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="truncate text-neutral-600">
                              {p.programName}
                            </span>
                            <span className="ml-2 shrink-0 font-medium text-neutral-800">
                              {p.rewardAmount.toLocaleString()}円
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
