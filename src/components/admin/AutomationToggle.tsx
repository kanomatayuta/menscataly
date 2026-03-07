"use client";

import { useState, useEffect, useCallback } from "react";

interface AutomationConfig {
  dailyPipeline: boolean;
  pdcaBatch: boolean;
  autoRewrite: boolean;
}

const DEFAULT_CONFIG: AutomationConfig = {
  dailyPipeline: true,
  pdcaBatch: true,
  autoRewrite: false,
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/automation-config")
      .then((res) => (res.ok ? res.json() : DEFAULT_CONFIG))
      .then((data) => setConfig({ ...DEFAULT_CONFIG, ...data }))
      .catch(() => setConfig(DEFAULT_CONFIG))
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = useCallback(
    async (key: keyof AutomationConfig, value: boolean) => {
      const newConfig = { ...config, [key]: value };
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
          // API失敗してもUIは更新済み — localStorage にもフォールバック保存
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
    [config]
  );

  if (loading) {
    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">自動化設定</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
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
          onChange={(v) => updateConfig("dailyPipeline", v)}
        />
        <ToggleItem
          label="PDCAバッチ (23:00 JST)"
          description="毎晩アナリティクス → ASP収益 → ヘルススコア → パフォーマンスアラート"
          enabled={config.pdcaBatch}
          saving={saving}
          onChange={(v) => updateConfig("pdcaBatch", v)}
        />
        <ToggleItem
          label="自動リライト"
          description="ヘルススコアが低い記事を自動的にリライト（PDCAバッチ内で実行）"
          enabled={config.autoRewrite}
          saving={saving}
          onChange={(v) => updateConfig("autoRewrite", v)}
        />
      </div>
      {error && (
        <p className="mt-2 text-xs text-amber-600">{error}</p>
      )}
    </div>
  );
}
