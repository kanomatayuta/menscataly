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
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line,
} from "recharts";

// ============================================================
// Types
// ============================================================

export interface DailyProfitData {
  date: string;
  revenueJpy: number;
  costJpy: number;
  profitJpy: number;
}

export interface CostBreakdown {
  name: string;
  costUsd: number;
  costJpy: number;
  percentage: number;
  count: number;
}

export interface AspRevenueData {
  aspName: string;
  displayName: string;
  revenueJpy: number;
  clicks: number;
  conversions: number;
  cvr: number;
  color: string;
}

// ============================================================
// Helpers
// ============================================================

function formatJpy(value: number): string {
  if (Math.abs(value) >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`;
  }
  return `¥${value.toLocaleString()}`;
}

// ============================================================
// 1. 収益 vs コスト（日別）
// ============================================================

function ProfitTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const revenue = payload.find((p) => p.dataKey === "revenueJpy")?.value ?? 0;
  const cost = payload.find((p) => p.dataKey === "costJpy")?.value ?? 0;
  const profit = revenue - cost;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            収益
          </span>
          <span className="font-semibold tabular-nums">{formatJpy(revenue)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
            APIコスト
          </span>
          <span className="font-semibold tabular-nums">{formatJpy(cost)}</span>
        </div>
        <div className="border-t border-slate-100 pt-1.5">
          <div className="flex items-center justify-between gap-6">
            <span className="font-medium">純利益</span>
            <span className={`font-bold tabular-nums ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {formatJpy(profit)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RevenueCostChart({ data }: { data: DailyProfitData[] }) {
  if (data.length === 0 || data.every((d) => d.revenueJpy === 0 && d.costJpy === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 rounded-full bg-slate-100 p-3">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">データが蓄積されるとグラフが表示されます</p>
        <p className="mt-1 text-xs text-slate-400">収益データとAPIコストが日別で比較できます</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={formatJpy}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          width={55}
        />
        <Tooltip content={<ProfitTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
        <Legend
          formatter={(value: string) => {
            if (value === "revenueJpy") return "収益";
            if (value === "costJpy") return "APIコスト";
            if (value === "profitJpy") return "純利益";
            return value;
          }}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Bar dataKey="revenueJpy" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} opacity={0.85} />
        <Bar dataKey="costJpy" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={24} opacity={0.85} />
        <Line dataKey="profitJpy" type="monotone" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="4 4" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// 2. コスト内訳（ドーナツチャート）
// ============================================================

const COST_TYPE_COLORS: Record<string, string> = {
  "記事生成": "#f59e0b",
  "分析": "#8b5cf6",
  "画像生成": "#3b82f6",
  "コンプライアンス": "#10b981",
};

function BreakdownTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CostBreakdown }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="mb-1.5 text-xs font-semibold text-slate-700">{d.name}</p>
      <div className="space-y-1 text-xs text-slate-600">
        <div className="flex justify-between gap-4">
          <span>コスト</span>
          <span className="font-medium">${d.costUsd.toFixed(2)} ({formatJpy(d.costJpy)})</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>割合</span>
          <span className="font-medium">{d.percentage.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>実行回数</span>
          <span className="font-medium">{d.count}回</span>
        </div>
      </div>
    </div>
  );
}

export function CostBreakdownChart({ data, totalUsd, totalJpy }: { data: CostBreakdown[]; totalUsd: number; totalJpy: number }) {
  const hasData = data.length > 0 && data.some((d) => d.costUsd > 0);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 rounded-full bg-slate-100 p-3">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">コストデータがありません</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
      <div className="relative">
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Pie
              data={data.filter((d) => d.costUsd > 0)}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={3}
              dataKey="costUsd"
              stroke="none"
            >
              {data.filter((d) => d.costUsd > 0).map((entry, i) => (
                <Cell key={i} fill={COST_TYPE_COLORS[entry.name] ?? "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip content={<BreakdownTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-slate-800">${totalUsd.toFixed(2)}</span>
          <span className="text-[10px] text-slate-400">{formatJpy(totalJpy)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 py-2">
        {data.filter((d) => d.costUsd > 0).map((d) => (
          <div key={d.name} className="flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: COST_TYPE_COLORS[d.name] ?? "#94a3b8" }} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700">{d.name}</p>
              <p className="text-[10px] text-slate-400">
                ${d.costUsd.toFixed(2)} ({d.percentage.toFixed(0)}%) / {d.count}回
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 3. ASP別売上（横棒グラフ — 改良版）
// ============================================================

function AspTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: AspRevenueData }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="mb-1.5 text-xs font-semibold" style={{ color: d.color }}>{d.displayName}</p>
      <div className="space-y-1 text-xs text-slate-600">
        <div className="flex justify-between gap-6">
          <span>売上</span>
          <span className="font-semibold text-slate-900">{formatJpy(d.revenueJpy)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>クリック</span>
          <span className="font-medium">{d.clicks.toLocaleString()}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>CV</span>
          <span className="font-medium">{d.conversions}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span>CVR</span>
          <span className="font-medium">{d.cvr.toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}

export function AspRevenueChart({ data }: { data: AspRevenueData[] }) {
  if (data.length === 0 || data.every((d) => d.revenueJpy === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 rounded-full bg-slate-100 p-3">
          <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">ASP売上データがありません</p>
        <p className="mt-1 text-xs text-slate-400">ASP連携後にデータが表示されます</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 60 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 40, left: 16, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={formatJpy}
          tick={{ fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={{ stroke: "#e2e8f0" }}
        />
        <YAxis
          type="category"
          dataKey="displayName"
          tick={{ fontSize: 12, fill: "#475569", fontWeight: 500 }}
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <Tooltip content={<AspTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
        <Bar dataKey="revenueJpy" radius={[0, 6, 6, 0]} maxBarSize={36}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
