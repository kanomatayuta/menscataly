"use client";

import { useState } from "react";
import { ArticleDetailStats } from "./ArticleDetailStats";
import { HeatmapOverlay } from "./HeatmapOverlay";
import { ComplianceScoreBadge } from "./ComplianceScoreBadge";
import { ComplianceBreakdown } from "./ComplianceBreakdown";
import { ReviewActions } from "./ReviewActions";
import { ReviewCommentHistory } from "./ReviewCommentHistory";
import { StatusBadge } from "./StatusBadge";
import type {
  AffiliateLinkPerformance,
  ReviewStatus,
  ReviewComment,
  ComplianceScoreBreakdown,
} from "@/types/admin";
import type { AspProgram } from "@/types/asp-config";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type TabKey = "analytics" | "preview";

interface ArticleDetailTabsProps {
  // Article info
  article: {
    id: string;
    title: string;
    slug: string;
    category: string;
    complianceScore: number;
    status: ReviewStatus;
    authorName: string;
    generatedAt: string;
    reviewedAt: string | null;
    reviewedBy: string | null;
    microcmsId: string | null;
    complianceBreakdown: ComplianceScoreBreakdown;
    reviewHistory: ReviewComment[];
    articleId?: string;
    contentId?: string;
  };
  // Analytics data
  analytics: {
    pv30d: number;
    affiliateClicks: number;
    conversions: number;
    revenue: number;
    pvTrend: { date: string; pageviews: number }[];
    affiliateLinks: AffiliateLinkPerformance[];
    aspPrograms: AspProgram[];
  };
  // Category label
  categoryLabel: string;
}

// ------------------------------------------------------------------
// Tab header
// ------------------------------------------------------------------

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "analytics",
    label: "詳細分析",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "preview",
    label: "ヒートマップ",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
      </svg>
    ),
  },
];

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export function ArticleDetailTabs({
  article,
  analytics,
  categoryLabel,
}: ArticleDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("analytics");

  return (
    <div>
      {/* Tab navigation */}
      <div className="mb-6 border-b border-neutral-200">
        <nav className="-mb-px flex gap-1" aria-label="記事詳細タブ">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-neutral-800 text-neutral-900"
                  : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
              }`}
              aria-selected={activeTab === tab.key}
              role="tab"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content — use hidden/block to prevent iframe remount on tab switch */}
      <div className={activeTab === "analytics" ? "block" : "hidden"}>
        <AnalyticsTab
          article={article}
          analytics={analytics}
          categoryLabel={categoryLabel}
        />
      </div>

      <div className={activeTab === "preview" ? "block" : "hidden"}>
        <PreviewTab slug={article.slug} title={article.title} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Analytics Tab
// ------------------------------------------------------------------

function AnalyticsTab({
  article,
  analytics,
  categoryLabel,
}: {
  article: ArticleDetailTabsProps["article"];
  analytics: ArticleDetailTabsProps["analytics"];
  categoryLabel: string;
}) {
  return (
    <>
      {/* PV chart + affiliate links (summary cards are above tabs) */}
      <div className="mb-6">
        <ArticleDetailStats
          pv30d={analytics.pv30d}
          affiliateClicks={analytics.affiliateClicks}
          conversions={analytics.conversions}
          revenue={analytics.revenue}
          pvTrend={analytics.pvTrend}
          affiliateLinks={analytics.affiliateLinks}
          aspPrograms={[]}
          hideSummaryCards
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column (2col) */}
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
                <dd className="mt-0.5 text-neutral-900">{categoryLabel}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">スラッグ</dt>
                <dd className="mt-0.5 font-mono text-xs text-neutral-700">
                  {article.slug}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">著者</dt>
                <dd className="mt-0.5 text-neutral-900">{article.authorName}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">生成日時</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {new Date(article.generatedAt).toLocaleString("ja-JP")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">コンプラスコア</dt>
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
                  <dd className="mt-0.5 text-neutral-900">{article.reviewedBy}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Compliance breakdown */}
          <ComplianceBreakdown
            breakdown={article.complianceBreakdown}
            overall={article.complianceScore}
          />

          {/* Review comment history */}
          <ReviewCommentHistory comments={article.reviewHistory} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <ReviewActions
            articleId={article.id}
            currentStatus={article.status}
          />

          {/* ASP Programs */}
          {analytics.aspPrograms.length > 0 && (
            <ArticleDetailStats
              pv30d={0}
              affiliateClicks={0}
              conversions={0}
              revenue={0}
              pvTrend={[]}
              affiliateLinks={[]}
              aspPrograms={analytics.aspPrograms}
            />
          )}

          {/* Quick info card */}
          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-neutral-800">
              クイック情報
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">記事ID</dt>
                <dd className="font-mono text-xs text-neutral-700">
                  {article.articleId ?? article.id}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">コンテンツID</dt>
                <dd className="font-mono text-xs text-neutral-700">
                  {article.contentId ?? article.id}
                </dd>
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
// Preview Tab (full-width)
// ------------------------------------------------------------------

function PreviewTab({ slug, title }: { slug: string; title: string }) {
  return (
    <div className="w-full">
      <HeatmapOverlay slug={slug} title={title} />
    </div>
  );
}
