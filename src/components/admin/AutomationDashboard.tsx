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
}

interface CategoryItem {
  id: string;
  label: string;
}

type AutomationMode = "automatic" | "partial" | "manual";

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

function getMode(config: AutomationConfig): AutomationMode {
  const { dailyPipeline, pdcaBatch } = config;
  if (dailyPipeline && pdcaBatch) return "automatic";
  if (dailyPipeline || pdcaBatch) return "partial";
  return "manual";
}

const MODE_CONFIG = {
  automatic: {
    label: "自動運転中",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
    pulse: true,
    btnVariant: "subtle" as const,
  },
  partial: {
    label: "部分自動",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-500",
    pulse: false,
    btnVariant: "secondary" as const,
  },
  manual: {
    label: "手動モード",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    dot: "bg-blue-500",
    pulse: false,
    btnVariant: "primary" as const,
  },
} as const;

// ============================================================
// Icons
// ============================================================

function ClockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function PenIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
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

function PlayIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
    </svg>
  );
}

// ============================================================
// Mode Status Banner
// ============================================================

interface ModeStatusBannerProps {
  config: AutomationConfig;
  loading: boolean;
  onTriggerPipeline: () => void;
  isTriggering: boolean;
  triggerMessage: string;
}

function ModeStatusBanner({ config, loading, onTriggerPipeline, isTriggering, triggerMessage }: ModeStatusBannerProps) {
  if (loading) {
    return <div className="h-[88px] animate-pulse rounded-xl bg-slate-200" />;
  }

  const mode = getMode(config);
  const mc = MODE_CONFIG[mode];

  const description = (() => {
    if (mode === "automatic") {
      return `日次パイプライン 06:00 JST / PDCAバッチ 23:00 JST${config.autoRewrite ? " / 自動リライト有効" : ""}`;
    }
    if (mode === "partial") {
      const parts: string[] = [];
      if (config.dailyPipeline) parts.push("日次パイプライン 06:00 JST");
      if (config.pdcaBatch) parts.push("PDCAバッチ 23:00 JST");
      return `${parts.join(" / ")} のみ自動実行`;
    }
    return "自動実行は停止中 — 手動で実行できます";
  })();

  const btnStyles = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm px-5 py-2.5 text-sm",
    secondary: "bg-white/80 text-blue-700 border border-blue-300 hover:bg-white px-4 py-2 text-sm",
    subtle: "bg-white/60 text-slate-600 border border-slate-200 hover:bg-white/80 px-4 py-2 text-xs",
  };

  return (
    <div className={`rounded-xl border ${mc.border} ${mc.bg} px-5 py-4`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <span className={`block h-3 w-3 rounded-full ${mc.dot}`} />
            {mc.pulse && (
              <span className={`absolute inset-0 h-3 w-3 animate-ping rounded-full ${mc.dot} opacity-40`} />
            )}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${mc.text}`}>{mc.label}</p>
            <p className="text-xs text-slate-600 truncate">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {triggerMessage && (
            <span className={`text-xs ${triggerMessage.includes("失敗") || triggerMessage.includes("エラー") ? "text-red-600" : "text-green-600"}`}>
              {triggerMessage}
            </span>
          )}
          <button
            type="button"
            onClick={onTriggerPipeline}
            disabled={isTriggering}
            className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all disabled:opacity-50 ${btnStyles[mc.btnVariant]}`}
          >
            {isTriggering ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                実行中...
              </>
            ) : (
              <>
                <PlayIcon />
                {mode === "manual" ? "パイプライン実行" : "手動実行"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Toggle Item
// ============================================================

interface ToggleItemProps {
  label: string;
  description: string;
  enabled: boolean;
  saving: boolean;
  icon: React.ReactNode;
  onChange: (enabled: boolean) => void;
}

function ToggleItem({ label, description, enabled, saving, icon, onChange }: ToggleItemProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-5 py-4 transition-all ${
        enabled ? "border-blue-200 bg-blue-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${enabled ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4 flex-shrink-0">
        {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${enabled ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
    </div>
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

  // Pipeline trigger state
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState("");

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
        localStorage.setItem("menscataly_automation_config", JSON.stringify(newConfig));
        setError("サーバー保存に失敗（ローカル保存済み）");
      } else {
        setSaved(true);
        savedTimer.current = setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      localStorage.setItem("menscataly_automation_config", JSON.stringify(newConfig));
      setError("サーバー保存に失敗（ローカル保存済み）");
    } finally {
      setSaving(false);
    }
  }, []);

  const updateToggle = useCallback(
    (key: "dailyPipeline" | "pdcaBatch" | "autoRewrite", value: boolean) => {
      saveConfig({ ...config, [key]: value });
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
        // LivePipelineMonitorに即座にポーリング開始を通知
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

  const allCategoriesSelected = categories.every((c) => config.enabledCategories.includes(c.id));
  const enabledCount = config.enabledCategories.filter((id) => categories.some((c) => c.id === id)).length;

  return (
    <div className="space-y-4">
      {/* Mode Status Banner + Pipeline Trigger */}
      <ModeStatusBanner
        config={config}
        loading={loading}
        onTriggerPipeline={handleTriggerPipeline}
        isTriggering={isTriggering}
        triggerMessage={triggerMessage}
      />

      {/* Settings Header */}
      {!loading && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">スケジュール設定</h2>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
                保存中...
              </span>
            )}
            {saved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckIcon /> 保存しました
              </span>
            )}
            {error && <span className="text-xs text-amber-600">{error}</span>}
          </div>
        </div>
      )}

      {/* Toggle Items */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <ToggleItem
            icon={<ClockIcon />}
            label="日次パイプライン (06:00 JST)"
            description="トレンド分析 → 記事生成 → コンプラチェック → microCMS下書き保存"
            enabled={config.dailyPipeline}
            saving={saving}
            onChange={(v) => updateToggle("dailyPipeline", v)}
          />
          <ToggleItem
            icon={<ChartIcon />}
            label="PDCAバッチ (23:00 JST)"
            description="アナリティクス → ASP収益 → ヘルススコア → パフォーマンスアラート"
            enabled={config.pdcaBatch}
            saving={saving}
            onChange={(v) => updateToggle("pdcaBatch", v)}
          />
          <ToggleItem
            icon={<PenIcon />}
            label="自動リライト"
            description="ヘルススコアが低い記事を自動的にリライト（PDCAバッチ内で実行）"
            enabled={config.autoRewrite}
            saving={saving}
            onChange={(v) => updateToggle("autoRewrite", v)}
          />
        </div>
      )}

      {/* Category Selection */}
      {!loading && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">記事生成カテゴリ</p>
              <p className="text-xs text-slate-500">パイプラインで生成する記事のカテゴリを選択</p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={toggleAllCategories}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
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
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all disabled:opacity-50 ${
                    isEnabled
                      ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {isEnabled && <CheckIcon />}
                  {cat.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(enabledCount / categories.length) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-500">{enabledCount}/{categories.length}</span>
          </div>
        </div>
      )}
    </div>
  );
}
