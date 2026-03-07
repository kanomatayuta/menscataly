"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// Types
// ============================================================

interface AutomationConfig {
  dailyPipeline: boolean;
  pdcaBatch: boolean;
  autoRewrite: boolean;
  enabledCategories: string[];
  dailyPipelineTime?: string; // "HH:MM" format, default "06:00"
  pdcaBatchTime?: string;     // "HH:MM" format, default "23:00"
}

interface CategoryItem {
  id: string;
  label: string;
}

const FALLBACK_CATEGORIES: CategoryItem[] = [
  { id: "aga", label: "AGA・薄毛" },
  { id: "hair-removal", label: "メンズ脱毛" },
  { id: "skincare", label: "スキンケア" },
  { id: "ed", label: "ED治療" },
  { id: "column", label: "コラム" },
];

const DEFAULT_CONFIG: AutomationConfig = {
  dailyPipeline: true,
  pdcaBatch: true,
  autoRewrite: false,
  enabledCategories: FALLBACK_CATEGORIES.map((c) => c.id),
};

// ============================================================
// Icons (minimal inline SVGs)
// ============================================================

function PlayIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// ============================================================
// Main Dashboard Component
// ============================================================

export function AutomationDashboard() {
  const [config, setConfig] = useState<AutomationConfig>(DEFAULT_CONFIG);
  const [categories, setCategories] = useState<CategoryItem[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Pipeline trigger state
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");

  // Derived: master switch = both main jobs ON
  const isAutoEnabled = config.dailyPipeline && config.pdcaBatch;

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/automation-config", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : DEFAULT_CONFIG))
        .catch(() => DEFAULT_CONFIG),
      fetch("/api/admin/categories", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]).then(([configData, catData]) => {
      setConfig({ ...DEFAULT_CONFIG, ...configData });
      if (catData?.categories?.length) setCategories(catData.categories);
      setLoading(false);
    });
  }, []);

  const saveConfig = useCallback(async (newConfig: AutomationConfig) => {
    setConfig(newConfig);
    setSaving(true);
    setError(null);
    setSaved(false);
    clearTimeout(savedTimer.current);

    try {
      const res = await fetch("/api/admin/automation-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newConfig),
      });
      if (!res.ok) {
        setError("保存に失敗しました");
      } else {
        setSaved(true);
        savedTimer.current = setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, []);

  // Master switch: toggle both dailyPipeline + pdcaBatch
  const toggleMaster = useCallback(() => {
    const next = !isAutoEnabled;
    saveConfig({
      ...config,
      dailyPipeline: next,
      pdcaBatch: next,
      autoRewrite: next ? config.autoRewrite : false,
    });
  }, [config, isAutoEnabled, saveConfig]);

  // Individual toggle (details section)
  const updateToggle = useCallback(
    (key: "dailyPipeline" | "pdcaBatch" | "autoRewrite", value: boolean) => {
      const newConfig = { ...config, [key]: value };
      // If pdcaBatch is turned off, also disable autoRewrite
      if (key === "pdcaBatch" && !value) {
        newConfig.autoRewrite = false;
      }
      saveConfig(newConfig);
    },
    [config, saveConfig]
  );

  const toggleCategory = useCallback(
    (categoryId: string) => {
      const next = config.enabledCategories.includes(categoryId)
        ? config.enabledCategories.filter((c) => c !== categoryId)
        : [...config.enabledCategories, categoryId];
      if (next.length === 0) return;
      saveConfig({ ...config, enabledCategories: next });
    },
    [config, saveConfig]
  );

  const toggleAllCategories = useCallback(() => {
    const allSelected = categories.every((c) => config.enabledCategories.includes(c.id));
    saveConfig({
      ...config,
      enabledCategories: allSelected ? [categories[0].id] : categories.map((c) => c.id),
    });
  }, [config, categories, saveConfig]);

  const handleTriggerPipeline = useCallback(async () => {
    setIsTriggering(true);
    setTriggerMessage("");
    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "manual" }),
      });
      if (res.ok) {
        setTriggerMessage("パイプラインを実行しました");
        window.dispatchEvent(new CustomEvent("pipeline-triggered"));
      } else {
        setTriggerMessage(`実行に失敗しました (${res.status})`);
      }
    } catch {
      setTriggerMessage("ネットワークエラーが発生しました");
    } finally {
      setIsTriggering(false);
    }
  }, []);

  const enabledCount = config.enabledCategories.filter((id) => categories.some((c) => c.id === id)).length;
  const allCategoriesSelected = categories.every((c) => config.enabledCategories.includes(c.id));

  // Partial mode: master is OFF but one of the two jobs is individually ON
  const isPartial = !isAutoEnabled && (config.dailyPipeline || config.pdcaBatch);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-[160px] animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border-2 transition-colors duration-200 ${
        isAutoEnabled
          ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      {/* Top section: status + master toggle */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: status indicator */}
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <span className={`block h-4 w-4 rounded-full ${isAutoEnabled ? "bg-emerald-500" : "bg-slate-400"}`} />
              {isAutoEnabled && (
                <span className="absolute inset-0 h-4 w-4 animate-ping rounded-full bg-emerald-500 opacity-30" />
              )}
            </div>
            <div>
              <p className={`text-lg font-bold ${isAutoEnabled ? "text-emerald-800" : "text-slate-700"}`}>
                {isAutoEnabled ? "自動モード" : "手動モード"}
              </p>
              <p className="text-xs text-slate-500">
                {isAutoEnabled
                  ? `毎日 ${config.dailyPipelineTime ?? "06:00"} に記事生成、${config.pdcaBatchTime ?? "23:00"} に分析を自動実行`
                  : isPartial
                    ? "一部のジョブのみ有効（詳細設定を確認）"
                    : "手動で実行ボタンを押して実行してください"}
              </p>
            </div>
          </div>

          {/* Right: toggle + execute button */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />}
            <button
              type="button"
              role="switch"
              aria-checked={isAutoEnabled}
              aria-label="自動運転の切り替え"
              disabled={saving}
              onClick={toggleMaster}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 ${
                isAutoEnabled ? "bg-emerald-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAutoEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={handleTriggerPipeline}
              disabled={isTriggering}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-all disabled:opacity-50 ${
                isAutoEnabled
                  ? "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  : "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
              }`}
            >
              {isTriggering ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  実行中...
                </>
              ) : (
                <>
                  <PlayIcon />
                  今すぐ実行
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {(triggerMessage || saved || error) && (
          <div className="mt-2 flex items-center gap-2">
            {triggerMessage && (
              <span className={`text-xs font-medium ${triggerMessage.includes("失敗") || triggerMessage.includes("エラー") ? "text-red-600" : "text-emerald-600"}`}>
                {triggerMessage}
              </span>
            )}
            {saved && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckIcon /> 保存しました
              </span>
            )}
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        )}

        {/* Partial warning */}
        {isPartial && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              個別設定でジョブが一部有効です。完全自動にするにはスイッチをONにしてください。
            </p>
          </div>
        )}
      </div>

      {/* Details: Accordion (inside same card) */}
      <div className="border-t border-black/5">
        <button
          type="button"
          onClick={() => setDetailsOpen(!detailsOpen)}
          className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-black/[0.02] transition-colors"
        >
          <span className="text-sm font-medium text-slate-600">詳細設定</span>
          <div className="flex items-center gap-2">
            {isPartial && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                カスタム
              </span>
            )}
            <ChevronIcon open={detailsOpen} />
          </div>
        </button>

        {detailsOpen && (
          <div className="border-t border-black/5 px-5 py-4 space-y-4">
            {/* Individual job toggles */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">スケジュールジョブ</p>

              {/* Daily Pipeline */}
              <div className="space-y-1.5 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">記事生成パイプライン</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.dailyPipeline}
                    disabled={saving}
                    onClick={() => updateToggle("dailyPipeline", !config.dailyPipeline)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 ${
                      config.dailyPipeline ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${config.dailyPipeline ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <p className="text-xs text-slate-500">トレンド分析 → 記事生成 → コンプラチェック</p>
                {config.dailyPipeline && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500">実行時刻</span>
                    <input
                      type="time"
                      value={config.dailyPipelineTime ?? "06:00"}
                      disabled={saving}
                      onChange={(e) => saveConfig({ ...config, dailyPipelineTime: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                    />
                    <span className="text-xs text-slate-400">JST</span>
                  </div>
                )}
              </div>

              {/* PDCA Batch */}
              <div className="space-y-1.5 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-800">分析パイプライン</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.pdcaBatch}
                    disabled={saving}
                    onClick={() => updateToggle("pdcaBatch", !config.pdcaBatch)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 ${
                      config.pdcaBatch ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${config.pdcaBatch ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
                <p className="text-xs text-slate-500">アナリティクス → 収益分析 → アラート</p>
                {config.pdcaBatch && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500">実行時刻</span>
                    <input
                      type="time"
                      value={config.pdcaBatchTime ?? "23:00"}
                      disabled={saving}
                      onChange={(e) => saveConfig({ ...config, pdcaBatchTime: e.target.value })}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-50"
                    />
                    <span className="text-xs text-slate-400">JST</span>
                  </div>
                )}
              </div>

              {/* Auto Rewrite (nested under PDCA) */}
              <div className={`flex items-center justify-between py-2 pl-6 border-l-2 ${config.pdcaBatch ? "border-emerald-200" : "border-slate-200 opacity-50"}`}>
                <div>
                  <p className="text-sm font-medium text-slate-700">自動リライト</p>
                  <p className="text-xs text-slate-400">分析パイプライン内でヘルススコア低下記事を自動リライト</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config.autoRewrite}
                  disabled={saving || !config.pdcaBatch}
                  onClick={() => updateToggle("autoRewrite", !config.autoRewrite)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 disabled:opacity-50 ${
                    config.autoRewrite ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${config.autoRewrite ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>

            {/* Category selection */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">記事生成カテゴリ</p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={toggleAllCategories}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {allCategoriesSelected ? "全解除" : "全選択"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const isEnabled = config.enabledCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={saving}
                      onClick={() => toggleCategory(cat.id)}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
                        isEnabled
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {isEnabled && <CheckIcon />}
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">{enabledCount}/{categories.length} カテゴリ選択中</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
