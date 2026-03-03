import type { RevenueSummary } from "@/types/admin";

interface RevenueTableProps {
  summaries: RevenueSummary[];
}

export function RevenueTable({ summaries }: RevenueTableProps) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">No revenue data available</p>
      </div>
    );
  }

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
      ? ((totals.conversions / totals.clicks) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-3 font-medium text-neutral-600">ASP</th>
            <th className="px-4 py-3 text-right font-medium text-neutral-600">
              Clicks
            </th>
            <th className="px-4 py-3 text-right font-medium text-neutral-600">
              Conversions
            </th>
            <th className="px-4 py-3 text-right font-medium text-neutral-600">
              Revenue
            </th>
            <th className="px-4 py-3 text-right font-medium text-neutral-600">
              CVR
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {summaries.map((summary) => (
            <tr key={summary.aspName} className="hover:bg-neutral-50">
              <td className="px-4 py-3 font-medium capitalize text-neutral-900">
                {summary.aspName}
              </td>
              <td className="px-4 py-3 text-right text-neutral-600">
                {summary.totalClicks.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-neutral-600">
                {summary.totalConversions.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-medium text-neutral-900">
                ¥{summary.totalRevenue.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-neutral-600">
                {summary.conversionRate.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-neutral-200 bg-neutral-50 font-semibold">
            <td className="px-4 py-3 text-neutral-900">Total</td>
            <td className="px-4 py-3 text-right text-neutral-900">
              {totals.clicks.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-neutral-900">
              {totals.conversions.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-neutral-900">
              ¥{totals.revenue.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-right text-neutral-900">
              {totalCvr}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
