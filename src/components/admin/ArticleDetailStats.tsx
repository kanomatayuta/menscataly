"use client";

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

/** Blue/slate themed summary card for article analytics */
function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function PvTrendChart({ data }: { data: PvDataPoint[] }) {
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
          dot={data.length <= 7}
          activeDot={{ r: 4, fill: "#3b82f6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AffiliateLinkTable({ links }: { links: AffiliateLinkPerformance[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-4 py-2 font-medium text-slate-600">ASP名</th>
            <th className="px-4 py-2 font-medium text-slate-600">プログラム名</th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">CL数</th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">CV数</th>
            <th className="px-4 py-2 text-right font-medium text-slate-600">収益</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {links.map((link, i) => (
            <tr key={i} className="hover:bg-slate-50/60">
              <td className="whitespace-nowrap px-4 py-2 text-slate-700">{link.aspName}</td>
              <td className="px-4 py-2 text-slate-700">{link.programName}</td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                {formatNumber(link.clickCount)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-slate-600">
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
  return (
    <div className="overflow-auto pb-1">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="whitespace-nowrap px-4 py-2 font-medium text-slate-600">プログラム名</th>
            <th className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-600">報酬</th>
            <th className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-600">EPC</th>
            <th className="whitespace-nowrap px-4 py-2 text-right font-medium text-slate-600">承認率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {programs.map((prog) => {
            const reward = Array.isArray(prog.rewardTiers) && prog.rewardTiers.length > 0
              ? `¥${formatNumber(prog.rewardTiers[0].amount ?? 0)}`
              : "-";
            const rate = prog.approvalRate > 1
              ? `${Math.round(prog.approvalRate)}%`
              : prog.approvalRate > 0
                ? `${(prog.approvalRate * 100).toFixed(0)}%`
                : "-";
            return (
              <tr key={prog.id} className="hover:bg-slate-50/60">
                <td className="max-w-[300px] px-4 py-2">
                  <a
                    href={`/admin/asp?id=${encodeURIComponent(prog.id)}`}
                    className="block truncate text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-blue-600 hover:decoration-blue-400"
                    title={prog.programName}
                  >
                    {prog.programName}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-slate-600">{reward}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-slate-600">
                  ¥{formatNumber(prog.epc)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-slate-600">
                  {rate}
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
  const hasPvData = pvTrend.length > 0;
  const hasAffiliateLinks = affiliateLinks.length > 0;
  const hasAspPrograms = aspPrograms.length > 0;
  const showSummary = !hideSummaryCards && (pv30d > 0 || affiliateClicks > 0 || conversions > 0 || revenue > 0);

  return (
    <div className="space-y-6">
      {/* Summary cards — only when there is data and not hidden by parent */}
      {showSummary && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <SummaryCard label="PV(30日)" value={formatNumber(pv30d)} />
          <SummaryCard label="広告CL" value={formatNumber(affiliateClicks)} />
          <SummaryCard label="CV" value={formatNumber(conversions)} />
          <SummaryCard label="収益" value={`¥${formatNumber(revenue)}`} />
        </div>
      )}

      {/* PV Trend Chart — only if there's actual trend data */}
      {hasPvData && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            PVトレンド (30日)
          </h3>
          <PvTrendChart data={pvTrend} />
        </div>
      )}

      {/* Affiliate Link Performance — only if links exist */}
      {hasAffiliateLinks && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            広告リンクパフォーマンス
          </h3>
          <AffiliateLinkTable links={affiliateLinks} />
        </div>
      )}

      {/* ASP Program List — only if programs exist */}
      {hasAspPrograms && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            カテゴリASPプログラム
          </h3>
          <AspProgramTable programs={aspPrograms} />
        </div>
      )}
    </div>
  );
}
