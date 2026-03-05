/**
 * BigQuery クライアント
 * GA4 BigQuery Export データを分析用に取得
 * 環境変数未設定時は空配列を返す
 */

import type { BigQueryArticleMetrics, BigQueryAffiliateClick, DateRange } from './types'

// ============================================================
// クライアント生成
// ============================================================

interface BigQueryInstance {
  query: (options: {
    query: string
    params: Record<string, string>
    location: string
    maximumBytesBilled?: string
  }) => Promise<[unknown[]]>
}

/**
 * BigQuery クライアントを生成
 * 環境変数が未設定の場合は null を返す
 */
export async function createBigQueryClient(): Promise<BigQueryInstance | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
  const projectId = process.env.GOOGLE_PROJECT_ID

  if (!email || !privateKey || !projectId) {
    return null
  }

  try {
    const mod = await (Function('return import("@google-cloud/bigquery")')() as Promise<{
      BigQuery: new (opts: Record<string, unknown>) => BigQueryInstance
    }>)
    return new mod.BigQuery({
      projectId,
      credentials: {
        client_email: email,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      location: 'asia-northeast1',
    })
  } catch {
    console.warn('[bigquery-client] @google-cloud/bigquery not available')
    return null
  }
}

// ============================================================
// クエリ関数
// ============================================================

/**
 * 記事別PV推移を取得
 */
export async function queryArticleMetrics(
  range: DateRange
): Promise<BigQueryArticleMetrics[]> {
  const bq = await createBigQueryClient()
  const datasetId = process.env.BQ_DATASET_ID
  const projectId = process.env.GOOGLE_PROJECT_ID

  if (!bq || !datasetId || !projectId) {
    console.log('[bigquery-client] BigQuery not configured, returning empty data')
    return []
  }

  const query = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', PARSE_DATE('%Y%m%d', event_date)) AS date,
      REGEXP_EXTRACT(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
        r'/articles/([^/?#]+)'
      ) AS slug,
      COUNT(*) AS pageviews,
      COUNT(DISTINCT user_pseudo_id) AS unique_users,
      AVG(
        CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') AS FLOAT64)
      ) / 1000 AS avg_engagement_sec
    FROM \`${projectId}.${datasetId}.events_*\`
    WHERE
      _TABLE_SUFFIX BETWEEN @start_suffix AND @end_suffix
      AND event_name = 'page_view'
      AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location')
          LIKE '%/articles/%'
    GROUP BY date, slug
    HAVING slug IS NOT NULL
    ORDER BY date DESC, pageviews DESC
  `

  const [rows] = await bq.query({
    query,
    params: {
      start_suffix: range.startDate.replace(/-/g, ''),
      end_suffix: range.endDate.replace(/-/g, ''),
    },
    location: 'asia-northeast1',
    maximumBytesBilled: '1000000000', // 1GB 上限
  })

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    date: String(row.date ?? ''),
    slug: String(row.slug ?? ''),
    pageviews: Number(row.pageviews ?? 0),
    uniqueUsers: Number(row.unique_users ?? 0),
    avgEngagementSec: Number(row.avg_engagement_sec ?? 0),
  }))
}

/**
 * アフィリエイトクリック分析を取得
 */
export async function queryAffiliateClicks(
  range: DateRange
): Promise<BigQueryAffiliateClick[]> {
  const bq = await createBigQueryClient()
  const datasetId = process.env.BQ_DATASET_ID
  const projectId = process.env.GOOGLE_PROJECT_ID

  if (!bq || !datasetId || !projectId) {
    console.log('[bigquery-client] BigQuery not configured, returning empty data')
    return []
  }

  const query = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', PARSE_DATE('%Y%m%d', event_date)) AS date,
      REGEXP_EXTRACT(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
        r'/articles/([^/?#]+)'
      ) AS slug,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'asp_name') AS asp_name,
      (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'program_name') AS program_name,
      COUNT(*) AS click_count
    FROM \`${projectId}.${datasetId}.events_*\`
    WHERE
      _TABLE_SUFFIX BETWEEN @start_suffix AND @end_suffix
      AND event_name = 'affiliate_link_click'
    GROUP BY date, slug, asp_name, program_name
    ORDER BY click_count DESC
  `

  const [rows] = await bq.query({
    query,
    params: {
      start_suffix: range.startDate.replace(/-/g, ''),
      end_suffix: range.endDate.replace(/-/g, ''),
    },
    location: 'asia-northeast1',
    maximumBytesBilled: '1000000000',
  })

  return (rows as Array<Record<string, unknown>>).map((row) => ({
    date: String(row.date ?? ''),
    slug: String(row.slug ?? ''),
    aspName: String(row.asp_name ?? ''),
    programName: String(row.program_name ?? ''),
    clickCount: Number(row.click_count ?? 0),
  }))
}
