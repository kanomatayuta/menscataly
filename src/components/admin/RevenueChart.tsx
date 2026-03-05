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
} from "recharts";
import type { RevenueSummary } from "@/types/admin";

interface RevenueChartProps {
  summaries: RevenueSummary[];
}

const ASP_COLORS: Record<string, string> = {
  afb: "#3b82f6",
  a8: "#10b981",
  accesstrade: "#f59e0b",
  valuecommerce: "#8b5cf6",
  felmat: "#ef4444",
};

const DEFAULT_COLOR = "#6b7280";

function formatYen(value: number): string {
  if (value >= 10000) {
    return `¥${(value / 10000).toFixed(0)}万`;
  }
  return `¥${value.toLocaleString()}`;
}

export function RevenueChart({ summaries }: RevenueChartProps) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">表示する売上データがありません</p>
      </div>
    );
  }

  const data = summaries.map((s) => ({
    name: s.aspName.toUpperCase(),
    revenue: s.totalRevenue,
    clicks: s.totalClicks,
    conversions: s.totalConversions,
    aspName: s.aspName,
  }));

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tickFormatter={formatYen}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <Tooltip
            formatter={(value: number) => [
              `¥${value.toLocaleString()}`,
              "売上",
            ]}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={60}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={ASP_COLORS[entry.aspName] ?? DEFAULT_COLOR}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
