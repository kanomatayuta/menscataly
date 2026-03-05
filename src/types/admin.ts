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
  clicks: number;
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
