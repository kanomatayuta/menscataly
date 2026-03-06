/**
 * 管理画面 型定義
 * ダッシュボード、記事レビュー、モニタリング用
 */

import type { ContentCategory } from "@/types/content";

// ============================================================
// 記事レビュー
// ============================================================

/** レビューステータス */
export type ReviewStatus = "draft" | "pending" | "approved" | "rejected" | "revision" | "published";

/** レビューキューステータス (DB上は pending/approved/rejected のみ、UIで revision を追加) */
export type ReviewQueueStatus = "pending" | "approved" | "rejected" | "revision";

/** レビューキューアイテム (一覧API用) */
export interface ReviewQueueItem {
  id: string;
  articleId: string | null;
  slug: string;
  title: string;
  status: ReviewQueueStatus;
  complianceScore: number;
  eeatScore: number;
  violationCount: number;
  category: string;
  authorName: string;
  createdAt: string;
  generatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
}

/** レビューキュー統計 */
export interface ReviewQueueStats {
  pending: number;
  approved: number;
  rejected: number;
  revision: number;
  total: number;
  processedLast7Days: number;
}

/** コンプライアンススコア内訳 */
export interface ComplianceScoreBreakdown {
  /** 薬機法スコア (0-100) */
  yakkinhou: number;
  /** 景表法スコア (0-100) */
  keihinhou: number;
  /** ステマ規制スコア (0-100) */
  sutema: number;
  /** E-E-A-Tスコア (0-100) */
  eeat: number;
}

/** レビューコメント履歴 */
export interface ReviewComment {
  id: string;
  author: string;
  content: string;
  action: "approve" | "reject" | "revision" | "comment";
  createdAt: string;
}

/** 記事レビューアイテム (一覧表示用) */
export interface ArticleReviewItem {
  id: string;
  contentId: string;
  title: string;
  slug: string;
  category: ContentCategory;
  status: ReviewStatus;
  complianceScore: number;
  eeatScore?: number;
  generatedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewComment?: string | null;
  generationCostUsd?: number;
  thumbnailUrl?: string;
}

/** 記事レビュー詳細 (個別ページ用) */
export interface ArticleReviewDetail extends ArticleReviewItem {
  articleId: string;
  microcmsId: string | null;
  authorName: string;
  reviewNotes: string | null;
  complianceBreakdown: ComplianceScoreBreakdown;
  reviewHistory: ReviewComment[];
  content?: string;
  htmlContent?: string;
  seoTitle?: string;
  seoDescription?: string;
  jsonLd?: Record<string, unknown>;
}

// ============================================================
// 記事別アナリティクス
// ============================================================

/** 記事ごとの収益・PVデータ (一覧表示用) */
export interface ArticleAnalytics {
  articleId: string;
  pageviews: number;
  searchClicks: number;      // GSC検索クリック (旧 clicks)
  affiliateClicks: number;   // GA4 affiliate_link_click (新規)
  conversions: number;
  revenue: number;
}

// ============================================================
// バッチ生成ジョブ
// ============================================================

export type BatchJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface BatchGenerationJob {
  id: string;
  status: BatchJobStatus;
  totalKeywords: number;
  completedCount: number;
  failedCount: number;
  startedAt: string;
  completedAt?: string;
  totalCostUsd: number;
  results: BatchGenerationResult[];
}

export interface BatchGenerationResult {
  keyword: string;
  category: ContentCategory;
  success: boolean;
  contentId?: string;
  complianceScore?: number;
  error?: string;
  processingTimeMs?: number;
  costUsd?: number;
}

// ============================================================
// トレンド・ランキング
// ============================================================

/** トレンドチャート用データポイント */
export interface TrendDataPoint {
  date: string;
  pageviews: number;
  searchClicks: number;      // 旧 clicks
  affiliateClicks: number;   // 新規
  conversions: number;
}

/** カテゴリ別トレンドデータポイント (積み上げ棒グラフ用) */
export interface CategoryTrendDataPoint {
  date: string;
  [categorySlug: string]: string | number;
}

/** カテゴリ情報 (microCMSから動的取得) */
export interface CategoryInfo {
  slug: string;
  name: string;
}

/** ランキングタブ種別 */
export type RankingTab = "pageviews" | "affiliateCtr" | "revenue";

/** ランキングアイテム */
export interface RankingItem {
  rank: number;
  articleId: string;
  title: string;
  slug: string;
  value: number;
  formattedValue: string;
  previousRank?: number;
}

/** ランキングデータ（全タブ分） */
export type RankingData = Record<RankingTab, RankingItem[]>;

/** サマリーカードデータ */
export interface ArticlesSummary {
  totalPageviews: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
}

// ============================================================
// 記事別アフィリエイトリンクパフォーマンス (詳細ページ用)
// ============================================================

/** アフィリエイトリンク別パフォーマンス */
export interface AffiliateLinkPerformance {
  aspName: string;
  programName: string;
  clickCount: number;
  conversionCount: number;
  revenue: number;
}

// ============================================================
// 記事PV伸び率 (テーブル列用)
// ============================================================

/** 記事PV週次伸び率 */
export interface ArticleGrowthRate {
  articleId: string;
  currentWeekPv: number;
  previousWeekPv: number;
  /** (currentWeekPv - previousWeekPv) / previousWeekPv, null = データ不足 */
  growthRate: number | null;
}

// ============================================================
// 収益サマリ
// ============================================================

export interface RevenueSummary {
  aspName: string;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  monthlyConversions: number;
  monthlyRevenueJpy: number;
  monthOverMonthChange: number;
  topArticles: { slug: string; title: string; conversions: number }[];
}

// ============================================================
// モニタリング & アラート
// ============================================================

export type AlertLevel = "info" | "warning" | "critical";
/** Alias for AlertLevel used by alert-manager and notification subsystems */
export type AlertSeverity = AlertLevel;
export type AlertType = "pipeline_failure" | "compliance_violation" | "cost_threshold" | "performance_degradation" | "api_error";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface MonitoringAlert {
  id: string;
  type?: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  title: string;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

// ============================================================
// ダッシュボード統合データ
// ============================================================

export interface AdminDashboardData {
  articles: {
    total: number;
    published: number;
    draft: number;
    pendingReview: number;
    avgComplianceScore: number;
  };
  pipeline: {
    status: "idle" | "running" | "error";
    lastRunAt?: string;
    lastRunSuccess?: boolean;
    totalRuns: number;
  };
  revenue: {
    monthlyTotalJpy: number;
    monthOverMonthChange: number;
    byAsp: RevenueSummary[];
  };
  costs: {
    monthlyTotalUsd: number;
    articleAvgUsd: number;
    budgetRemainingUsd: number;
  };
  alerts: MonitoringAlert[];
}
