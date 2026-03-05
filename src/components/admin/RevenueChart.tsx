"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import type { RevenueSummary } from "@/types/admin";

interface RevenueChartProps {
  summaries: RevenueSummary[];
}

/** ASP key → display name mapping */
const ASP_DISPLAY_NAMES: Record<string, string> = {
  afb: "afb",
  a8: "A8.net",
  accesstrade: "アクセストレード",
  valuecommerce: "バリューコマース",
  felmat: "felmat",
  moshimo: "もしもアフィリエイト",
};

const ASP_COLORS: Record<string, string> = {
  afb: "#3b82f6",
  a8: "#10b981",
  accesstrade: "#f59e0b",
  valuecommerce: "#8b5cf6",
  felmat: "#ef4444",
  moshimo: "#ec4899",
};

const DEFAULT_COLOR = "#6b7280";

function getAspDisplayName(aspName: string): string {
  return ASP_DISPLAY_NAMES[aspName.toLowerCase()] ?? aspName;
}

function getAspColor(aspName: string): string {
  return ASP_COLORS[aspName.toLowerCase()] ?? DEFAULT_COLOR;
}

function formatYen(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(0)}万`;
  }
  return `¥${value.toLocaleString()}`;
}

/** Custom tooltip showing revenue, clicks, and conversions */
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: {
      displayName: string;
      revenue: number;
      clicks: number;
      conversions: number;
      conversionRate: number;
      aspName: string;
    };
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;
  const color = getAspColor(data.aspName);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-lg">
      <p
        className="mb-2 text-sm font-semibold"
        style={{ color }}
      >
        {data.displayName}
      </p>
      <div className="space-y-1 text-xs text-neutral-600">
        <div className="flex items-center justify-between gap-6">
          <span className="text-neutral-500">売上</span>
          <span className="font-medium text-neutral-900">
            ¥{data.revenue.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-neutral-500">クリック数</span>
          <span className="font-medium text-neutral-900">
            {data.clicks.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-neutral-500">CV数</span>
          <span className="font-medium text-neutral-900">
            {data.conversions.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 border-t border-neutral-100 pt-1">
          <div className="flex items-center justify-between gap-6">
            <span className="text-neutral-500">CVR</span>
            <span className="font-medium text-neutral-900">
              {data.conversionRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Custom bar label showing CV count above each bar */
function BarLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
  index?: number;
  data?: Array<{ conversions: number }>;
}) {
  const { x = 0, y = 0, width = 0, index = 0, data = [] } = props;
  const conversions = data[index]?.conversions ?? 0;
  if (conversions === 0) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fill="#6b7280"
      fontSize={11}
      fontWeight={500}
    >
      {conversions} CV
    </text>
  );
}

export function RevenueChart({ summaries }: RevenueChartProps) {
  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-8 py-12">
        <svg
          className="mb-3 h-10 w-10 text-neutral-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
          />
        </svg>
        <p className="text-sm font-medium text-neutral-500">
          表示する売上データがありません
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          ASP連携後にデータが表示されます
        </p>
      </div>
    );
  }

  const data = summaries.map((s) => ({
    displayName: getAspDisplayName(s.aspName),
    revenue: s.totalRevenue,
    clicks: s.totalClicks,
    conversions: s.totalConversions,
    conversionRate: s.conversionRate,
    aspName: s.aspName,
  }));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          margin={{ top: 24, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            vertical={false}
          />
          <XAxis
            dataKey="displayName"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tickFormatter={formatYen}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(0, 0, 0, 0.04)", radius: 4 }}
          />
          <Legend
            formatter={(value: string) => {
              if (value === "revenue") return "売上 (¥)";
              return value;
            }}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Bar
            dataKey="revenue"
            radius={[6, 6, 0, 0]}
            maxBarSize={56}
            label={<BarLabel data={data} />}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getAspColor(entry.aspName)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
