import { Suspense } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { RevenueTable } from "@/components/admin/RevenueTable";
import { RevenueChart } from "@/components/admin/RevenueChart";
import type { RevenueSummary } from "@/types/admin";

// ------------------------------------------------------------------
// モックデータ (Supabase 未設定時フォールバック)
// ------------------------------------------------------------------

function getMockRevenueSummary(): RevenueSummary[] {
  return [
    {
      aspName: "afb",
      totalClicks: 1250,
      totalConversions: 8,
      totalRevenue: 92500,
      conversionRate: 0.64,
      monthlyConversions: 8,
      monthlyRevenueJpy: 92500,
      monthOverMonthChange: 15.2,
      topArticles: [
        {
          slug: "aga-treatment-cost-guide",
          title: "AGA治療の費用相場と選び方ガイド",
          conversions: 5,
        },
      ],
    },
    {
      aspName: "a8",
      totalClicks: 890,
      totalConversions: 5,
      totalRevenue: 43000,
      conversionRate: 0.56,
      monthlyConversions: 5,
      monthlyRevenueJpy: 43000,
      monthOverMonthChange: 8.3,
      topArticles: [
        {
          slug: "mens-hair-removal-comparison",
          title: "メンズ医療脱毛おすすめクリニック比較",
          conversions: 3,
        },
      ],
    },
    {
      aspName: "accesstrade",
      totalClicks: 670,
      totalConversions: 3,
      totalRevenue: 36000,
      conversionRate: 0.45,
      monthlyConversions: 3,
      monthlyRevenueJpy: 36000,
      monthOverMonthChange: -2.1,
      topArticles: [],
    },
    {
      aspName: "valuecommerce",
      totalClicks: 420,
      totalConversions: 2,
      totalRevenue: 22000,
      conversionRate: 0.48,
      monthlyConversions: 2,
      monthlyRevenueJpy: 22000,
      monthOverMonthChange: 5.0,
      topArticles: [],
    },
    {
      aspName: "felmat",
      totalClicks: 310,
      totalConversions: 2,
      totalRevenue: 45000,
      conversionRate: 0.65,
      monthlyConversions: 2,
      monthlyRevenueJpy: 45000,
      monthOverMonthChange: 22.0,
      topArticles: [],
    },
  ];
}

// ------------------------------------------------------------------
// Data fetching (直接 Supabase クエリ)
// ------------------------------------------------------------------

interface RevenueResponse {
  revenue: RevenueSummary[];
  period: {
    startDate: string;
    endDate: string;
  };
}

async function fetchRevenueData(): Promise<RevenueResponse> {
  await connection();

  const startDate = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const endDate = new Date().toISOString();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      revenue: getMockRevenueSummary(),
      period: { startDate, endDate },
    };
  }

  try {
    const { createServerSupabaseClient } = await import(
      "@/lib/supabase/client"
    );
    const supabase = createServerSupabaseClient();

    // asp_programs テーブルからASP別集計を取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("asp_programs")
      .select("*")
      .eq("is_active", true);

    if (error) {
      console.error("[admin/revenue] Query error:", error.message);
      return {
        revenue: getMockRevenueSummary(),
        period: { startDate, endDate },
      };
    }

    // ASP名でグループ化
    const aspGroups = new Map<string, typeof data>();
    for (const program of data ?? []) {
      const aspName = program.asp_name as string;
      if (!aspGroups.has(aspName)) {
        aspGroups.set(aspName, []);
      }
      aspGroups.get(aspName)!.push(program);
    }

    const revenue: RevenueSummary[] = Array.from(aspGroups.entries()).map(
      ([aspName]) => ({
        aspName,
        totalClicks: 0,
        totalConversions: 0,
        totalRevenue: 0,
        conversionRate: 0,
        monthlyConversions: 0,
        monthlyRevenueJpy: 0,
        monthOverMonthChange: 0,
        topArticles: [],
      }),
    );

    return { revenue, period: { startDate, endDate } };
  } catch (err) {
    console.error("[admin/revenue] Error:", err);
    return {
      revenue: getMockRevenueSummary(),
      period: { startDate, endDate },
    };
  }
}

// ------------------------------------------------------------------
// Async content component (wrapped in Suspense)
// ------------------------------------------------------------------

async function RevenueContent() {
  const { revenue: summaries } = await fetchRevenueData();

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
          value={`\u00A5${totalRevenue.toLocaleString()}`}
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
