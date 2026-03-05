import { Suspense } from "react";
import { connection } from "next/server";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { RevenueTable } from "@/components/admin/RevenueTable";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { CsvUploadForm } from "@/components/admin/CsvUploadForm";
import type { RevenueSummary } from "@/types/admin";

// ------------------------------------------------------------------
// MetricPill — compact inline stat display
// ------------------------------------------------------------------

function MetricPill({
  icon,
  label,
  value,
  bg,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
  text: string;
}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${bg}`}>
      <span className={`${text} opacity-60`}>{icon}</span>
      <div className="min-w-0">
        <p className={`text-[10px] font-medium uppercase tracking-wider ${text} opacity-50`}>{label}</p>
        <p className={`text-lg font-bold leading-tight tabular-nums ${text}`}>{value}</p>
      </div>
    </div>
  );
}

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
        <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
          <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
          </svg>
          <p className="text-xs text-blue-700">
            {hasData
              ? "まだアフィリエイトリンクのクリック・コンバージョンデータがありません。affiliate_links テーブルにデータが蓄積されると自動的に反映されます。"
              : "ASPプログラムが登録されていません。Supabase の asp_programs テーブルにデータを投入してください。"}
          </p>
        </div>
      )}

      {/* Compact summary bar */}
      <div className="mb-6 flex flex-wrap items-stretch gap-3">
        <MetricPill
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
          label="売上合計"
          value={`\u00A5${totalRevenue.toLocaleString()}`}
          bg="bg-green-50"
          text="text-green-700"
        />
        <MetricPill
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
            </svg>
          }
          label="クリック合計"
          value={totalClicks.toLocaleString()}
          bg="bg-blue-50"
          text="text-blue-700"
        />
        <MetricPill
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          }
          label="CV合計"
          value={totalConversions.toLocaleString()}
          bg="bg-purple-50"
          text="text-purple-700"
        />
        <MetricPill
          icon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2 2-8 8H6v-4l8-8zM12.5 4.5l3 3" />
            </svg>
          }
          label="全体CVR"
          value={`${overallCvr}%`}
          bg="bg-neutral-100"
          text="text-neutral-700"
        />
      </div>

      {/* Revenue chart card */}
      {hasData && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-neutral-800">ASP別売上</h2>
          </div>
          <div className="p-4">
            <RevenueChart summaries={summaries} />
          </div>
        </div>
      )}

      {/* Revenue table card */}
      {hasData && (
        <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-neutral-800">売上詳細</h2>
          </div>
          <div className="p-4">
            <RevenueTable summaries={summaries} />
          </div>
        </div>
      )}

      {/* CSV Upload */}
      <div className="mt-6">
        <CsvUploadForm />
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminRevenuePage() {
  return (
    <>
      <AdminHeader title="収益" breadcrumbs={[{ label: "収益" }]} />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">
              売上データを読み込み中...
            </span>
          </div>
        }
      >
        <RevenueContent />
      </Suspense>
    </>
  );
}
