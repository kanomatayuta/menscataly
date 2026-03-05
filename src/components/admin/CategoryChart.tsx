"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { CategoryTrendDataPoint, CategoryInfo } from "@/types/admin";

interface CategoryChartProps {
  // 記事数データ (4パターン: 日別/月別 × 作成/更新)
  dailyCreatedData: CategoryTrendDataPoint[];
  dailyUpdatedData: CategoryTrendDataPoint[];
  monthlyCreatedData: CategoryTrendDataPoint[];
  monthlyUpdatedData: CategoryTrendDataPoint[];
  // PVデータ (2パターン: 日別/月別)
  dailyPvData: CategoryTrendDataPoint[];
  monthlyPvData: CategoryTrendDataPoint[];
  // 共通
  categories: CategoryInfo[];
  articleCountByCategory: Record<string, number>;
}

type MetricMode = "count" | "pv";
type PeriodMode = "daily" | "monthly";
type DateMode = "created" | "updated";

const COLOR_PALETTE = [
  "#6366f1", "#0ea5e9", "#14b8a6", "#f97316", "#ec4899",
  "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#6b7280",
];

function formatYAxis(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return String(Math.floor(value));
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-neutral-900 text-white"
              : "bg-white text-neutral-500 hover:bg-neutral-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function CategoryChart({
  dailyCreatedData,
  dailyUpdatedData,
  monthlyCreatedData,
  monthlyUpdatedData,
  dailyPvData,
  monthlyPvData,
  categories,
  articleCountByCategory,
}: CategoryChartProps) {
  const [metricMode, setMetricMode] = useState<MetricMode>("count");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [dateMode, setDateMode] = useState<DateMode>("created");

  const catColorMap = new Map<string, string>();
  const catNameMap = new Map<string, string>();
  categories.forEach((cat, i) => {
    catColorMap.set(cat.slug, COLOR_PALETTE[i % COLOR_PALETTE.length]);
    catNameMap.set(cat.slug, cat.name);
  });

  // データ選択
  let activeData: CategoryTrendDataPoint[];
  if (metricMode === "pv") {
    activeData = periodMode === "monthly" ? monthlyPvData : dailyPvData;
  } else {
    activeData =
      periodMode === "daily" && dateMode === "created" ? dailyCreatedData
      : periodMode === "daily" && dateMode === "updated" ? dailyUpdatedData
      : periodMode === "monthly" && dateMode === "created" ? monthlyCreatedData
      : monthlyUpdatedData;
  }

  const tooltipUnit = metricMode === "pv" ? "PV" : "記事";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white py-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-neutral-700">カテゴリ別</h3>
          <ToggleGroup
            options={[
              { value: "count" as MetricMode, label: "記事数" },
              { value: "pv" as MetricMode, label: "PV" },
            ]}
            value={metricMode}
            onChange={setMetricMode}
          />
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup
            options={[
              { value: "daily" as PeriodMode, label: "日別" },
              { value: "monthly" as PeriodMode, label: "月別" },
            ]}
            value={periodMode}
            onChange={setPeriodMode}
          />
          {metricMode === "count" && (
            <>
              <span className="text-neutral-300">|</span>
              <ToggleGroup
                options={[
                  { value: "created" as DateMode, label: "作成" },
                  { value: "updated" as DateMode, label: "更新" },
                ]}
                value={dateMode}
                onChange={setDateMode}
              />
            </>
          )}
        </div>
      </div>

      {activeData.length === 0 ? (
        <div className="flex h-[280px] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-neutral-600">まだデータがありません</p>
          <p className="text-xs text-neutral-400">
            {metricMode === "pv" ? "GA4連携後、PVデータが表示されます" : "記事が投稿されるとデータが表示されます"}
          </p>
        </div>
      ) : metricMode === "pv" ? (
        /* PV: 折れ線グラフ */
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={activeData} margin={{ top: 10, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tickFormatter={formatYAxis}
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
              formatter={(value: number, name: string) => [
                `${value.toLocaleString("ja-JP")} ${tooltipUnit}`,
                catNameMap.get(name) ?? name,
              ]}
            />
            <Legend
              iconType="plainline"
              formatter={(value: string) => catNameMap.get(value) ?? value}
              wrapperStyle={{ fontSize: "12px" }}
            />
            {categories.map((cat) => (
              <Line
                key={cat.slug}
                type="monotone"
                dataKey={cat.slug}
                name={cat.slug}
                stroke={catColorMap.get(cat.slug) ?? "#6b7280"}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        /* 記事数: 幅広棒グラフ */
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={activeData} margin={{ top: 10, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tickFormatter={formatYAxis}
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
              formatter={(value: number, name: string) => [
                `${value} ${tooltipUnit}`,
                catNameMap.get(name) ?? name,
              ]}
            />
            <Legend
              iconType="square"
              formatter={(value: string) => catNameMap.get(value) ?? value}
              wrapperStyle={{ fontSize: "12px" }}
            />
            {categories.map((cat) => (
              <Bar
                key={cat.slug}
                dataKey={cat.slug}
                name={cat.slug}
                stackId="category"
                fill={catColorMap.get(cat.slug) ?? "#6b7280"}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Category summary cards */}
      <div className="mt-4 grid gap-1 px-3" style={{ gridTemplateColumns: `repeat(${Math.min(categories.length, 6)}, 1fr)` }}>
        {categories.map((cat) => {
          const articleCount = articleCountByCategory[cat.slug] ?? 0;

          return (
            <a
              key={cat.slug}
              href={`/admin/articles?category=${cat.slug}`}
              className="flex flex-col items-center rounded-md border border-neutral-100 px-1 py-2 text-center transition-colors hover:bg-neutral-50"
            >
              <span
                className="mb-1 inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: catColorMap.get(cat.slug) ?? "#6b7280" }}
              />
              <span className="text-xs font-medium leading-tight text-neutral-700">
                {cat.name}
              </span>
              <span className="mt-0.5 text-xs font-semibold text-neutral-600">
                {articleCount}記事
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
