/**
 * アナリティクスデータ取得ステップ
 * GA4 Data API / Google Search Console からパフォーマンスデータを取得する
 * モック実装 + インターフェース定義
 */

import type { AnalyticsData, PipelineContext, PipelineStep } from '../types'

// ============================================================
// GA4 Data API インターフェース
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
  /**
   * ページ別セッション・ページビューを取得する
   * @param propertyId GA4プロパティID
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   */
  runReport(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<GA4Report>
}

// ============================================================
// Search Console (GSC) インターフェース
// ============================================================

export interface GSCRow {
  keys: string[]    // [page, query]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GSCResponse {
  rows: GSCRow[]
}

export interface GSCClient {
  /**
   * Search Console のパフォーマンスデータを取得する
   * @param siteUrl サイトURL (e.g. 'https://menscataly.com')
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   */
  query(
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<GSCResponse>
}

// ============================================================
// モック実装
// ============================================================

/**
 * 過去N日の日付リストを生成する
 */
function getDateRange(days: number): string[] {
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

/**
 * モックのアナリティクスデータを生成する
 * 将来的には GA4 Data API / GSC API に置き換える
 */
function generateMockAnalyticsData(): AnalyticsData[] {
  const mockArticleIds = [
    'art-aga-001',
    'art-aga-002',
    'art-hair-001',
    'art-skin-001',
    'art-ed-001',
  ]

  const dates = getDateRange(7) // 直近7日
  const data: AnalyticsData[] = []

  for (const articleId of mockArticleIds) {
    for (const date of dates) {
      data.push({
        articleId,
        pageviews: Math.floor(Math.random() * 500) + 50,
        uniqueUsers: Math.floor(Math.random() * 400) + 40,
        avgTime: Math.floor(Math.random() * 300) + 60,   // 60〜360秒
        bounceRate: Math.random() * 0.4 + 0.3,           // 30〜70%
        ctr: Math.random() * 0.05 + 0.01,                // 1〜6%
        date,
      })
    }
  }

  return data
}

// ============================================================
// GA4 API 呼び出し実装 (将来実装)
// ============================================================

/**
 * GA4 Data API からデータを取得する
 * @internal 将来実装 - Google Analytics Data API v1beta
 */
async function fetchFromGA4(): Promise<AnalyticsData[]> {
  const propertyId = process.env.GA4_PROPERTY_ID
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (!propertyId || !credentialsPath) {
    throw new Error('GA4_PROPERTY_ID or GOOGLE_APPLICATION_CREDENTIALS not set')
  }

  // 将来実装: @google-analytics/data を使用
  // const { BetaAnalyticsDataClient } = await import('@google-analytics/data')
  // const client = new BetaAnalyticsDataClient()
  //
  // const [response] = await client.runReport({
  //   property: `properties/${propertyId}`,
  //   dimensions: [{ name: 'pagePath' }],
  //   metrics: [
  //     { name: 'sessions' },
  //     { name: 'screenPageViews' },
  //     { name: 'averageSessionDuration' },
  //     { name: 'bounceRate' },
  //   ],
  //   dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
  // })

  throw new Error('GA4 API integration not yet implemented')
}

/**
 * Google Search Console からデータを取得する
 * @internal 将来実装 - Search Console API v1
 */
async function fetchFromSearchConsole(): Promise<AnalyticsData[]> {
  const siteUrl = process.env.GSC_SITE_URL
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL

  if (!siteUrl || !serviceAccountEmail) {
    throw new Error('GSC_SITE_URL or GOOGLE_SERVICE_ACCOUNT_EMAIL not set')
  }

  // 将来実装: googleapis を使用
  // const { google } = await import('googleapis')
  // const auth = new google.auth.GoogleAuth({ ... })
  // const searchconsole = google.searchconsole({ version: 'v1', auth })

  throw new Error('GSC API integration not yet implemented')
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * アナリティクスデータ取得ステップ
 */
export const fetchAnalyticsStep: PipelineStep<unknown, AnalyticsData[]> = {
  name: 'fetch-analytics',
  description: 'GA4 / Search Console からアナリティクスデータを取得する',
  maxRetries: 3,

  async execute(_input: unknown, context: PipelineContext): Promise<AnalyticsData[]> {
    console.log(`[fetch-analytics] Starting analytics fetch (run: ${context.runId})`)

    const hasGA4Config =
      process.env.GA4_PROPERTY_ID !== undefined &&
      process.env.GOOGLE_APPLICATION_CREDENTIALS !== undefined

    let analyticsData: AnalyticsData[]

    if (hasGA4Config) {
      try {
        const [ga4Data, gscData] = await Promise.allSettled([
          fetchFromGA4(),
          fetchFromSearchConsole(),
        ])

        const data: AnalyticsData[] = []

        if (ga4Data.status === 'fulfilled') {
          data.push(...ga4Data.value)
        } else {
          console.warn('[fetch-analytics] GA4 fetch failed:', ga4Data.reason)
        }

        if (gscData.status === 'fulfilled') {
          // GSCデータをマージ（CTRのみ）
          console.log('[fetch-analytics] GSC data merged')
        } else {
          console.warn('[fetch-analytics] GSC fetch failed:', gscData.reason)
        }

        analyticsData = data
      } catch (err) {
        console.warn('[fetch-analytics] Analytics API error, falling back to mock:', err)
        analyticsData = generateMockAnalyticsData()
      }
    } else {
      console.log('[fetch-analytics] Using mock data (GA4 env vars not set)')
      analyticsData = generateMockAnalyticsData()
    }

    console.log(`[fetch-analytics] Fetched ${analyticsData.length} analytics records`)

    // コンテキストの共有データに保存
    context.sharedData['analytics'] = analyticsData

    return analyticsData
  },
}
