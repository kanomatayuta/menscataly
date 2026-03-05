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

export function TrendChart({ data }: TrendChartProps) {
  const [period, setPeriod] = useState<Period>(30);

  const filtered = data.slice(-period);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">トレンド</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.value
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center">
          <p className="text-sm text-neutral-500">データなし</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filtered} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
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
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  pageviews: "PV",
                  searchClicks: "検索CL",
                  affiliateClicks: "広告CL",
                  conversions: "CV",
                };
                return [value.toLocaleString("ja-JP"), labels[name] ?? name];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  pageviews: "PV",
                  searchClicks: "検索CL",
                  affiliateClicks: "広告CL",
                  conversions: "CV",
                };
                return labels[value] ?? value;
              }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="pageviews"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="searchClicks"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="affiliateClicks"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="conversions"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
