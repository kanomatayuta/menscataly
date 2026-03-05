"use client";

import { StatCard } from "./StatCard";
import type { AffiliateLinkPerformance } from "@/types/admin";
import type { AspProgram } from "@/types/asp-config";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface PvDataPoint {
  date: string;
  pageviews: number;
}

interface ArticleDetailStatsProps {
  pv30d: number;
  affiliateClicks: number;
  conversions: number;
  revenue: number;
  pvTrend: PvDataPoint[];
  affiliateLinks: AffiliateLinkPerformance[];
  aspPrograms: AspProgram[];
  /** サマリーカード(4枚)を非表示にする — 親がすでに表示している場合 */
  hideSummaryCards?: boolean;
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}

function PvTrendChart({ data }: { data: PvDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-neutral-400">
        PVデータがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#a3a3a3" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e5e5" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#a3a3a3" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Line
          type="monotone"
          dataKey="pageviews"
          name="PV"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#3b82f6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AffiliateLinkTable({ links }: { links: AffiliateLinkPerformance[] }) {
  if (links.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-neutral-400">
        広告リンクデータがありません
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-2 font-medium text-neutral-600">ASP</th>
            <th className="px-4 py-2 font-medium text-neutral-600">プログラム</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-600">CL</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-600">CV</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-600">収益</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {links.map((link, i) => (
            <tr key={i} className="hover:bg-neutral-50">
              <td className="whitespace-nowrap px-4 py-2 text-neutral-700">{link.aspName}</td>
              <td className="px-4 py-2 text-neutral-700">{link.programName}</td>
              <td className="px-4 py-2 text-right tabular-nums text-neutral-600">
                {formatNumber(link.clickCount)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-neutral-600">
                {formatNumber(link.conversionCount)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums font-medium text-green-700">
                ¥{formatNumber(link.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AspProgramTable({ programs }: { programs: AspProgram[] }) {
  if (programs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-neutral-400">
        ASPプログラムがありません
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-2 font-medium text-neutral-600">プログラム名</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-600">報酬</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-600">EPC</th>
            <th className="px-4 py-2 text-right font-medium text-neutral-600">承認率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {programs.map((prog) => {
            const reward = Array.isArray(prog.rewardTiers) && prog.rewardTiers.length > 0
              ? `¥${formatNumber(prog.rewardTiers[0].amount ?? 0)}`
              : "-";
            return (
              <tr key={prog.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2 text-neutral-700">{prog.programName}</td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-600">{reward}</td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-600">
                  ¥{formatNumber(prog.epc)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-neutral-600">
                  {(prog.approvalRate * 100).toFixed(0)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export function ArticleDetailStats({
  pv30d,
  affiliateClicks,
  conversions,
  revenue,
  pvTrend,
  affiliateLinks,
  aspPrograms,
  hideSummaryCards = false,
}: ArticleDetailStatsProps) {
  const showMainStats = pv30d > 0 || affiliateClicks > 0 || conversions > 0 || revenue > 0 || pvTrend.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary cards — only when there is data and not hidden by parent */}
      {showMainStats && (
        <>
          {!hideSummaryCards && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard title="PV (30日)" value={formatNumber(pv30d)} variant="blue" />
              <StatCard title="広告CL" value={formatNumber(affiliateClicks)} variant="purple" />
              <StatCard title="CV" value={formatNumber(conversions)} variant="default" />
              <StatCard
                title="収益"
                value={`¥${formatNumber(revenue)}`}
                variant={revenue > 0 ? "success" : "warning"}
              />
            </div>
          )}

          {/* PV Trend Chart */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-neutral-800">
              PVトレンド (30日)
            </h3>
            <PvTrendChart data={pvTrend} />
          </div>

          {/* Affiliate Link Performance */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-neutral-800">
              広告リンクパフォーマンス
            </h3>
            <AffiliateLinkTable links={affiliateLinks} />
          </div>
        </>
      )}

      {/* ASP Program List */}
      {aspPrograms.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-neutral-800">
            カテゴリASPプログラム
          </h3>
          <AspProgramTable programs={aspPrograms} />
        </div>
      )}
    </div>
  );
}
