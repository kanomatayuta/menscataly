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
import type { Props as LegendProps } from "recharts/types/component/DefaultLegendContent";
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
  if (dataLength < 7) return 7;
  if (dataLength < 30) return 30;
  return 30;
}

export function TrendChart({ data }: TrendChartProps) {
  const [period, setPeriod] = useState<Period>(() => getDefaultPeriod(data.length));
  const [visibleLines, setVisibleLines] = useState({
    pageviews: true,
    searchClicks: false,
    affiliateClicks: true,
    conversions: false,
  });

  const filtered = data.slice(-period);

  function handleLegendClick(dataKey: string) {
    const key = dataKey as keyof typeof visibleLines;
    if (key in visibleLines) {
      setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  }

  function renderLegend(props: LegendProps) {
    const { payload } = props;
    if (!payload) return null;
    return (
      <ul className="flex justify-center gap-4 pt-2">
        {payload.map((entry) => {
          const rawKey = typeof entry.dataKey === "string" ? entry.dataKey : "";
          const key = rawKey as keyof typeof visibleLines;
          const active = key in visibleLines ? visibleLines[key] : true;
          return (
            <li
              key={key}
              onClick={() => handleLegendClick(rawKey)}
              className="flex cursor-pointer select-none items-center gap-1 text-xs transition-opacity"
              style={{ opacity: active ? 1 : 0.3 }}
            >
              <span
                className="inline-block h-2 w-4 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-neutral-600">{LINE_LABELS[rawKey] ?? rawKey}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">トレンド</h3>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
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
        <div className="flex h-[300px] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-neutral-600">まだデータがありません</p>
          <p className="text-xs text-neutral-400">
            GA4・GSC連携後、翌日以降からデータが表示されます
          </p>
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
                return [value.toLocaleString("ja-JP"), LINE_LABELS[name] ?? name];
              }}
            />
            <Legend content={renderLegend} />
            {visibleLines.pageviews && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="pageviews"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {visibleLines.searchClicks && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="searchClicks"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {visibleLines.affiliateClicks && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="affiliateClicks"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
            {visibleLines.conversions && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="conversions"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
