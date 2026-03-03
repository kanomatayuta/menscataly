import { Suspense } from "react";
import { headers } from "next/headers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { RevenueTable } from "@/components/admin/RevenueTable";
import { RevenueChart } from "@/components/admin/RevenueChart";
import type { RevenueSummary } from "@/types/admin";

// ------------------------------------------------------------------
// Data fetching (Server Component - direct fetch to API route)
// ------------------------------------------------------------------

interface RevenueResponse {
  revenue: RevenueSummary[];
  period: {
    startDate: string;
    endDate: string;
  };
}

async function fetchRevenue(): Promise<RevenueResponse> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  const res = await fetch(`${protocol}://${host}/api/admin/revenue`, {
    cache: "no-store",
    headers: {
      "X-Admin-Api-Key": process.env.ADMIN_API_KEY ?? "",
    },
  });

  if (!res.ok) {
    return { revenue: [], period: { startDate: "", endDate: "" } };
  }

  return res.json();
}

// ------------------------------------------------------------------
// Async content component (wrapped in Suspense)
// ------------------------------------------------------------------

async function RevenueContent() {
  const { revenue: summaries } = await fetchRevenue();

  const totalRevenue = summaries.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalClicks = summaries.reduce((sum, s) => sum + s.totalClicks, 0);
  const totalConversions = summaries.reduce(
    (sum, s) => sum + s.totalConversions,
    0,
  );
  const overallCvr =
    totalClicks > 0
      ? ((totalConversions / totalClicks) * 100).toFixed(2)
      : "0.00";

  return (
    <>
      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`¥${totalRevenue.toLocaleString()}`}
          subtitle="Last 30 days"
          variant="success"
        />
        <StatCard
          title="Total Clicks"
          value={totalClicks.toLocaleString()}
          subtitle="Last 30 days"
        />
        <StatCard
          title="Total Conversions"
          value={totalConversions}
          subtitle="Last 30 days"
        />
        <StatCard
          title="Overall CVR"
          value={`${overallCvr}%`}
          subtitle="Click to conversion"
        />
      </div>

      {/* Revenue chart */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          Revenue by ASP
        </h2>
        <RevenueChart summaries={summaries} />
      </div>

      {/* Revenue table */}
      <h2 className="mb-3 text-lg font-semibold text-neutral-800">
        Revenue Details
      </h2>
      <RevenueTable summaries={summaries} />
    </>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminRevenuePage() {
  return (
    <>
      <AdminHeader title="Revenue" breadcrumbs={[{ label: "Revenue" }]} />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">
              Loading revenue data...
            </span>
          </div>
        }
      >
        <RevenueContent />
      </Suspense>
    </>
  );
}
