/**
 * Supabase 型安全クエリラッパー
 * `as any` をこのファイルに集約し、呼び出し側は型安全に利用する
 */

import type { SupabaseServerClient } from './client'
import type {
  AnalyticsDailyRow,
  AnalyticsDailyInsert,
  AffiliateLinkRow,
} from '@/types/database'

// ============================================================
// analytics_daily
// ============================================================

/**
 * analytics_daily を upsert (article_id + date で冪等)
 */
export async function upsertAnalyticsDaily(
  supabase: SupabaseServerClient,
  data: AnalyticsDailyInsert
): Promise<AnalyticsDailyRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any)
    .from('analytics_daily')
    .upsert(data, { onConflict: 'article_id,date' })
    .select()
    .single() as { data: AnalyticsDailyRow | null; error: { message: string; code: string } | null }

  if (error) throw error
  return result
}

/**
 * analytics_daily を取得 (フィルタ付き)
 */
export async function getAnalyticsDaily(
  supabase: SupabaseServerClient,
  options: { articleId?: string; since?: string; until?: string }
): Promise<AnalyticsDailyRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('analytics_daily')
    .select('*')
    .order('date', { ascending: false })

  if (options.articleId) query = query.eq('article_id', options.articleId)
  if (options.since) query = query.gte('date', options.since)
  if (options.until) query = query.lte('date', options.until)

  const { data, error } = await query as {
    data: AnalyticsDailyRow[] | null
    error: { message: string; code: string } | null
  }

  if (error) throw error
  return data ?? []
}

/**
 * 記事IDに紐づくアフィリエイトリンクを取得
 */
export async function getAffiliateLinksByArticle(
  supabase: SupabaseServerClient,
  articleId: string
): Promise<AffiliateLinkRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('affiliate_links')
    .select('*')
    .eq('article_id', articleId)
    .order('click_count', { ascending: false }) as {
    data: AffiliateLinkRow[] | null
    error: { message: string; code: string } | null
  }

  if (error) throw error
  return data ?? []
}
