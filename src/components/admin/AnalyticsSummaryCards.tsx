"use client";

import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TrendDataPoint } from "@/types/admin";

interface AnalyticsSummaryCardsProps {
  totalPageviews: number;
  totalSearchClicks: number;
  totalAffiliateClicks: number;
  totalRevenue: number;
  totalArticles?: number;
  /** @deprecated no longer shown as a card; kept for backward-compatibility */
  totalConversions?: number;
  trendData?: TrendDataPoint[];
}

// ------------------------------------------------------------------
// Sparkline mini chart
// ------------------------------------------------------------------

function Sparkline({
  data,
  dataKey,
  color,
}: {
  data: { date: string; value: number }[];
  dataKey: string;
  color: string;
}) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Tooltip
          contentStyle={{
            fontSize: 11,
            borderRadius: 6,
            border: "1px solid #e5e5e5",
            padding: "4px 8px",
          }}
          formatter={(v: number) => [v.toLocaleString("ja-JP"), dataKey]}
          labelStyle={{ fontSize: 10, color: "#a3a3a3" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ------------------------------------------------------------------
// Trend Card
// ------------------------------------------------------------------

interface TrendCardProps {
  title: string;
  value: string;
  sparkData: { date: string; value: number }[];
  color: string;
  borderColor: string;
  bgColor: string;
  valueColor: string;
  sparkLabel: string;
}

function TrendCard({
  title,
  value,
  sparkData,
  color,
  borderColor,
  bgColor,
  valueColor,
  sparkLabel,
}: TrendCardProps) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${borderColor} ${bgColor}`}>
      <p className="text-xs font-medium text-neutral-500">{title}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {sparkData.length >= 2 && (
        <div className="mt-2">
          <Sparkline data={sparkData} dataKey={sparkLabel} color={color} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------

export function AnalyticsSummaryCards({
  totalPageviews,
  totalSearchClicks,
  totalAffiliateClicks,
  totalRevenue,
  totalArticles = 0,
  trendData = [],
}: AnalyticsSummaryCardsProps) {
  // 直近30日のデータでスパークライン
  const recent = trendData.slice(-30);

  const pvSpark = recent.map((d) => ({ date: d.date, value: d.pageviews }));
  const searchSpark = recent.map((d) => ({ date: d.date, value: d.searchClicks }));
  const affiliateSpark = recent.map((d) => ({ date: d.date, value: d.affiliateClicks }));

  // 広告CTR
  const ctrValue =
    totalPageviews > 0
      ? `${((totalAffiliateClicks / totalPageviews) * 100).toFixed(1)}%`
      : "-";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {/* 総記事数 — スパークラインなし（日次データなし） */}
      <div className="flex flex-col justify-center rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-neutral-500">総記事数</p>
        <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">
          {totalArticles.toLocaleString("ja-JP")}
        </p>
        <p className="mt-1 text-[10px] text-neutral-400">公開済み記事</p>
      </div>

      {/* 総PV */}
      <TrendCard
        title="総PV"
        value={totalPageviews.toLocaleString("ja-JP")}
        sparkData={pvSpark}
        color="#3b82f6"
        borderColor="border-blue-200"
        bgColor="bg-white"
        valueColor="text-blue-700"
        sparkLabel="PV"
      />

      {/* 検索CL */}
      <TrendCard
        title="検索CL"
        value={totalSearchClicks.toLocaleString("ja-JP")}
        sparkData={searchSpark}
        color="#10b981"
        borderColor="border-green-200"
        bgColor="bg-white"
        valueColor="text-green-700"
        sparkLabel="検索CL"
      />

      {/* 広告CTR */}
      <TrendCard
        title="広告CTR"
        value={ctrValue}
        sparkData={affiliateSpark}
        color="#8b5cf6"
        borderColor="border-purple-200"
        bgColor="bg-white"
        valueColor="text-purple-600"
        sparkLabel="広告CL"
      />

      {/* 総収益 */}
      <div className={`rounded-lg border p-4 shadow-sm ${totalRevenue > 0 ? "border-green-300" : "border-amber-200"} bg-white`}>
        <p className="text-xs font-medium text-neutral-500">総収益</p>
        <p className={`mt-0.5 text-xl font-bold tabular-nums ${totalRevenue > 0 ? "text-green-700" : "text-amber-700"}`}>
          ¥{totalRevenue.toLocaleString("ja-JP")}
        </p>
        <p className="mt-1 text-[10px] text-neutral-400">
          {totalRevenue > 0 ? "過去30日間" : "ASP承認後に計上"}
        </p>
      </div>
    </div>
  );
}
