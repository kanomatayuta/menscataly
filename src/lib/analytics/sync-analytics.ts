/**
 * GA4/GSC → Supabase analytics_daily 同期ロジック
 */

import type { GA4AnalyticsRow, GSCRow, AnalyticsSyncResult, SlugToIdMap } from './types'
import { extractSlugFromPath, buildSlugMap, fetchGA4DailyMetrics } from './ga4-client'
import { fetchGSCData, extractSlugFromGSCPage } from './gsc-client'

// ============================================================
// Supabase クライアント型 (最小)
// ============================================================

interface SupabaseUpsertClient {
  from: (table: string) => {
    select: (columns: string) => Promise<{ data: Array<{ id: string; slug: string }> | null }>
    upsert: (
      data: Record<string, unknown> | Record<string, unknown>[],
      options: { onConflict: string }
    ) => Promise<{ error: { message: string } | null }>
    update: (data: Record<string, unknown>) => {
      eq: (col1: string, val1: string) => {
        eq: (col2: string, val2: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }
}

// ============================================================
// GA4 → Supabase 同期
// ============================================================

/**
 * GA4 データを Supabase analytics_daily に同期
 * バッチ upsert を使用して N+1 クエリを回避
 */
export async function syncGA4ToSupabase(
  ga4Data: GA4AnalyticsRow[],
  slugMap: SlugToIdMap,
  supabase: SupabaseUpsertClient
): Promise<AnalyticsSyncResult> {
  let skipped = 0
  const errors: string[] = []

  // 1. 有効な行をフィルタリングし、upsert 用のペイロードを構築
  const upsertRows: Record<string, unknown>[] = []

  for (const row of ga4Data) {
    const slug = extractSlugFromPath(row.pagePath)
    if (!slug) {
      skipped++
      continue
    }

    const articleId = slugMap[slug]
    if (!articleId) {
      skipped++
      continue
    }

    upsertRows.push({
      article_id: articleId,
      date: row.date,
      pageviews: row.pageviews,
      unique_users: row.uniqueUsers,
      avg_time: row.avgTime,
      bounce_rate: row.bounceRate,
      ctr: 0,
      conversions: 0,
    })
  }

  // 2. 有効な行がなければ早期リターン
  if (upsertRows.length === 0) {
    return { synced: 0, skipped, errors }
  }

  // 3. バッチ upsert (1回の DB 呼び出しで全行を処理)
  const { error } = await supabase
    .from('analytics_daily')
    .upsert(upsertRows, { onConflict: 'article_id,date' })

  if (error) {
    errors.push(`batch upsert failed: ${error.message}`)
    return { synced: 0, skipped: skipped + upsertRows.length, errors }
  }

  return { synced: upsertRows.length, skipped, errors }
}

// ============================================================
// GSC データマージ
// ============================================================

/**
 * GSC データを既存の analytics_daily レコードに CTR マージ
 * バッチ upsert を使用して N+1 クエリを回避
 * (upsert with onConflict で既存行の ctr カラムのみ更新)
 */
export async function mergeGSCData(
  gscData: GSCRow[],
  slugMap: SlugToIdMap,
  supabase: SupabaseUpsertClient,
  date: string
): Promise<void> {
  // 1. 有効な行をフィルタリングし、upsert 用のペイロードを構築
  const upsertRows: Record<string, unknown>[] = []

  for (const row of gscData) {
    const slug = extractSlugFromGSCPage(row.page)
    if (!slug) continue

    const articleId = slugMap[slug]
    if (!articleId) continue

    upsertRows.push({
      article_id: articleId,
      date,
      ctr: row.ctr,
    })
  }

  // 2. 有効な行がなければ何もしない
  if (upsertRows.length === 0) return

  // 3. バッチ upsert (onConflict で既存行の ctr を更新)
  const { error } = await supabase
    .from('analytics_daily')
    .upsert(upsertRows, { onConflict: 'article_id,date' })

  if (error) {
    console.error(`[sync-analytics] GSC batch upsert failed: ${error.message}`)
  }
}

// ============================================================
// メイン同期関数
// ============================================================

/**
 * GA4 + GSC → Supabase analytics_daily 日次同期
 * パイプラインの fetch-analytics ステップから呼び出される
 */
export async function syncDailyAnalytics(
  supabase: SupabaseUpsertClient,
  date: string = 'yesterday'
): Promise<AnalyticsSyncResult> {
  // 1. slug → article_id マップ構築
  const slugMap = await buildSlugMap(supabase as Parameters<typeof buildSlugMap>[0])

  // 2. GA4 データ取得
  const ga4Data = await fetchGA4DailyMetrics(date)
  if (ga4Data.length === 0) {
    return { synced: 0, skipped: 0, errors: ['No GA4 data returned'] }
  }

  // 3. Supabase に同期
  const result = await syncGA4ToSupabase(ga4Data, slugMap, supabase)

  // 4. GSC データ取得・マージ (失敗してもGA4同期は有効)
  try {
    const resolvedDate =
      date === 'yesterday'
        ? new Date(Date.now() - 86400000).toISOString().split('T')[0]
        : date

    const gscData = await fetchGSCData(resolvedDate)
    if (gscData.length > 0) {
      await mergeGSCData(gscData, slugMap, supabase, resolvedDate)
      console.log(`[sync-analytics] Merged ${gscData.length} GSC rows`)
    }
  } catch (err) {
    console.warn('[sync-analytics] GSC merge failed:', err)
    result.errors.push(`GSC merge failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  console.log(
    `[sync-analytics] Done: synced=${result.synced}, skipped=${result.skipped}, errors=${result.errors.length}`
  )

  return result
}
