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

    // affiliate_links テーブルからASP別にクリック数・コンバージョン・収益を集計
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linkData, error: linkError } = await (supabase as any)
      .from("affiliate_links")
      .select(
        "asp_name, click_count, conversion_count, revenue, program_name, article_id",
      );

    if (linkError) {
      console.error("[admin/revenue] affiliate_links query error:", linkError.message);
      return {
        revenue: getMockRevenueSummary(),
        period: { startDate, endDate },
      };
    }

    // リンクデータが存在しない場合は asp_programs からASP名一覧を取得してゼロデータを返す
    if (!linkData || linkData.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: programs, error: progError } = await (supabase as any)
        .from("asp_programs")
        .select("asp_name")
        .eq("is_active", true);

      if (progError || !programs || programs.length === 0) {
        return { revenue: [], period: { startDate, endDate } };
      }

      // ASP名の重複を除去してゼロデータとして返す
      const aspNames = Array.from(
        new Set(programs.map((p: { asp_name: string }) => p.asp_name as string)),
      ) as string[];
      const revenue: RevenueSummary[] = aspNames.map((aspName) => ({
        aspName,
        totalClicks: 0,
        totalConversions: 0,
        totalRevenue: 0,
        conversionRate: 0,
        monthlyConversions: 0,
        monthlyRevenueJpy: 0,
        monthOverMonthChange: 0,
        topArticles: [],
      }));
      return { revenue, period: { startDate, endDate } };
    }

    // ASP名でグループ化して集計
    const aspMap = new Map<
      string,
      {
        clicks: number;
        conversions: number;
        revenue: number;
        articleConversions: Map<string, { article_id: string; conversions: number }>;
      }
    >();

    for (const link of linkData) {
      const aspName = link.asp_name as string;
      if (!aspMap.has(aspName)) {
        aspMap.set(aspName, {
          clicks: 0,
          conversions: 0,
          revenue: 0,
          articleConversions: new Map(),
        });
      }
      const entry = aspMap.get(aspName)!;
      entry.clicks += Number(link.click_count ?? 0);
      entry.conversions += Number(link.conversion_count ?? 0);
      entry.revenue += Number(link.revenue ?? 0);

      // 記事別コンバージョン集計 (topArticles用)
      if (link.article_id) {
        const artKey = link.article_id as string;
        const existing = entry.articleConversions.get(artKey);
        const cv = Number(link.conversion_count ?? 0);
        if (existing) {
          existing.conversions += cv;
        } else {
          entry.articleConversions.set(artKey, {
            article_id: artKey,
            conversions: cv,
          });
        }
      }
    }

    // 記事タイトルを取得 (上位記事表示用)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: articles } = await (supabase as any)
      .from("articles")
      .select("id, title, slug");

    const articleMap = new Map<string, { title: string; slug: string }>();
    for (const article of articles ?? []) {
      articleMap.set(article.id as string, {
        title: article.title as string,
        slug: article.slug as string,
      });
    }

    // RevenueSummary配列を構築
    const revenue: RevenueSummary[] = Array.from(aspMap.entries()).map(
      ([aspName, agg]) => {
        const conversionRate =
          agg.clicks > 0 ? (agg.conversions / agg.clicks) * 100 : 0;

        // topArticles: コンバージョン数の多い上位3件
        const topArticles = Array.from(agg.articleConversions.values())
          .sort((a, b) => b.conversions - a.conversions)
          .slice(0, 3)
          .map((art) => {
            const meta = articleMap.get(art.article_id);
            return {
              slug: meta?.slug ?? art.article_id,
              title: meta?.title ?? "—",
              conversions: art.conversions,
            };
          });

        return {
          aspName,
          totalClicks: agg.clicks,
          totalConversions: agg.conversions,
          totalRevenue: Math.round(agg.revenue),
          conversionRate: Math.round(conversionRate * 100) / 100,
          monthlyConversions: agg.conversions,
          monthlyRevenueJpy: Math.round(agg.revenue),
          monthOverMonthChange: 0, // 前月比は履歴データがないため0
          topArticles,
        };
      },
    );

    // 収益の多い順にソート
    revenue.sort((a, b) => b.totalRevenue - a.totalRevenue);

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

  const hasData = summaries.length > 0;
  const hasActualData =
    hasData &&
    summaries.some(
      (s) => s.totalClicks > 0 || s.totalConversions > 0 || s.totalRevenue > 0,
    );

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
      {/* データなしの場合はインフォバナーを表示 */}
      {!hasActualData && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-800">
            {hasData
              ? "まだアフィリエイトリンクのクリック・コンバージョンデータがありません。affiliate_links テーブルにデータが蓄積されると自動的に反映されます。"
              : "ASPプログラムが登録されていません。Supabase の asp_programs テーブルにデータを投入してください。"}
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={
            hasActualData
              ? `\u00A5${totalRevenue.toLocaleString()}`
              : "データなし"
          }
          subtitle="Last 30 days"
          variant="success"
        />
        <StatCard
          title="Total Clicks"
          value={
            hasActualData ? totalClicks.toLocaleString() : "データなし"
          }
          subtitle="Last 30 days"
        />
        <StatCard
          title="Total Conversions"
          value={hasActualData ? totalConversions : "データなし"}
          subtitle="Last 30 days"
        />
        <StatCard
          title="Overall CVR"
          value={hasActualData ? `${overallCvr}%` : "データなし"}
          subtitle="Click to conversion"
        />
      </div>

      {/* Revenue chart */}
      {hasData && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Revenue by ASP
          </h2>
          <RevenueChart summaries={summaries} />
        </div>
      )}

      {/* Revenue table */}
      {hasData && (
        <>
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Revenue Details
          </h2>
          <RevenueTable summaries={summaries} />
        </>
      )}
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
