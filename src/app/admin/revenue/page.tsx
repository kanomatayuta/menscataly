import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { RevenueTable } from "@/components/admin/RevenueTable";
import type { RevenueSummary } from "@/types/admin";

// ------------------------------------------------------------------
// Mock data
// ------------------------------------------------------------------

const MOCK_REVENUE_SUMMARIES: RevenueSummary[] = [
  {
    aspName: "afb",
    programCount: 8,
    totalClicks: 1850,
    totalConversions: 24,
    totalRevenue: 62400,
    conversionRate: 1.3,
    period: { startDate: "2026-02-01", endDate: "2026-02-28" },
  },
  {
    aspName: "a8",
    programCount: 12,
    totalClicks: 1420,
    totalConversions: 16,
    totalRevenue: 38000,
    conversionRate: 1.13,
    period: { startDate: "2026-02-01", endDate: "2026-02-28" },
  },
  {
    aspName: "accesstrade",
    programCount: 5,
    totalClicks: 620,
    totalConversions: 8,
    totalRevenue: 18500,
    conversionRate: 1.29,
    period: { startDate: "2026-02-01", endDate: "2026-02-28" },
  },
  {
    aspName: "valuecommerce",
    programCount: 3,
    totalClicks: 240,
    totalConversions: 3,
    totalRevenue: 7200,
    conversionRate: 1.25,
    period: { startDate: "2026-02-01", endDate: "2026-02-28" },
  },
  {
    aspName: "felmat",
    programCount: 2,
    totalClicks: 100,
    totalConversions: 1,
    totalRevenue: 2400,
    conversionRate: 1.0,
    period: { startDate: "2026-02-01", endDate: "2026-02-28" },
  },
];

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminRevenuePage() {
  const totalRevenue = MOCK_REVENUE_SUMMARIES.reduce(
    (sum, s) => sum + s.totalRevenue,
    0,
  );
  const totalClicks = MOCK_REVENUE_SUMMARIES.reduce(
    (sum, s) => sum + s.totalClicks,
    0,
  );
  const totalConversions = MOCK_REVENUE_SUMMARIES.reduce(
    (sum, s) => sum + s.totalConversions,
    0,
  );
  const overallCvr =
    totalClicks > 0
      ? ((totalConversions / totalClicks) * 100).toFixed(2)
      : "0.00";

  return (
    <>
      <AdminHeader
        title="Revenue"
        breadcrumbs={[{ label: "Revenue" }]}
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`¥${totalRevenue.toLocaleString()}`}
          subtitle="Feb 2026"
          variant="success"
        />
        <StatCard
          title="Total Clicks"
          value={totalClicks.toLocaleString()}
          subtitle="Feb 2026"
        />
        <StatCard
          title="Total Conversions"
          value={totalConversions}
          subtitle="Feb 2026"
        />
        <StatCard
          title="Overall CVR"
          value={`${overallCvr}%`}
          subtitle="Click to conversion"
        />
      </div>

      {/* Revenue by ASP */}
      <h2 className="mb-3 text-lg font-semibold text-neutral-800">
        Revenue by ASP
      </h2>
      <RevenueTable summaries={MOCK_REVENUE_SUMMARIES} />
    </>
  );
}
