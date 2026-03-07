"use client";

import { useState, useEffect, useCallback } from "react";

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

interface ToggleItemProps {
  label: string;
  description: string;
  enabled: boolean;
  saving: boolean;
  onChange: (enabled: boolean) => void;
}

function ToggleItem({ label, description, enabled, saving, onChange }: ToggleItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {saving && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        )}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
            enabled ? "bg-blue-600" : "bg-slate-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

export function AutomationToggle() {
  const [config, setConfig] = useState<AutomationConfig>(DEFAULT_CONFIG);
  const [categories, setCategories] = useState<CategoryItem[]>(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // カテゴリと設定を並列取得
    Promise.all([
      fetch("/api/admin/automation-config", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : DEFAULT_CONFIG))
        .catch(() => DEFAULT_CONFIG),
      fetch("/api/admin/categories", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]).then(([configData, catData]) => {
      setConfig({ ...DEFAULT_CONFIG, ...configData });
      if (catData?.categories?.length) {
        setCategories(catData.categories);
      }
      setLoading(false);
    });
  }, []);

  const saveConfig = useCallback(
    async (newConfig: AutomationConfig) => {
      setConfig(newConfig);
      setSaving(true);
      setError(null);

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
        }
      } catch {
        localStorage.setItem("menscataly_automation_config", JSON.stringify(newConfig));
        setError("サーバー保存に失敗（ローカル保存済み）");
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const updateToggle = useCallback(
    (key: "dailyPipeline" | "pdcaBatch" | "autoRewrite", value: boolean) => {
      saveConfig({ ...config, [key]: value });
    },
    [config, saveConfig]
  );

  const toggleCategory = useCallback(
    (categoryId: string) => {
      const current = config.enabledCategories;
      const next = current.includes(categoryId)
        ? current.filter((c) => c !== categoryId)
        : [...current, categoryId];
      // 最低1カテゴリは有効にする
      if (next.length === 0) return;
      saveConfig({ ...config, enabledCategories: next });
    },
    [config, saveConfig]
  );

  if (loading) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">自動化設定</h2>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">自動化設定</h2>
      <div className="space-y-3">
        <ToggleItem
          label="日次パイプライン (06:00 JST)"
          description="毎朝トレンド分析 → 記事生成 → コンプラチェック → microCMS下書き保存"
          enabled={config.dailyPipeline}
          saving={saving}
          onChange={(v) => updateToggle("dailyPipeline", v)}
        />
        <ToggleItem
          label="PDCAバッチ (23:00 JST)"
          description="毎晩アナリティクス → ASP収益 → ヘルススコア → パフォーマンスアラート"
          enabled={config.pdcaBatch}
          saving={saving}
          onChange={(v) => updateToggle("pdcaBatch", v)}
        />
        <ToggleItem
          label="自動リライト"
          description="ヘルススコアが低い記事を自動的にリライト（PDCAバッチ内で実行）"
          enabled={config.autoRewrite}
          saving={saving}
          onChange={(v) => updateToggle("autoRewrite", v)}
        />

        {/* カテゴリ選択 */}
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-3">
            <p className="text-sm font-medium text-slate-800">記事生成カテゴリ</p>
            <p className="text-xs text-slate-500">パイプラインで生成する記事のカテゴリを選択</p>
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
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    isEnabled
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {config.enabledCategories.length}/{categories.length} カテゴリ選択中
          </p>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs text-amber-600">{error}</p>
      )}
    </div>
  );
}
