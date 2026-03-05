/**
 * GA4 Data API クライアント (REST API版)
 * gRPC SDK を使わず、fetch + JWT で直接 REST API を叩く
 * Turbopack / Edge Runtime 互換
 */

import * as crypto from 'crypto'
import { connection } from 'next/server'
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
// JWT 生成 (Google OAuth2 サービスアカウント)
// ============================================================

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function generateJWT(email: string, privateKey: string, scope: string): Promise<string> {
  try { await connection() } catch { /* non-server-component context */ }
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(payload))
  const signInput = `${encodedHeader}.${encodedPayload}`

  const key = privateKey.replace(/\\n/g, '\n')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signInput)
  const signature = sign.sign(key)

  return `${signInput}.${base64url(signature)}`
}

// トークンキャッシュ
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const jwt = await generateJWT(
    email,
    privateKey,
    'https://www.googleapis.com/auth/analytics.readonly'
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OAuth2 token error: ${res.status} ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return data.access_token
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
// GA4 REST API レスポンス型
// ============================================================

interface GA4RunReportResponse {
  dimensionHeaders?: Array<{ name: string }>
  metricHeaders?: Array<{ name: string; type: string }>
  rows?: Array<{
    dimensionValues: Array<{ value: string }>
    metricValues: Array<{ value: string }>
  }>
  rowCount?: number
}

// ============================================================
// GA4 クライアント (REST API)
// ============================================================

/**
 * GA4 Data API (REST) でレポートを実行
 */
async function runGA4Report(
  propertyId: string,
  request: Record<string, unknown>
): Promise<GA4RunReportResponse> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!
  const privateKey = process.env.GOOGLE_PRIVATE_KEY!
  const token = await getAccessToken(email, privateKey)

  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GA4 API error: ${res.status} ${text}`)
  }

  return res.json() as Promise<GA4RunReportResponse>
}

// ============================================================
// createGA4Client (後方互換 — 他モジュールから使用)
// ============================================================

export async function createGA4Client(): Promise<{
  runReport: (request: Record<string, unknown>) => Promise<[GA4RunReportResponse]>
} | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  const propertyId = process.env.GA4_PROPERTY_ID

  if (!email || !privateKey || !propertyId) {
    return null
  }

  return {
    runReport: async (request: Record<string, unknown>) => {
      const response = await runGA4Report(propertyId, request)
      return [response]
    },
  }
}

// ============================================================
// データ取得
// ============================================================

/**
 * GA4 Data API から日次メトリクスを取得
 * @param startDate 開始日 ('yesterday' | '30daysAgo' | '90daysAgo' | 'YYYY-MM-DD')
 * @param endDate 終了日 (デフォルト: startDateと同じ、またはレンジ指定時は 'yesterday')
 */
export async function fetchGA4DailyMetrics(
  startDate: string = 'yesterday',
  endDate?: string
): Promise<GA4AnalyticsRow[]> {
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!propertyId) {
    console.log('[ga4-client] GA4_PROPERTY_ID not set')
    return []
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  if (!email || !privateKey) {
    console.log('[ga4-client] Service account credentials not set')
    return []
  }

  const resolvedEndDate = endDate ?? (startDate.includes('daysAgo') ? 'yesterday' : startDate)

  try {
  return await withRetry(async () => {
    const response = await runGA4Report(propertyId, {
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
        { startDate, endDate: resolvedEndDate },
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
  } catch (err) {
    console.warn('[ga4-client] fetchGA4DailyMetrics failed:', err instanceof Error ? err.message : err)
    return []
  }
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
