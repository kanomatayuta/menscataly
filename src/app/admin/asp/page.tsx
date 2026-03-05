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
// Form type
// ------------------------------------------------------------------

interface ProgramFormData {
  aspName: string;
  programName: string;
  programId: string;
  category: string;
  affiliateUrl: string;
  rewardAmount: number;
  rewardType: "fixed" | "percentage";
  approvalRate: number;
  epc: number;
  itpSupport: boolean;
  cookieDuration: number;
  isActive: boolean;
  landingPageUrl: string;
}

const EMPTY_FORM: ProgramFormData = {
  aspName: "a8",
  programName: "",
  programId: "",
  category: "aga",
  affiliateUrl: "",
  rewardAmount: 0,
  rewardType: "fixed",
  approvalRate: 0,
  epc: 0,
  itpSupport: false,
  cookieDuration: 30,
  isActive: true,
  landingPageUrl: "",
};

// ------------------------------------------------------------------
// API helpers
// ------------------------------------------------------------------

interface FetchProgramsResponse {
  programs: AspProgram[];
  total: number;
}

async function fetchPrograms(): Promise<FetchProgramsResponse> {
  const res = await fetch("/api/admin/asp?active=false&limit=200", {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiUpdateProgram(
  id: string,
  updates: Record<string, unknown>,
): Promise<AspProgram> {
  const res = await fetch(`/api/admin/asp/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.program;
}

async function apiCreateProgram(
  data: ProgramFormData,
): Promise<AspProgram> {
  const res = await fetch("/api/admin/asp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const result = await res.json();
  return result.program;
}

async function apiDeleteProgram(id: string): Promise<void> {
  const res = await fetch(`/api/admin/asp/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

// ------------------------------------------------------------------
// Modal component
// ------------------------------------------------------------------

function ProgramModal({
  isOpen,
  title,
  form,
  isSaving,
  onClose,
  onChange,
  onSave,
}: {
  isOpen: boolean;
  title: string;
  form: ProgramFormData;
  isSaving: boolean;
  onClose: () => void;
  onChange: (updates: Partial<ProgramFormData>) => void;
  onSave: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* ASP */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">ASP *</label>
              <select
                value={form.aspName}
                onChange={(e) => onChange({ aspName: e.target.value })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              >
                {(Object.keys(ASP_DISPLAY_NAMES) as AspName[]).map((asp) => (
                  <option key={asp} value={asp}>{ASP_DISPLAY_NAMES[asp]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">カテゴリ *</label>
              <select
                value={form.category}
                onChange={(e) => onChange({ category: e.target.value })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              >
                {(Object.keys(CATEGORY_LABELS) as ContentCategory[]).map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Program name */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">プログラム名 *</label>
            <input
              type="text"
              value={form.programName}
              onChange={(e) => onChange({ programName: e.target.value })}
              placeholder="例: AGAスキンクリニック 来院募集"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          {/* Program ID */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">プログラムID *</label>
            <input
              type="text"
              value={form.programId}
              onChange={(e) => onChange({ programId: e.target.value })}
              placeholder="例: 09-0717"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          {/* Affiliate URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">アフィリエイトURL *</label>
            <input
              type="url"
              value={form.affiliateUrl}
              onChange={(e) => onChange({ affiliateUrl: e.target.value })}
              placeholder="https://px.a8.net/svt/ejp?a8mat=..."
              className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          {/* Landing Page URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">LP URL *</label>
            <input
              type="url"
              value={form.landingPageUrl}
              onChange={(e) => onChange({ landingPageUrl: e.target.value })}
              placeholder="https://example.com/"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
          </div>

          {/* Reward */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">報酬額 (円)</label>
              <input
                type="number"
                value={form.rewardAmount}
                onChange={(e) => onChange({ rewardAmount: Number(e.target.value) })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">報酬タイプ</label>
              <select
                value={form.rewardType}
                onChange={(e) => onChange({ rewardType: e.target.value as "fixed" | "percentage" })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              >
                <option value="fixed">固定報酬</option>
                <option value="percentage">成果報酬 (%)</option>
              </select>
            </div>
          </div>

          {/* EPC / Approval */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">EPC (円)</label>
              <input
                type="number"
                step="0.01"
                value={form.epc}
                onChange={(e) => onChange({ epc: Number(e.target.value) })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">確定率 (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.approvalRate}
                onChange={(e) => onChange({ approvalRate: Number(e.target.value) })}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.itpSupport}
                onChange={(e) => onChange({ itpSupport: e.target.checked })}
                className="rounded border-neutral-300"
              />
              ITP対応
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => onChange({ isActive: e.target.checked })}
                className="rounded border-neutral-300"
              />
              有効
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !form.programName || !form.affiliateUrl || !form.landingPageUrl}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
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

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // Open add modal
  const handleAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalTitle("プログラム追加");
    setModalOpen(true);
  };

  // Open edit modal
  const handleEdit = (program: AspProgram) => {
    setEditingId(program.id);
    setForm({
      aspName: program.aspName,
      programName: program.programName,
      programId: program.programId ?? "",
      category: program.category,
      affiliateUrl: program.affiliateUrl,
      rewardAmount: program.rewardAmount,
      rewardType: program.rewardType ?? "fixed",
      approvalRate: program.approvalRate ?? 0,
      epc: program.epc ?? 0,
      itpSupport: program.itpSupport,
      cookieDuration: program.cookieDuration ?? 30,
      isActive: program.isActive,
      landingPageUrl: program.landingPageUrl ?? "",
    });
    setModalTitle("プログラム編集");
    setModalOpen(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    setIsSaving(true);
    setUpdateError(null);
    try {
      if (editingId) {
        await apiUpdateProgram(editingId, { ...form });
      } else {
        await apiCreateProgram(form);
      }
      setModalOpen(false);
      await loadPrograms();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    setUpdateError(null);
    try {
      await apiDeleteProgram(id);
      setDeletingId(null);
      setPrograms((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "削除に失敗しました");
      setDeletingId(null);
    }
  };

  const handleToggleItp = async (id: string) => {
    setUpdateError(null);
    const program = programs.find((p) => p.id === id);
    if (!program) return;
    const newValue = !program.itpSupport;
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, itpSupport: newValue } : p));
    try {
      await apiUpdateProgram(id, { itpSupport: newValue });
    } catch (err) {
      setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, itpSupport: !newValue } : p));
      setUpdateError(`ITP設定の更新に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
  };

  const handleToggleActive = async (id: string) => {
    setUpdateError(null);
    const program = programs.find((p) => p.id === id);
    if (!program) return;
    const newValue = !program.isActive;
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, isActive: newValue } : p));
    try {
      await apiUpdateProgram(id, { isActive: newValue });
    } catch (err) {
      setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, isActive: !newValue } : p));
      setUpdateError(`有効/無効の切り替えに失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
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

  if (isLoading) {
    return (
      <>
        <AdminHeader title="ASPリンク管理" breadcrumbs={[{ label: "ASP管理" }]} />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
            <p className="text-sm text-neutral-500">読み込み中...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AdminHeader title="ASPリンク管理" breadcrumbs={[{ label: "ASP管理" }]} />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="mb-2 text-sm font-medium text-neutral-900">データの取得に失敗しました</p>
            <p className="mb-4 text-xs text-neutral-500">{error}</p>
            <button type="button" onClick={loadPrograms} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">再試行</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader title="ASPリンク管理" breadcrumbs={[{ label: "ASP管理" }]} />

      {/* Modal */}
      <ProgramModal
        isOpen={modalOpen}
        title={modalTitle}
        form={form}
        isSaving={isSaving}
        onClose={() => setModalOpen(false)}
        onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
        onSave={handleSave}
      />

      {/* Delete confirm dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-neutral-900">プログラム削除</h3>
            <p className="mb-4 text-sm text-neutral-600">
              「{programs.find((p) => p.id === deletingId)?.programName}」を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingId(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">キャンセル</button>
              <button type="button" onClick={() => handleDelete(deletingId)} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">削除</button>
            </div>
          </div>
        </div>
      )}

      {/* Update error toast */}
      {updateError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">{updateError}</p>
          <button type="button" onClick={() => setUpdateError(null)} className="ml-4 text-sm font-medium text-red-600 hover:text-red-800">閉じる</button>
        </div>
      )}

      {/* PR表記 notice */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">広告表示・PR表記について</p>
            <p className="mt-1 text-xs text-blue-700">
              ステマ規制に基づき、アフィリエイトリンクを含む全記事に「【PR】本記事には広告・アフィリエイトリンクが含まれています」のPR表記が自動挿入されます。
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats + Add button */}
      <div className="mb-6 flex items-end justify-between">
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
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
        <button
          type="button"
          onClick={handleAdd}
          className="ml-4 shrink-0 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + プログラム追加
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="filter-asp" className="mr-2 text-xs font-medium text-neutral-600">ASP:</label>
          <select id="filter-asp" value={filterAsp} onChange={(e) => setFilterAsp(e.target.value as AspName | "all")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="all">すべて</option>
            {(Object.keys(ASP_DISPLAY_NAMES) as AspName[]).map((asp) => (
              <option key={asp} value={asp}>{ASP_DISPLAY_NAMES[asp]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-category" className="mr-2 text-xs font-medium text-neutral-600">カテゴリ:</label>
          <select id="filter-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as ContentCategory | "all")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="all">すべて</option>
            {(Object.keys(CATEGORY_LABELS) as ContentCategory[]).map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-active" className="mr-2 text-xs font-medium text-neutral-600">ステータス:</label>
          <select id="filter-active" value={filterActive} onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="all">すべて</option>
            <option value="active">有効のみ</option>
            <option value="inactive">無効のみ</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-neutral-500">{filteredPrograms.length} 件表示</div>
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
              <th className="px-4 py-3 font-medium text-neutral-600">承認率</th>
              <th className="px-4 py-3 font-medium text-neutral-600">EPC</th>
              <th className="px-4 py-3 font-medium text-neutral-600">ITP</th>
              <th className="px-4 py-3 font-medium text-neutral-600">有効</th>
              <th className="px-4 py-3 font-medium text-neutral-600">操作</th>
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
                <tr key={program.id} className={`hover:bg-neutral-50 ${!program.isActive ? "opacity-60" : ""}`}>
                  <td className="max-w-[200px] px-4 py-3 font-medium text-neutral-900">
                    <p className="truncate">{program.programName}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-neutral-400">{program.affiliateUrl.slice(0, 40)}...</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${aspColor}`}>{ASP_DISPLAY_NAMES[program.aspName]}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{CATEGORY_LABELS[program.category]}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{program.rewardAmount.toLocaleString()}円</td>
                  <td className="px-4 py-3">
                    {program.approvalRate != null ? (
                      <span className={`text-sm font-medium ${program.approvalRate >= 80 ? "text-green-700" : program.approvalRate >= 60 ? "text-yellow-700" : "text-red-700"}`}>{program.approvalRate}%</span>
                    ) : <span className="text-neutral-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{program.epc != null ? `${program.epc}円` : "-"}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleToggleItp(program.id)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${program.itpSupport ? "bg-blue-500" : "bg-neutral-300"}`} aria-label={`ITP対応を${program.itpSupport ? "無効" : "有効"}にする`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${program.itpSupport ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleToggleActive(program.id)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${program.isActive ? "bg-green-500" : "bg-neutral-300"}`} aria-label={`プログラムを${program.isActive ? "無効" : "有効"}にする`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${program.isActive ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleEdit(program)} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-blue-600" title="編集">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button type="button" onClick={() => setDeletingId(program.id)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="削除">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredPrograms.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-neutral-500">条件に一致するプログラムがありません</p>
          </div>
        )}
      </div>

      {/* Category mapping section */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-800">カテゴリ別マッピング設定</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CATEGORY_LABELS) as ContentCategory[])
            .filter((cat) => cat !== "column")
            .map((category) => {
              const categoryPrograms = programs.filter((p) => p.category === category && p.isActive);
              const avgApproval = categoryPrograms.length > 0 ? Math.round(categoryPrograms.reduce((sum, p) => sum + (p.approvalRate ?? 0), 0) / categoryPrograms.length) : 0;
              const totalReward = categoryPrograms.reduce((sum, p) => sum + p.rewardAmount, 0);

              return (
                <div key={category} className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-800">{CATEGORY_LABELS[category]}</h3>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{categoryPrograms.length}件</span>
                  </div>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between"><dt className="text-neutral-500">有効プログラム</dt><dd className="font-medium text-neutral-900">{categoryPrograms.length}件</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">平均承認率</dt><dd className={`font-medium ${avgApproval >= 80 ? "text-green-700" : avgApproval >= 60 ? "text-yellow-700" : "text-red-700"}`}>{avgApproval}%</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">合計報酬</dt><dd className="font-medium text-neutral-900">{totalReward.toLocaleString()}円</dd></div>
                    <div className="flex justify-between"><dt className="text-neutral-500">ITP対応率</dt><dd className="font-medium text-blue-700">{categoryPrograms.length > 0 ? Math.round((categoryPrograms.filter((p) => p.itpSupport).length / categoryPrograms.length) * 100) : 0}%</dd></div>
                  </dl>
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <ul className="space-y-1">
                      {categoryPrograms.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99)).map((p) => (
                        <li key={p.id} className="flex items-center justify-between text-xs">
                          <span className="truncate text-neutral-600">{p.programName}</span>
                          <span className="ml-2 shrink-0 font-medium text-neutral-800">{p.rewardAmount.toLocaleString()}円</span>
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
