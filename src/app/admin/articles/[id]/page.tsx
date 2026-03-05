import { Suspense } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ArticleDetailTabs } from "@/components/admin/ArticleDetailTabs";
import type { ArticleReviewDetail, AffiliateLinkPerformance } from "@/types/admin";
import type { ContentCategory } from "@/types/content";
import type { AspProgram } from "@/types/asp-config";

// ------------------------------------------------------------------
// Mock data (Supabase未設定時のフォールバック)
// ------------------------------------------------------------------

const MOCK_ARTICLES: Record<string, ArticleReviewDetail> = {
  "rev-1": {
    id: "rev-1",
    contentId: "cnt-1",
    articleId: "art-1",
    microcmsId: "mc-abc123",
    title: "AGA治療の基礎知識 — 原因・治療法・費用を徹底解説",
    slug: "aga-basic-guide",
    category: "aga",
    complianceScore: 96,
    status: "approved",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-01T06:30:00+09:00",
    reviewedAt: "2026-03-01T10:00:00+09:00",
    reviewedBy: "admin",
    reviewNotes: null,
    reviewComment: null,
    complianceBreakdown: {
      yakkinhou: 98,
      keihinhou: 95,
      sutema: 96,
      eeat: 94,
    },
    reviewHistory: [
      {
        id: "rc-1",
        author: "admin",
        content: "薬機法チェック完了。問題なし。E-E-A-T要件も満たしています。",
        action: "approve",
        createdAt: "2026-03-01T10:00:00+09:00",
      },
    ],
  },
  "rev-2": {
    id: "rev-2",
    contentId: "cnt-2",
    articleId: "art-2",
    microcmsId: "mc-def456",
    title: "メンズ医療脱毛おすすめクリニック比較2026",
    slug: "mens-hair-removal-clinics-2026",
    category: "hair-removal",
    complianceScore: 91,
    status: "pending",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-02T06:30:00+09:00",
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
    reviewComment: null,
    complianceBreakdown: {
      yakkinhou: 92,
      keihinhou: 88,
      sutema: 95,
      eeat: 90,
    },
    reviewHistory: [],
  },
  "rev-3": {
    id: "rev-3",
    contentId: "cnt-3",
    articleId: "art-3",
    microcmsId: null,
    title: "ED治療薬の種類と効果 — バイアグラ・シアリス・レビトラ",
    slug: "ed-medication-comparison",
    category: "ed",
    complianceScore: 78,
    status: "rejected",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-02T06:35:00+09:00",
    reviewedAt: "2026-03-02T11:00:00+09:00",
    reviewedBy: "admin",
    reviewNotes: "Compliance score too low. Multiple NG expressions found.",
    reviewComment: "Compliance score too low. Multiple NG expressions found.",
    complianceBreakdown: {
      yakkinhou: 65,
      keihinhou: 82,
      sutema: 90,
      eeat: 75,
    },
    reviewHistory: [
      {
        id: "rc-2",
        author: "admin",
        content: "薬機法スコアが基準値を下回っています。「確実に効果がある」「副作用なし」等のNG表現が複数検出されました。修正してください。",
        action: "reject",
        createdAt: "2026-03-02T11:00:00+09:00",
      },
    ],
  },
  "rev-4": {
    id: "rev-4",
    contentId: "cnt-4",
    articleId: "art-4",
    microcmsId: "mc-ghi789",
    title: "メンズスキンケア入門 — 肌タイプ別おすすめルーティン",
    slug: "mens-skincare-routine",
    category: "skincare",
    complianceScore: 98,
    status: "published",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-03T06:30:00+09:00",
    reviewedAt: "2026-03-03T08:00:00+09:00",
    reviewedBy: "admin",
    reviewNotes: null,
    reviewComment: null,
    complianceBreakdown: {
      yakkinhou: 99,
      keihinhou: 98,
      sutema: 97,
      eeat: 96,
    },
    reviewHistory: [
      {
        id: "rc-3",
        author: "admin",
        content: "全項目クリア。品質良好です。",
        action: "approve",
        createdAt: "2026-03-03T08:00:00+09:00",
      },
      {
        id: "rc-4",
        author: "admin",
        content: "microCMSへの公開が完了しました。",
        action: "comment",
        createdAt: "2026-03-03T08:30:00+09:00",
      },
    ],
  },
  "rev-5": {
    id: "rev-5",
    contentId: "cnt-5",
    articleId: "art-5",
    microcmsId: null,
    title: "フィナステリドとデュタステリドの違い — 効果・副作用・選び方",
    slug: "finasteride-vs-dutasteride",
    category: "aga",
    complianceScore: 88,
    status: "revision",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-03T06:35:00+09:00",
    reviewedAt: "2026-03-03T09:00:00+09:00",
    reviewedBy: "admin",
    reviewNotes: null,
    reviewComment: null,
    complianceBreakdown: {
      yakkinhou: 85,
      keihinhou: 90,
      sutema: 92,
      eeat: 84,
    },
    reviewHistory: [
      {
        id: "rc-5",
        author: "admin",
        content: "E-E-A-Tスコアが低めです。監修者情報と参考文献を追加してください。薬機法スコアも改善が必要です。",
        action: "revision",
        createdAt: "2026-03-03T09:00:00+09:00",
      },
    ],
  },
};

// ------------------------------------------------------------------
// Category label mapping
// ------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  aga: "AGA治療",
  "hair-removal": "医療脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
  column: "コラム",
};

// ------------------------------------------------------------------
// Data fetching — API → Supabase → mock fallback
// ------------------------------------------------------------------

async function fetchArticleDetail(id: string): Promise<ArticleReviewDetail | null> {
  // PPR対応: プリレンダリング時はモックにフォールバック
  try {
    await connection();
  } catch {
    return MOCK_ARTICLES[id] ?? null;
  }

  // microCMS から直接取得を試みる
  try {
    const { getArticleById } = await import("@/lib/microcms/client");
    const item = await getArticleById(id);
    if (item) {
      return {
        id: item.id,
        contentId: item.id,
        articleId: item.id,
        microcmsId: item.id,
        title: item.title,
        slug: item.slug ?? item.id,
        category: (item.category?.slug ?? "column") as ContentCategory,
        complianceScore: item.compliance_score ?? 0,
        status: "published",
        authorName: item.author_name ?? "メンズカタリ編集部",
        generatedAt: item.publishedAt ?? item.createdAt,
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: null,
        reviewComment: null,
        complianceBreakdown: {
          yakkinhou: item.compliance_score ?? 0,
          keihinhou: item.compliance_score ?? 0,
          sutema: item.compliance_score ?? 0,
          eeat: item.compliance_score ?? 0,
        },
        reviewHistory: [],
        content: item.content,
        seoTitle: item.seo_title,
        seoDescription: item.excerpt,
      };
    }
  } catch (err) {
    console.error(`[admin/articles/${id}] microCMS fetch error:`, err);
  }

  // Supabase未設定時はモックにフォールバック
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return MOCK_ARTICLES[id] ?? null;
  }

  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const apiKey = process.env.ADMIN_API_KEY ?? process.env.PIPELINE_API_KEY ?? "";

    const res = await fetch(
      `${protocol}://${host}/api/admin/articles/${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      console.error(`[admin/articles/${id}] API error: HTTP ${res.status}`);
      return MOCK_ARTICLES[id] ?? null;
    }

    const data = await res.json() as { article: ArticleReviewDetail };
    return data.article ?? null;
  } catch (err) {
    console.error(`[admin/articles/${id}] Fetch error:`, err);
    return MOCK_ARTICLES[id] ?? null;
  }
}

// ------------------------------------------------------------------
// Analytics data fetching for article detail page
// ------------------------------------------------------------------

interface ArticleAnalyticsData {
  pv30d: number;
  affiliateClicks: number;
  conversions: number;
  revenue: number;
  pvTrend: { date: string; pageviews: number }[];
  affiliateLinks: AffiliateLinkPerformance[];
  aspPrograms: AspProgram[];
}

async function fetchArticleAnalytics(
  slug: string,
  articleId: string,
  category: ContentCategory,
): Promise<ArticleAnalyticsData> {
  const result: ArticleAnalyticsData = {
    pv30d: 0,
    affiliateClicks: 0,
    conversions: 0,
    revenue: 0,
    pvTrend: [],
    affiliateLinks: [],
    aspPrograms: [],
  };

  try {
    await connection();

    // GA4 PV + affiliate clicks を並列取得
    const { fetchGA4DailyMetrics, extractSlugFromPath, fetchAffiliateClicks } = await import("@/lib/analytics/ga4-client");
    const [ga4Data, affiliateData] = await Promise.all([
      fetchGA4DailyMetrics("30daysAgo", "today"),
      fetchAffiliateClicks("30daysAgo", "today"),
    ]);

    // PV日別集計 (この記事のみ)
    const pvByDate = new Map<string, number>();
    for (const row of ga4Data) {
      const rowSlug = extractSlugFromPath(row.pagePath);
      if (rowSlug !== slug) continue;
      result.pv30d += row.pageviews;
      const d = new Date(row.date);
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      pvByDate.set(label, (pvByDate.get(label) ?? 0) + row.pageviews);
    }

    // 日別PVトレンド
    result.pvTrend = [...pvByDate.entries()].map(([date, pageviews]) => ({ date, pageviews }));

    // アフィリエイトクリック集計
    for (const row of affiliateData) {
      const rowSlug = extractSlugFromPath(row.pagePath);
      if (rowSlug !== slug) continue;
      result.affiliateClicks += row.clickCount;
    }
  } catch (err) {
    console.error(`[admin/articles/${articleId}] GA4 analytics error:`, err);
  }

  // Supabase: affiliate_links + revenue (article_id はスラッグまたはmicroCMS IDで検索)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const { createServerSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = createServerSupabaseClient();

      // article_id または slug でマッチを試みる (エラーは無視)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: links } = await (supabase as any)
        .from("affiliate_links")
        .select("*")
        .or(`article_id.eq.${articleId},article_id.eq.${slug}`)
        .order("click_count", { ascending: false });

      if (links && links.length > 0) {
        result.affiliateLinks = links.map((l: { asp_name: string; program_name: string; click_count: number; conversion_count: number; revenue: number }) => ({
          aspName: l.asp_name,
          programName: l.program_name,
          clickCount: l.click_count,
          conversionCount: l.conversion_count,
          revenue: l.revenue,
        }));

        result.conversions = links.reduce((s: number, l: { conversion_count: number }) => s + (l.conversion_count ?? 0), 0);
        result.revenue = links.reduce((s: number, l: { revenue: number }) => s + (l.revenue ?? 0), 0);
      }
    }
  } catch {
    // Supabase未接続やテーブル未作成時は静かにスキップ
  }

  // ASP programs by category
  try {
    const { getProgramsByCategoryFromDB } = await import("@/lib/asp/repository");
    result.aspPrograms = await getProgramsByCategoryFromDB(category);
  } catch (err) {
    console.error(`[admin/articles/${articleId}] ASP programs error:`, err);
  }

  return result;
}

// ------------------------------------------------------------------
// Summary metric pill
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

function ComplianceRing({ score }: { score: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 95 ? "#22c55e" : score >= 80 ? "#eab308" : "#ef4444";
  return (
    <div className="flex items-center gap-2 rounded-lg bg-neutral-50 px-3 py-2">
      <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e5e5" strokeWidth="4" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
        <text x="22" y="23" textAnchor="middle" dominantBaseline="central"
          className="text-[11px] font-bold" fill={color}>
          {score}
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">コンプラ</p>
        <p className="text-xs text-neutral-500">スコア</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Dynamic content component (inside Suspense)
// ------------------------------------------------------------------

async function ArticleDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await fetchArticleDetail(id);

  if (!article) {
    return (
      <>
        <AdminHeader
          title="記事が見つかりません"
          breadcrumbs={[
            { label: "記事一覧", href: "/admin/articles" },
            { label: "Not Found" },
          ]}
        />
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-500">
            ID &quot;{id}&quot; の記事は見つかりませんでした。
          </p>
        </div>
      </>
    );
  }

  // Fetch analytics data
  const analytics = await fetchArticleAnalytics(
    article.slug,
    article.articleId ?? article.id,
    article.category as ContentCategory,
  );

  const categoryLabel = CATEGORY_LABELS[article.category] ?? article.category;

  // Format number helper
  const fmt = (n: number) => n.toLocaleString("ja-JP");

  return (
    <>
      <AdminHeader
        title="記事詳細"
        breadcrumbs={[
          { label: "記事一覧", href: "/admin/articles" },
          { label: article.title },
        ]}
      />

      {/* Summary metric pills */}
      <div className="mb-6 flex flex-wrap items-stretch gap-3">
        {/* Status */}
        <div className="flex items-center rounded-lg bg-white px-4 py-2 shadow-sm ring-1 ring-neutral-200">
          <StatusBadge status={article.status} size="md" />
        </div>

        {/* PV */}
        <MetricPill
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
          label="PV (30日)"
          value={fmt(analytics.pv30d)}
          bg="bg-blue-50"
          text="text-blue-700"
        />

        {/* Affiliate clicks */}
        <MetricPill
          icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>}
          label="広告CL"
          value={fmt(analytics.affiliateClicks)}
          bg="bg-purple-50"
          text="text-purple-700"
        />

        {/* CV — only if > 0 */}
        {analytics.conversions > 0 && (
          <MetricPill
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="CV"
            value={fmt(analytics.conversions)}
            bg="bg-emerald-50"
            text="text-emerald-700"
          />
        )}

        {/* Revenue — only if > 0 */}
        {analytics.revenue > 0 && (
          <MetricPill
            icon={<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            label="収益"
            value={`¥${fmt(analytics.revenue)}`}
            bg="bg-green-50"
            text="text-green-700"
          />
        )}

        {/* Compliance ring */}
        <ComplianceRing score={article.complianceScore} />
      </div>

      {/* Tab-based content: 詳細分析 / プレビュー */}
      <ArticleDetailTabs
        article={{
          id: article.id,
          title: article.title,
          slug: article.slug,
          category: article.category,
          complianceScore: article.complianceScore,
          status: article.status,
          authorName: article.authorName,
          generatedAt: article.generatedAt,
          reviewedAt: article.reviewedAt ?? null,
          reviewedBy: article.reviewedBy ?? null,
          microcmsId: article.microcmsId ?? null,
          complianceBreakdown: article.complianceBreakdown,
          reviewHistory: article.reviewHistory,
          articleId: article.articleId,
          contentId: article.contentId,
        }}
        analytics={{
          pv30d: analytics.pv30d,
          affiliateClicks: analytics.affiliateClicks,
          conversions: analytics.conversions,
          revenue: analytics.revenue,
          pvTrend: analytics.pvTrend,
          affiliateLinks: analytics.affiliateLinks,
          aspPrograms: analytics.aspPrograms,
        }}
        categoryLabel={categoryLabel}
      />
    </>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

// Provide at least one static param for Cache Components build validation
export function generateStaticParams() {
  return [{ id: "rev-1" }];
}

type Props = {
  params: Promise<{ id: string }>;
};

export default function AdminArticleDetailPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-neutral-500">記事を読み込み中...</span>
        </div>
      }
    >
      <ArticleDetailContent params={params} />
    </Suspense>
  );
}
