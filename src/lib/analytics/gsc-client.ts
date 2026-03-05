/**
 * Google Search Console クライアント
 * 環境変数未設定時は空配列を返す
 */

import type { GSCRow } from './types'

// ============================================================
// データ取得
// ============================================================

/**
 * GSC から日次データを取得
 * @param date YYYY-MM-DD
 */
export async function fetchGSCData(date: string): Promise<GSCRow[]> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  const siteUrl = process.env.GSC_SITE_URL

  if (!email || !privateKey || !siteUrl) {
    console.log('[gsc-client] GSC env vars not set, returning empty data')
    return []
  }

  try {
    // googleapis は optional — 未インストール時はcatchで空配列を返す
    const mod = await (Function('return import("googleapis")')() as Promise<{
      google: {
        auth: {
          JWT: new (opts: Record<string, unknown>) => unknown
        }
        searchconsole: (opts: Record<string, unknown>) => {
          searchanalytics: {
            query: (opts: Record<string, unknown>) => Promise<{
              data: {
                rows?: Array<{
                  keys?: string[]
                  clicks?: number
                  impressions?: number
                  ctr?: number
                  position?: number
                }>
              }
            }>
          }
        }
      }
    }>)

    const auth = new mod.google.auth.JWT({
      email,
      key: privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    })

    const searchconsole = mod.google.searchconsole({ version: 'v1', auth })

    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: date,
        endDate: date,
        dimensions: ['page'],
        rowLimit: 500,
      },
    })

    return (response.data.rows ?? []).map((row) => ({
      page: row.keys?.[0] ?? '',
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    }))
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Cannot find module') || err.message.includes('MODULE_NOT_FOUND'))
    ) {
      console.warn('[gsc-client] googleapis not available')
      return []
    }
    throw err
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
