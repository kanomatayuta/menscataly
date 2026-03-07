"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";

// ============================================================
// Types
// ============================================================

export interface DailyCostData {
  date: string;
  articleGeneration: number;
  analysis: number;
  imageGeneration: number;
  complianceCheck: number;
  total: number;
}

export interface MonthlyCostData {
  month: string;
  totalCostUsd: number;
  articleCount: number;
  avgCostPerArticle: number;
}

interface CostChartProps {
  dailyCosts: DailyCostData[];
  monthlyCosts: MonthlyCostData[];
}

// ============================================================
// Helpers
// ============================================================

function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

const COST_TYPE_LABELS: Record<string, string> = {
  articleGeneration: "記事生成",
  analysis: "分析",
  imageGeneration: "画像生成",
  complianceCheck: "コンプライアンス",
};

const COST_TYPE_COLORS: Record<string, string> = {
  articleGeneration: "#f59e0b",
  analysis: "#8b5cf6",
  imageGeneration: "#3b82f6",
  complianceCheck: "#10b981",
};

// ============================================================
// Custom Tooltip
// ============================================================

function DailyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              {COST_TYPE_LABELS[p.dataKey] ?? p.dataKey}
            </span>
            <span className="font-medium tabular-nums">{formatUsd(p.value)}</span>
          </div>
        ))}
        <div className="border-t border-slate-100 pt-1">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold">
            <span>合計</span>
            <span className="tabular-nums">{formatUsd(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0];
  const articleCount = payload.find((p) => p.dataKey === "articleCount")?.value ?? 0;
  const avgCost = payload.find((p) => p.dataKey === "avgCostPerArticle")?.value ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">合計コスト</span>
          <span className="font-medium">{formatUsd(data?.value ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">記事数</span>
          <span className="font-medium">{articleCount}件</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500">1記事あたり</span>
          <span className="font-medium">{formatUsd(avgCost)}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Components
// ============================================================

export function DailyCostChart({ data }: { data: DailyCostData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        コストデータがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 16, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tickFormatter={(v: number) => `$${v.toFixed(1)}`}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<DailyTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Legend
          formatter={(value: string) => COST_TYPE_LABELS[value] ?? value}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Bar dataKey="articleGeneration" stackId="cost" fill={COST_TYPE_COLORS.articleGeneration} radius={[0, 0, 0, 0]} />
        <Bar dataKey="analysis" stackId="cost" fill={COST_TYPE_COLORS.analysis} />
        <Bar dataKey="imageGeneration" stackId="cost" fill={COST_TYPE_COLORS.imageGeneration} />
        <Bar dataKey="complianceCheck" stackId="cost" fill={COST_TYPE_COLORS.complianceCheck} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyCostChart({ data }: { data: MonthlyCostData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        月別コストデータがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 16, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          yAxisId="cost"
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <YAxis
          yAxisId="count"
          orientation="right"
          tickFormatter={(v: number) => `${v}件`}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<MonthlyTooltip />} />
        <Legend
          formatter={(value: string) => {
            if (value === "totalCostUsd") return "合計コスト ($)";
            if (value === "articleCount") return "記事数";
            return value;
          }}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Line yAxisId="cost" type="monotone" dataKey="totalCostUsd" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
        <Line yAxisId="count" type="monotone" dataKey="articleCount" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CostChart({ dailyCosts, monthlyCosts }: CostChartProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-800">日別APIコスト（過去30日）</h2>
        </div>
        <div className="overflow-x-auto p-4">
          <DailyCostChart data={dailyCosts} />
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-neutral-800">月別コスト推移</h2>
        </div>
        <div className="overflow-x-auto p-4">
          <MonthlyCostChart data={monthlyCosts} />
        </div>
      </div>
    </div>
  );
}
