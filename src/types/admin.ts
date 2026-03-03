/**
 * 管理画面 型定義
 * ダッシュボード、記事レビュー、収益サマリ、アラート管理
 */

import type { ContentCategory } from './content'
import type { PipelineStatus } from '@/lib/pipeline/types'

// ============================================================
// 記事レビュー
// ============================================================

export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export interface ArticleReviewItem {
  id: string
  articleId: string
  microcmsId: string | null
  title: string
  slug: string
  category: ContentCategory
  complianceScore: number
  status: ReviewStatus
  authorName: string
  generatedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  reviewNotes: string | null
}

// ============================================================
// バッチ生成ジョブ
// ============================================================

export type BatchJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface BatchGenerationJob {
  id: string
  status: BatchJobStatus
  totalKeywords: number
  completedCount: number
  failedCount: number
  startedAt: string
  completedAt: string | null
  totalCostUsd: number
  createdBy: string
  errorMessages: string[]
}

// ============================================================
// 収益サマリ
// ============================================================

export interface RevenueSummary {
  aspName: string
  programCount: number
  totalClicks: number
  totalConversions: number
  totalRevenue: number
  conversionRate: number
  period: {
    startDate: string
    endDate: string
  }
}

// ============================================================
// モニタリングアラート
// ============================================================

export type AlertSeverity = 'critical' | 'warning' | 'info'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved'
export type AlertType =
  | 'pipeline_failure'
  | 'compliance_violation'
  | 'cost_threshold'
  | 'performance_degradation'
  | 'api_error'

export interface MonitoringAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  status: AlertStatus
  title: string
  message: string
  metadata: Record<string, unknown>
  createdAt: string
  acknowledgedAt: string | null
  resolvedAt: string | null
}

// ============================================================
// ダッシュボードデータ
// ============================================================

export interface AdminDashboardData {
  /** パイプライン状態 */
  pipelineStatus: {
    currentStatus: PipelineStatus
    lastRunAt: string | null
    lastRunDurationMs: number | null
    successRate7d: number
  }
  /** 記事統計 */
  articleStats: {
    totalArticles: number
    publishedCount: number
    draftCount: number
    pendingReviewCount: number
    avgComplianceScore: number
  }
  /** 収益概要 */
  revenueSummary: {
    totalRevenue30d: number
    totalClicks30d: number
    totalConversions30d: number
    topAsp: string | null
  }
  /** アクティブアラート */
  activeAlerts: MonitoringAlert[]
  /** 直近のコスト */
  costSummary: {
    totalCost30d: number
    articleGenerationCost: number
    imageGenerationCost: number
    avgCostPerArticle: number
  }
}
