/**
 * Supabase 同期ステップ
 * 公開済み記事のメタデータを articles テーブルへ upsert する
 * analytics_daily への初期レコードを作成する
 */

import type { PipelineContext, PipelineStep, PublishedArticleData } from '../types'

// ============================================================
// 同期結果型
// ============================================================

export interface SyncResult {
  microcmsId: string
  supabaseId: string
  slug: string
  synced: boolean
  error: string | null
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * Supabase 同期ステップ
 */
export const syncToSupabaseStep: PipelineStep<PublishedArticleData[], SyncResult[]> = {
  name: 'sync-to-supabase',
  description: 'articles テーブルへメタデータを upsert し analytics_daily の初期レコードを作成する',
  maxRetries: 3,

  async execute(
    input: PublishedArticleData[],
    context: PipelineContext
  ): Promise<SyncResult[]> {
    console.log(`[sync-to-supabase] Starting sync (run: ${context.runId})`)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[sync-to-supabase] Supabase env vars not set — skipping sync')
      return input.map(article => ({
        microcmsId: article.microcmsId,
        supabaseId: '',
        slug: article.slug,
        synced: false,
        error: 'Supabase env vars not configured',
      }))
    }

    if (context.config.dryRun) {
      console.log('[sync-to-supabase] Dry run mode — skipping actual sync')
      return input.map(article => ({
        microcmsId: article.microcmsId,
        supabaseId: `dryrun-${article.slug}`,
        slug: article.slug,
        synced: false,
        error: null,
      }))
    }

    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()
    const results: SyncResult[] = []

    for (const article of input) {
      console.log(`[sync-to-supabase] Syncing article: ${article.title}`)

      try {
        // articles テーブルへ upsert
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: articleRow, error: upsertError } = await (supabase as any)
          .from('articles')
          .upsert(
            {
              microcms_id: article.microcmsId,
              slug: article.slug,
              title: article.title,
              status: 'published',
              published_at: article.publishedAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'microcms_id' }
          )
          .select('id')
          .single()

        if (upsertError) {
          throw new Error(`articles upsert failed: ${upsertError.message}`)
        }

        const supabaseId = (articleRow as { id: string }).id

        // analytics_daily への初期レコード作成
        const today = new Date().toISOString().split('T')[0]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: analyticsError } = await (supabase as any)
          .from('analytics_daily')
          .upsert(
            {
              article_id: supabaseId,
              date: today,
              pageviews: 0,
              unique_users: 0,
              avg_time: 0,
              bounce_rate: 0,
              ctr: 0,
              conversions: 0,
            },
            { onConflict: 'article_id,date' }
          )

        if (analyticsError) {
          // analytics_daily の失敗はメインの同期結果を壊さない
          console.warn(
            `[sync-to-supabase] analytics_daily insert failed for ${article.slug}:`,
            analyticsError.message
          )
        }

        const result: SyncResult = {
          microcmsId: article.microcmsId,
          supabaseId,
          slug: article.slug,
          synced: true,
          error: null,
        }

        results.push(result)
        console.log(`[sync-to-supabase] Synced: ${article.slug} (id: ${supabaseId})`)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error(`[sync-to-supabase] Failed to sync ${article.slug}:`, errorMessage)

        results.push({
          microcmsId: article.microcmsId,
          supabaseId: '',
          slug: article.slug,
          synced: false,
          error: errorMessage,
        })
      }
    }

    const syncedCount = results.filter(r => r.synced).length
    console.log(`[sync-to-supabase] Synced ${syncedCount}/${results.length} articles`)

    // コンテキストの共有データに保存
    context.sharedData['syncResults'] = results

    return results
  },
}
