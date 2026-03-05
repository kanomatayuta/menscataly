/**
 * Google Search Console クライアント (REST API版)
 * googleapis SDK を使わず、fetch + JWT で直接 REST API を叩く
 */

import * as crypto from 'crypto'
import { connection } from 'next/server'
import type { GSCRow } from './types'

// ============================================================
// JWT 生成 (GA4クライアントと同様)
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

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const jwt = await generateJWT(
    email,
    privateKey,
    'https://www.googleapis.com/auth/webmasters.readonly'
  )

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GSC OAuth2 token error: ${res.status} ${text}`)
  }

  const data = await res.json() as { access_token: string; expires_in: number }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  }
  return data.access_token
}

// ============================================================
// GSC REST API
// ============================================================

interface GSCApiResponse {
  rows?: Array<{
    keys?: string[]
    clicks?: number
    impressions?: number
    ctr?: number
    position?: number
  }>
}

/**
 * GSC から指定期間のデータを取得 (REST API)
 * @param startDate YYYY-MM-DD
 * @param endDate YYYY-MM-DD (デフォルト: startDateと同じ)
 * @param dimensions ディメンション (デフォルト: ['page'])
 */
export async function fetchGSCData(
  startDate: string,
  endDate?: string,
  dimensions: string[] = ['page']
): Promise<GSCRow[]> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  const siteUrl = process.env.GSC_SITE_URL

  if (!email || !privateKey || !siteUrl) {
    console.log('[gsc-client] GSC env vars not set, returning empty data')
    return []
  }

  try {
    const token = await getAccessToken(email, privateKey)
    const resolvedEndDate = endDate ?? startDate

    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate: resolvedEndDate,
        dimensions,
        rowLimit: 500,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.warn(`[gsc-client] GSC API error: ${res.status} ${text}`)
      return []
    }

    const data = await res.json() as GSCApiResponse

    return (data.rows ?? []).map((row) => ({
      page: row.keys?.[0] ?? '',
      date: row.keys?.[1] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
  } catch (err) {
    console.warn('[gsc-client] fetchGSCData failed:', err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * GSC ページURLからslugを抽出
 * https://menscataly.com/articles/slug-name → slug-name
 */
export function extractSlugFromGSCPage(pageUrl: string): string | null {
  const match = pageUrl.match(/\/articles\/([^/?#]+)/)
  return match ? match[1] : null
}
