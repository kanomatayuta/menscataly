"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { TrendDataPoint } from "@/types/admin";

interface TrendChartProps {
  data: TrendDataPoint[];
}

type Period = 7 | 30 | 90;

const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: "7日" },
  { value: 30, label: "30日" },
  { value: 90, label: "90日" },
];

const LINE_LABELS: Record<string, string> = {
  pageviews: "PV",
  searchClicks: "検索CL",
  affiliateClicks: "広告CL",
  conversions: "CV",
};

function getDefaultPeriod(dataLength: number): Period {
  if (dataLength <= 7) return 7;
  if (dataLength <= 30) return 30;
  return 30;
}

export function TrendChart({ data }: TrendChartProps) {
  const [period, setPeriod] = useState<Period>(() => getDefaultPeriod(data.length));

  const filtered = data.slice(-period);

  return (
    <div className="rounded-lg border border-slate-200 bg-white py-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between px-3">
        <h3 className="text-sm font-semibold text-slate-700">トレンド</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.value
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-[300px] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-slate-600">まだデータがありません</p>
          <p className="text-xs text-slate-400">
            GA4・GSC連携後、翌日以降からデータが表示されます
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filtered} margin={{ top: 10, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                return [value.toLocaleString("ja-JP"), LINE_LABELS[name] ?? name];
              }}
            />
            <Legend
              formatter={(value: string) => LINE_LABELS[value] ?? value}
              wrapperStyle={{ fontSize: "12px" }}
            />
            <Line
              yAxisId="left"
              type="linear"
              dataKey="pageviews"
              name="pageviews"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#3b82f6" }}
            />
            <Line
              yAxisId="left"
              type="linear"
              dataKey="searchClicks"
              name="searchClicks"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#10b981" }}
            />
            <Line
              yAxisId="left"
              type="linear"
              dataKey="affiliateClicks"
              name="affiliateClicks"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#8b5cf6" }}
            />
            <Line
              yAxisId="right"
              type="linear"
              dataKey="conversions"
              name="conversions"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#f59e0b" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
