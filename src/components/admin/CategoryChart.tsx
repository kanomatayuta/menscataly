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
} from "recharts";
import type { CategoryTrendDataPoint } from "@/types/admin";

interface CategoryChartProps {
  data: CategoryTrendDataPoint[];
  articleCountByCategory: Record<string, number>;
}

const CATEGORY_CONFIG = [
  { key: "aga",         label: "AGA治療",      color: "#6366f1" },
  { key: "ed",          label: "ED治療",       color: "#0ea5e9" },
  { key: "hairRemoval", label: "医療脱毛",     color: "#14b8a6" },
  { key: "skincare",    label: "スキンケア",   color: "#f97316" },
  { key: "supplement",  label: "サプリメント", color: "#ec4899" },
];

function formatYAxis(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return String(value);
}

export function CategoryChart({ data, articleCountByCategory }: CategoryChartProps) {
  // Compute per-category total PV for summary cards
  const categoryTotals: Record<string, number> = {};
  for (const cat of CATEGORY_CONFIG) {
    categoryTotals[cat.key] = data.reduce(
      (sum, point) => sum + ((point as unknown as Record<string, number>)[cat.key] ?? 0),
      0,
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white py-4 shadow-sm">
      <div className="mb-4 px-3">
        <h3 className="text-sm font-semibold text-neutral-700">カテゴリ別PV</h3>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[280px] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-neutral-600">まだデータがありません</p>
          <p className="text-xs text-neutral-400">GA4連携後、カテゴリ別データが表示されます</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 10, right: 5, left: -15, bottom: 5 }}>
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
              formatter={(value: number, name: string) => {
                const cat = CATEGORY_CONFIG.find((c) => c.key === name);
                return [value.toLocaleString("ja-JP"), cat?.label ?? name];
              }}
            />
            <Legend
              iconType="square"
              formatter={(value: string) => {
                const cat = CATEGORY_CONFIG.find((c) => c.key === value);
                return cat?.label ?? value;
              }}
              wrapperStyle={{ fontSize: "12px" }}
            />
            {CATEGORY_CONFIG.map((cat) => (
              <Bar
                key={cat.key}
                dataKey={cat.key}
                name={cat.key}
                stackId="category"
                fill={cat.color}
                maxBarSize={60}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Category summary cards */}
      <div className="mt-4 grid grid-cols-5 gap-1 px-3">
        {CATEGORY_CONFIG.map((cat) => {
          const articleCount = articleCountByCategory[cat.key] ?? 0;
          const totalPv = categoryTotals[cat.key] ?? 0;
          const avgPv =
            articleCount > 0 ? Math.round(totalPv / articleCount) : 0;

          return (
            <a
              key={cat.key}
              href={`/admin/articles?category=${cat.key}`}
              className="flex flex-col items-center rounded-md border border-neutral-100 px-1 py-2 text-center transition-colors hover:bg-neutral-50"
            >
              <span
                className="mb-1 inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-xs font-medium leading-tight text-neutral-700">
                {cat.label}
              </span>
              <span className="mt-0.5 text-xs text-neutral-500">
                {articleCount}記事
              </span>
              <span className="text-xs text-neutral-400">
                avg {avgPv.toLocaleString("ja-JP")} PV
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
