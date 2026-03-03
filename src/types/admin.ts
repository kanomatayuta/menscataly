/**
 * 管理画面 型定義
 * ダッシュボード、記事レビュー、モニタリング用
 */

import type { ContentCategory } from "@/types/content";

// ============================================================
// 記事レビュー
// ============================================================

/** レビューステータス */
export type ReviewStatus = "pending" | "approved" | "rejected" | "published";

/** 記事レビューアイテム */
export interface ArticleReviewItem {
  contentId: string;
  title: string;
  slug: string;
  category: ContentCategory;
  reviewStatus: ReviewStatus;
  complianceScore: number;
  eeatScore?: number;
  generatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewComment?: string;
  generationCostUsd?: number;
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
  monthlyConversions: number;
  monthlyRevenueJpy: number;
  monthOverMonthChange: number;
  topArticles: { slug: string; title: string; conversions: number }[];
}

// ============================================================
// モニタリング & アラート
// ============================================================

export type AlertLevel = "info" | "warning" | "critical";
export type AlertStatus = "active" | "acknowledged" | "resolved";

export interface MonitoringAlert {
  id: string;
  level: AlertLevel;
  status: AlertStatus;
  title: string;
  message: string;
  source: string;
  createdAt: string;
  resolvedAt?: string;
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
