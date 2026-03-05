/**
 * GA4 Data API クライアント
 * 環境変数未設定時は null を返し、モックにフォールバック
 */

import type { GA4AnalyticsRow, SlugToIdMap } from './types'

// ============================================================
// ヘルパー
// ============================================================

/**
 * /articles/slug-name → slug-name を抽出
 */
export function extractSlugFromPath(pagePath: string): string | null {
  const match = pagePath.match(/^\/articles\/([^/?#]+)/)
  return match ? match[1] : null
}

/**
 * Supabase articles テーブルから slug → id マップを構築
 */
export async function buildSlugMap(
  supabase: { from: (table: string) => { select: (columns: string) => Promise<{ data: Array<{ id: string; slug: string }> | null }> } }
): Promise<SlugToIdMap> {
  const { data } = await supabase
    .from('articles')
    .select('id, slug')

  const map: SlugToIdMap = {}
  for (const row of data ?? []) {
    map[row.slug] = row.id
  }
  return map
}

// ============================================================
// リトライヘルパー
// ============================================================

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('429') ||
      msg.includes('rate limit') ||
      msg.includes('timeout') ||
      msg.includes('econnreset')
    )
  }
  return false
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      if (!isRetryableError(err)) throw err
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

// ============================================================
// GA4 クライアント生成
// ============================================================

/**
 * GA4 Data API クライアントを生成
 * 環境変数が未設定の場合は null を返す
 */
export async function createGA4Client(): Promise<{
  runReport: (request: Record<string, unknown>) => Promise<[{ rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> }]>
} | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  const projectId = process.env.GOOGLE_PROJECT_ID

  if (!email || !privateKey || !projectId) {
    return null
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = await (Function('return import("@google-analytics/data")')() as Promise<{
      BetaAnalyticsDataClient: new (opts: Record<string, unknown>) => unknown
    }>)
    return new mod.BetaAnalyticsDataClient({
      credentials: {
        client_email: email,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      projectId,
    }) as {
      runReport: (request: Record<string, unknown>) => Promise<[{ rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> }]>
    }
  } catch {
    console.warn('[ga4-client] @google-analytics/data not available')
    return null
  }
}

// ============================================================
// データ取得
// ============================================================

/**
 * GA4 Data API から日次メトリクスを取得
 * @param date 'yesterday' | 'YYYY-MM-DD'
 */
export async function fetchGA4DailyMetrics(
  date: string = 'yesterday'
): Promise<GA4AnalyticsRow[]> {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) {
    console.log('[ga4-client] GA4_PROPERTY_ID not set')
    return []
  }

  const client = await createGA4Client()
  if (!client) {
    console.log('[ga4-client] GA4 client not available (env vars missing or SDK not installed)')
    return []
  }

  return withRetry(async () => {
    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dimensions: [
        { name: 'pagePath' },
        { name: 'date' },
      ],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'totalUsers' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
        { name: 'sessions' },
      ],
      dateRanges: [
        { startDate: date, endDate: date },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: {
            matchType: 'BEGINS_WITH',
            value: '/articles/',
          },
        },
      },
      orderBys: [
        { metric: { metricName: 'screenPageViews' }, desc: true },
      ],
      limit: 500,
    })

    if (!response.rows) {
      return []
    }

    return response.rows.map((row) => {
      const dims = row.dimensionValues
      const mets = row.metricValues
      return {
        pagePath: dims[0]?.value ?? '',
        date: formatGA4Date(dims[1]?.value ?? ''),
        pageviews: parseInt(mets[0]?.value ?? '0', 10),
        uniqueUsers: parseInt(mets[1]?.value ?? '0', 10),
        avgTime: parseFloat(mets[2]?.value ?? '0'),
        bounceRate: parseFloat(mets[3]?.value ?? '0'),
        sessions: parseInt(mets[4]?.value ?? '0', 10),
      }
    })
  })
}

/**
 * GA4 日付形式 (YYYYMMDD) → YYYY-MM-DD
 */
function formatGA4Date(raw: string): string {
  if (raw.length === 8) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  }
  return raw
}
