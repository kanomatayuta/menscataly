import Link from "next/link";
import type { RevenueSummary } from "@/types/admin";

// ============================================================
// ASP display name mapping
// ============================================================

const ASP_DISPLAY_NAMES: Record<string, string> = {
  afb: "afb",
  a8: "A8.net",
  accesstrade: "アクセストレード",
  valuecommerce: "バリューコマース",
  felmat: "felmat",
  moshimo: "もしもアフィリエイト",
};

// ============================================================
// ASP badge color mapping (Tailwind classes)
// ============================================================

const ASP_BADGE_COLORS: Record<
  string,
  { bg: string; text: string; ring: string; bar: string }
> = {
  afb: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    ring: "ring-blue-600/20",
    bar: "bg-blue-500",
  },
  a8: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    ring: "ring-emerald-600/20",
    bar: "bg-emerald-500",
  },
  accesstrade: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    ring: "ring-amber-600/20",
    bar: "bg-amber-500",
  },
  valuecommerce: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    ring: "ring-purple-600/20",
    bar: "bg-purple-500",
  },
  felmat: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-600/20",
    bar: "bg-red-500",
  },
  moshimo: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    ring: "ring-teal-600/20",
    bar: "bg-teal-500",
  },
};

const DEFAULT_BADGE_COLORS = {
  bg: "bg-neutral-50",
  text: "text-neutral-700",
  ring: "ring-neutral-600/20",
  bar: "bg-neutral-400",
};

// ============================================================
// Helpers
// ============================================================

function getAspDisplayName(aspName: string): string {
  return ASP_DISPLAY_NAMES[aspName] ?? aspName;
}

function getAspColors(aspName: string) {
  return ASP_BADGE_COLORS[aspName] ?? DEFAULT_BADGE_COLORS;
}

/** CVR color coding: green >=1%, yellow 0.5-1%, red <0.5% */
function getCvrColorClasses(cvr: number): string {
  if (cvr >= 1) return "text-emerald-700 bg-emerald-50";
  if (cvr >= 0.5) return "text-amber-700 bg-amber-50";
  return "text-red-700 bg-red-50";
}

// ============================================================
// Sub-components
// ============================================================

function AspBadge({ aspName }: { aspName: string }) {
  const colors = getAspColors(aspName);
  const displayName = getAspDisplayName(aspName);

  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${colors.bg} ${colors.text} ${colors.ring}`}
    >
      {displayName}
    </span>
  );
}

function RevenueBar({
  value,
  maxValue,
  aspName,
}: {
  value: number;
  maxValue: number;
  aspName: string;
}) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  const colors = getAspColors(aspName);

  return (
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
      <div
        className={`h-full rounded-full transition-all ${colors.bar}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CvrBadge({ cvr }: { cvr: number }) {
  const colorClasses = getCvrColorClasses(cvr);

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${colorClasses}`}
    >
      {cvr.toFixed(2)}%
    </span>
  );
}

function TopArticlesList({
  articles,
}: {
  articles: { slug: string; title: string; conversions: number }[];
}) {
  if (articles.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {articles.map((article) => (
        <div key={article.slug} className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-400">&#9654;</span>
          <Link
            href={`/admin/articles/${article.slug}`}
            className="truncate text-xs text-blue-600 hover:text-blue-800 hover:underline"
            title={article.title}
          >
            {article.title}
          </Link>
          <span className="ml-auto shrink-0 text-[10px] font-medium text-neutral-500">
            {article.conversions}CV
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

interface RevenueTableProps {
  summaries: RevenueSummary[];
}

export function RevenueTable({ summaries }: RevenueTableProps) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">売上データがありません</p>
      </div>
    );
  }

  // Compute totals for footer row
  const totals = summaries.reduce(
    (acc, s) => ({
      clicks: acc.clicks + s.totalClicks,
      conversions: acc.conversions + s.totalConversions,
      revenue: acc.revenue + s.totalRevenue,
    }),
    { clicks: 0, conversions: 0, revenue: 0 },
  );

  const totalCvr =
    totals.clicks > 0
      ? Math.round((totals.conversions / totals.clicks) * 10000) / 100
      : 0;

  // Max revenue for progress bar scaling
  const maxRevenue = Math.max(...summaries.map((s) => s.totalRevenue), 1);

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-3 font-medium text-neutral-600">ASP</th>
            <th className="px-4 py-3 text-right font-medium text-neutral-600">
              クリック数
            </th>
            <th className="px-4 py-3 text-right font-medium text-neutral-600">
              CV数
            </th>
            <th className="min-w-[140px] px-4 py-3 text-right font-medium text-neutral-600">
              売上
            </th>
            <th className="px-4 py-3 text-right font-medium text-neutral-600">
              CVR
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {summaries.map((summary) => (
            <tr
              key={summary.aspName}
              className="group transition-colors hover:bg-neutral-50/80"
            >
              {/* ASP name badge + top articles */}
              <td className="px-4 py-3 align-top">
                <AspBadge aspName={summary.aspName} />
                <TopArticlesList articles={summary.topArticles} />
              </td>

              {/* Clicks */}
              <td className="px-4 py-3 text-right align-top tabular-nums text-neutral-600">
                {summary.totalClicks.toLocaleString()}
              </td>

              {/* Conversions */}
              <td className="px-4 py-3 text-right align-top tabular-nums text-neutral-600">
                {summary.totalConversions.toLocaleString()}
              </td>

              {/* Revenue with progress bar */}
              <td className="px-4 py-3 text-right align-top">
                <span className="font-semibold tabular-nums text-neutral-900">
                  &yen;{summary.totalRevenue.toLocaleString()}
                </span>
                <RevenueBar
                  value={summary.totalRevenue}
                  maxValue={maxRevenue}
                  aspName={summary.aspName}
                />
              </td>

              {/* CVR with color coding */}
              <td className="px-4 py-3 text-right align-top">
                <CvrBadge cvr={summary.conversionRate} />
              </td>
            </tr>
          ))}
        </tbody>

        {/* Totals footer */}
        <tfoot>
          <tr className="border-t-2 border-neutral-300 bg-neutral-50">
            <td className="px-4 py-3 font-bold text-neutral-900">合計</td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">
              {totals.clicks.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right font-semibold tabular-nums text-neutral-900">
              {totals.conversions.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right font-bold tabular-nums text-neutral-900">
              &yen;{totals.revenue.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right">
              <CvrBadge cvr={totalCvr} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
