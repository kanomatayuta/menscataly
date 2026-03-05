/**
 * アナリティクスデータ取得ステップ
 * GA4 Data API / Google Search Console からパフォーマンスデータを取得する
 * GA4環境変数未設定時はモックデータにフォールバック
 */

import type { AnalyticsData, PipelineContext, PipelineStep } from '../types'
import { fetchGA4DailyMetrics, extractSlugFromPath } from '../../analytics/ga4-client'
import { fetchGSCData, extractSlugFromGSCPage } from '../../analytics/gsc-client'
import type { GSCRow } from '../../analytics/types'

// ============================================================
// GA4 Data API インターフェース (互換性維持)
// ============================================================

export interface GA4Config {
  propertyId: string
  credentialsPath: string
}

export interface GA4MetricRow {
  dimensionValues: Array<{ value: string }>
  metricValues: Array<{ value: string }>
}

export interface GA4Report {
  rows: GA4MetricRow[]
  rowCount: number
}

export interface GA4Client {
  runReport(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<GA4Report>
}

// ============================================================
// Search Console (GSC) インターフェース (互換性維持)
// ============================================================

export interface GSCResponse {
  rows: Array<{
    keys: string[]
    clicks: number
    impressions: number
    ctr: number
    position: number
  }>
}

export interface GSCClient {
  query(
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<GSCResponse>
}

// ============================================================
// モック実装
// ============================================================

function getDateRange(days: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function generateMockAnalyticsData(): AnalyticsData[] {
  const mockArticleIds = [
    'art-aga-001',
    'art-aga-002',
    'art-hair-001',
    'art-skin-001',
    'art-ed-001',
  ]

  const dates = getDateRange(7)
  const data: AnalyticsData[] = []

  for (const articleId of mockArticleIds) {
    for (const date of dates) {
      data.push({
        articleId,
        pageviews: Math.floor(Math.random() * 500) + 50,
        uniqueUsers: Math.floor(Math.random() * 400) + 40,
        avgTime: Math.floor(Math.random() * 300) + 60,
        bounceRate: Math.random() * 0.4 + 0.3,
        ctr: Math.random() * 0.05 + 0.01,
        date,
      })
    }
  }

  return data
}

// ============================================================
// CTR 検索ヘルパー
// ============================================================

function findCTR(gscData: GSCRow[], pagePath: string): number {
  const slug = extractSlugFromPath(pagePath)
  if (!slug) return 0

  for (const row of gscData) {
    const gscSlug = extractSlugFromGSCPage(row.page)
    if (gscSlug === slug) {
      return row.ctr
    }
  }
  return 0
}

// ============================================================
// ステップ実装
// ============================================================

export const fetchAnalyticsStep: PipelineStep<unknown, AnalyticsData[]> = {
  name: 'fetch-analytics',
  description: 'GA4 / Search Console からアナリティクスデータを取得する',
  maxRetries: 3,

  async execute(_input: unknown, context: PipelineContext): Promise<AnalyticsData[]> {
    console.log(`[fetch-analytics] Starting analytics fetch (run: ${context.runId})`)

    const hasGA4Config =
      process.env.GA4_PROPERTY_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY

    let analyticsData: AnalyticsData[]

    if (hasGA4Config) {
      try {
        // 1. GA4 Data API から前日分データ取得
        const ga4Data = await fetchGA4DailyMetrics('yesterday')

        // 2. GSC からCTRデータ取得 (失敗してもGA4データは使う)
        let gscData: GSCRow[] = []
        try {
          const yesterday = new Date(Date.now() - 86400000)
            .toISOString()
            .split('T')[0]
          gscData = await fetchGSCData(yesterday)
        } catch (err) {
          console.warn('[fetch-analytics] GSC fetch failed:', err)
        }

        console.log(
          `[fetch-analytics] GA4: ${ga4Data.length} rows, GSC: ${gscData.length} rows`
        )

        // 3. PipelineContext 用に AnalyticsData[] 形式で返す
        analyticsData = ga4Data.map((row) => ({
          articleId: extractSlugFromPath(row.pagePath) ?? row.pagePath,
          pageviews: row.pageviews,
          uniqueUsers: row.uniqueUsers,
          avgTime: row.avgTime,
          bounceRate: row.bounceRate,
          ctr: findCTR(gscData, row.pagePath),
          date: row.date,
        }))
      } catch (err) {
        console.warn('[fetch-analytics] GA4 API error, falling back to mock:', err)
        analyticsData = generateMockAnalyticsData()
      }
    } else {
      console.log('[fetch-analytics] Using mock data (GA4 env vars not set)')
      analyticsData = generateMockAnalyticsData()
    }

    console.log(`[fetch-analytics] Fetched ${analyticsData.length} analytics records`)

    context.sharedData['analytics'] = analyticsData

    return analyticsData
  },
}
