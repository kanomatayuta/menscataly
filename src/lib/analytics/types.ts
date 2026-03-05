/**
 * GA4 / GSC / BigQuery 共通型定義
 */

// ============================================================
// GA4 Data API
// ============================================================

export interface GA4AnalyticsRow {
  pagePath: string
  date: string
  pageviews: number
  uniqueUsers: number
  avgTime: number
  bounceRate: number
  sessions: number
}

// ============================================================
// Google Search Console
// ============================================================

export interface GSCRow {
  page: string
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

// ============================================================
// BigQuery
// ============================================================

export interface BigQueryArticleMetrics {
  date: string
  slug: string
  pageviews: number
  uniqueUsers: number
  avgEngagementSec: number
}

export interface BigQueryAffiliateClick {
  date: string
  slug: string
  aspName: string
  programName: string
  clickCount: number
}

// ============================================================
// 同期結果
// ============================================================

export interface AnalyticsSyncResult {
  synced: number
  skipped: number
  errors: string[]
}

// ============================================================
// 共通
// ============================================================

export interface DateRange {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

export interface SlugToIdMap {
  [slug: string]: string // slug → article_id (UUID)
}
