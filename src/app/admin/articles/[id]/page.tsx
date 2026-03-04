import { Suspense } from "react";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ComplianceScoreBadge } from "@/components/admin/ComplianceScoreBadge";
import { ComplianceBreakdown } from "@/components/admin/ComplianceBreakdown";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { ReviewCommentHistory } from "@/components/admin/ReviewCommentHistory";
import { StatusBadge, StatusWorkflow } from "@/components/admin/StatusBadge";
import type { ArticleReviewDetail } from "@/types/admin";

// ------------------------------------------------------------------
// Mock data
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
// Dynamic content component (inside Suspense)
// ------------------------------------------------------------------

async function ArticleDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = MOCK_ARTICLES[id];

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

  return (
    <>
      <AdminHeader
        title="記事レビュー"
        breadcrumbs={[
          { label: "記事一覧", href: "/admin/articles" },
          { label: article.title },
        ]}
      />

      {/* Status workflow */}
      <div className="mb-6">
        <StatusWorkflow current={article.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: Article details + Compliance breakdown + Review history */}
        <div className="space-y-6 lg:col-span-2">
          {/* Article meta info */}
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-neutral-900">
                {article.title}
              </h2>
              <StatusBadge status={article.status} size="md" />
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-neutral-500">カテゴリ</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {CATEGORY_LABELS[article.category] ?? article.category}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">スラッグ</dt>
                <dd className="mt-0.5 font-mono text-xs text-neutral-700">
                  {article.slug}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">著者</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {article.authorName}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">生成日時</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {new Date(article.generatedAt).toLocaleString("ja-JP")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">
                  コンプライアンススコア
                </dt>
                <dd className="mt-1">
                  <ComplianceScoreBadge score={article.complianceScore} />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">microCMS ID</dt>
                <dd className="mt-0.5 font-mono text-xs text-neutral-700">
                  {article.microcmsId ?? "未公開"}
                </dd>
              </div>
              {article.reviewedAt && (
                <div>
                  <dt className="font-medium text-neutral-500">レビュー日時</dt>
                  <dd className="mt-0.5 text-neutral-900">
                    {new Date(article.reviewedAt).toLocaleString("ja-JP")}
                  </dd>
                </div>
              )}
              {article.reviewedBy && (
                <div>
                  <dt className="font-medium text-neutral-500">レビュー担当</dt>
                  <dd className="mt-0.5 text-neutral-900">
                    {article.reviewedBy}
                  </dd>
                </div>
              )}
            </dl>

            {/* Preview link */}
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <Link
                href={`/admin/articles/${article.id}/preview`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                プレビューを表示
              </Link>
            </div>
          </div>

          {/* Compliance breakdown */}
          <ComplianceBreakdown
            breakdown={article.complianceBreakdown}
            overall={article.complianceScore}
          />

          {/* Review comment history */}
          <ReviewCommentHistory comments={article.reviewHistory} />
        </div>

        {/* Right column: Review actions */}
        <div className="space-y-6">
          <ReviewActions
            articleId={article.id}
            currentStatus={article.status}
          />

          {/* Quick info card */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-neutral-800">
              クイック情報
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">記事ID</dt>
                <dd className="font-mono text-xs text-neutral-700">{article.articleId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">コンテンツID</dt>
                <dd className="font-mono text-xs text-neutral-700">{article.contentId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">薬機法</dt>
                <dd className="font-mono text-xs">
                  <ComplianceScoreBadge score={article.complianceBreakdown.yakkinhou} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">景表法</dt>
                <dd className="font-mono text-xs">
                  <ComplianceScoreBadge score={article.complianceBreakdown.keihinhou} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">ステマ</dt>
                <dd className="font-mono text-xs">
                  <ComplianceScoreBadge score={article.complianceBreakdown.sutema} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">E-E-A-T</dt>
                <dd className="font-mono text-xs">
                  <ComplianceScoreBadge score={article.complianceBreakdown.eeat} />
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
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
