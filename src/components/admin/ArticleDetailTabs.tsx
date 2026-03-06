"use client";

import { useState } from "react";
import { ArticleDetailStats } from "./ArticleDetailStats";
import { HeatmapOverlay } from "./HeatmapOverlay";
import { ComplianceBreakdown } from "./ComplianceBreakdown";
import { ReviewActions } from "./ReviewActions";
import { ReviewCommentHistory } from "./ReviewCommentHistory";
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
  analytics: {
    pv30d: number;
    affiliateClicks: number;
    conversions: number;
    revenue: number;
    pvTrend: { date: string; pageviews: number }[];
    affiliateLinks: AffiliateLinkPerformance[];
    aspPrograms: AspProgram[];
  };
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
// Analytics Tab — optimized layout
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
  const hasAnalyticsData = analytics.pv30d > 0 || analytics.pvTrend.length > 0;
  const hasAffiliateLinks = analytics.affiliateLinks.length > 0;
  const hasReviewHistory = article.reviewHistory.length > 0;
  const isPublished = article.status === "published";
  const hasAspPrograms = analytics.aspPrograms.length > 0;

  return (
    <div className="space-y-6">
      {/* Row 1: Article info + Compliance side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Article meta card */}
        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-900 leading-snug">
            {article.title}
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <MetaItem label="カテゴリ" value={categoryLabel} />
            <MetaItem label="スラッグ" value={article.slug} mono />
            <MetaItem label="著者" value={article.authorName} />
            <MetaItem
              label="生成日時"
              value={new Date(article.generatedAt).toLocaleString("ja-JP")}
            />
            <MetaItem label="microCMS ID" value={article.microcmsId ?? "未公開"} mono />
            {article.reviewedAt && (
              <MetaItem
                label="レビュー日時"
                value={new Date(article.reviewedAt).toLocaleString("ja-JP")}
              />
            )}
          </dl>
        </div>

        {/* Compliance breakdown */}
        <ComplianceBreakdown
          breakdown={article.complianceBreakdown}
          overall={article.complianceScore}
        />
      </div>

      {/* Row 2: PV chart (only if data exists) */}
      {hasAnalyticsData && (
        <ArticleDetailStats
          pv30d={analytics.pv30d}
          affiliateClicks={analytics.affiliateClicks}
          conversions={analytics.conversions}
          revenue={analytics.revenue}
          pvTrend={analytics.pvTrend}
          affiliateLinks={[]}
          aspPrograms={[]}
          hideSummaryCards
        />
      )}

      {/* Row 3: Affiliate links (only if data exists) */}
      {hasAffiliateLinks && (
        <ArticleDetailStats
          pv30d={0}
          affiliateClicks={0}
          conversions={0}
          revenue={0}
          pvTrend={[]}
          affiliateLinks={analytics.affiliateLinks}
          aspPrograms={[]}
          hideSummaryCards
        />
      )}

      {/* Row 4: ASP programs — full width */}
      {hasAspPrograms && (
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

      {/* Row 4: Review section (only if not published-terminal or has history) */}
      {(!isPublished || hasReviewHistory) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {!isPublished && (
            <ReviewActions
              articleId={article.id}
              currentStatus={article.status}
            />
          )}
          {hasReviewHistory && (
            <ReviewCommentHistory comments={article.reviewHistory} />
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Helper: compact meta item
// ------------------------------------------------------------------

function MetaItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-400">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-neutral-800 ${
          mono ? "font-mono text-xs text-neutral-600" : ""
        }`}
      >
        {value}
      </dd>
    </div>
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
