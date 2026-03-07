/**
 * ReportSyncOrchestrator
 * 全ASPレポートプロバイダーを順次実行し、revenue_daily テーブルへ upsert する。
 * Supabase未設定時は空のSyncResult を返す。
 */

import type {
  IASPReportProvider,
  NormalizedReportRecord,
  SyncResult,
} from './types'

export class ReportSyncOrchestrator {
  private providers: IASPReportProvider[]

  constructor(providers: IASPReportProvider[]) {
    this.providers = providers
  }

  /**
   * 日次バッチ同期
   * @param date YYYY-MM-DD (省略時は昨日)
   */
  async syncDaily(date?: string): Promise<SyncResult> {
    const targetDate = date ?? yesterday()
    const result: SyncResult = {
      date: targetDate,
      providers: [],
      totalRecords: 0,
      errors: [],
    }

    for (const provider of this.providers) {
      try {
        if (!(await provider.isAvailable())) {
          result.providers.push({
            aspName: provider.aspName,
            status: 'skipped',
            reason: 'Provider not available',
          })
          continue
        }

        const records = await provider.fetchReport({
          startDate: targetDate,
          endDate: targetDate,
        })

        const enriched = await this.enrichWithArticleSlug(records)
        const upserted = await this.upsertToRevenueDailyTable(enriched)
        await this.updateAffiliateLinksTotals(enriched)

        result.providers.push({
          aspName: provider.aspName,
          status: 'success',
          recordCount: upserted,
        })
        result.totalRecords += upserted
      } catch (error) {
        result.errors.push({
          aspName: provider.aspName,
          error: error instanceof Error ? error.message : String(error),
        })
        result.providers.push({
          aspName: provider.aspName,
          status: 'error',
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return result
  }

  /** 記事紐付け補完: article_slug がない場合、affiliate_links から検索 */
  async enrichWithArticleSlug(
    records: NormalizedReportRecord[]
  ): Promise<NormalizedReportRecord[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return records

    const enriched: NormalizedReportRecord[] = []
    for (const record of records) {
      if (record.articleSlug) {
        enriched.push(record)
        continue
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('affiliate_links')
          .select('article_id, articles(slug)')
          .eq('asp_name', record.aspName)
          .limit(1)
          .maybeSingle()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const slug = (data as any)?.articles?.slug as string | undefined
        enriched.push(slug ? { ...record, articleSlug: slug } : record)
      } catch {
        enriched.push(record)
      }
    }
    return enriched
  }

  /** revenue_daily テーブルへの upsert */
  async upsertToRevenueDailyTable(
    records: NormalizedReportRecord[]
  ): Promise<number> {
    if (records.length === 0) return 0

    const supabase = getSupabaseClient()
    if (!supabase) return 0

    const rows = records.map((r) => ({
      date: r.date,
      asp_name: r.aspName,
      program_id: r.programId,
      article_slug: r.articleSlug ?? null,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions_pending: r.conversionsPending,
      conversions_confirmed: r.conversionsConfirmed,
      conversions_cancelled: r.conversionsCancelled,
      revenue_pending: r.revenuePending,
      revenue_confirmed: r.revenueConfirmed,
      revenue_cancelled: r.revenueCancelled,
      source: r.rawData ? 'csv' : 'api',
      raw_data: r.rawData ?? null,
      updated_at: new Date().toISOString(),
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('revenue_daily')
      .upsert(rows, {
        onConflict: 'date,asp_name,program_id,article_slug',
      })

    if (error) throw error
    return rows.length
  }

  /** affiliate_links の集計値を更新（絶対値upsert — 二重カウント防止） */
  async updateAffiliateLinksTotals(
    records: NormalizedReportRecord[]
  ): Promise<void> {
    const supabase = getSupabaseClient()
    if (!supabase) return

    // aspName + programId ごとに集計
    const totals = new Map<
      string,
      { aspName: string; programId: string; clicks: number; conversions: number; revenue: number }
    >()

    for (const r of records) {
      const key = `${r.aspName}:${r.programId}`
      const current = totals.get(key) ?? { aspName: r.aspName, programId: r.programId, clicks: 0, conversions: 0, revenue: 0 }
      current.clicks += r.clicks
      current.conversions += r.conversionsConfirmed
      current.revenue += r.revenueConfirmed
      totals.set(key, current)
    }

    for (const [key, total] of totals) {
      try {
        // aspName + programId で正確にマッチング
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: links } = await (supabase as any)
          .from('affiliate_links')
          .select('id')
          .eq('asp_name', total.aspName)
          .eq('program_id', total.programId)

        if (links && links.length > 0) {
          for (const link of links) {
            // 絶対値で設定（加算ではなく上書き — 二重カウント防止）
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('affiliate_links')
              .update({
                click_count: total.clicks,
                conversion_count: total.conversions,
                revenue: total.revenue,
                updated_at: new Date().toISOString(),
              })
              .eq('id', link.id)
          }
        }
      } catch (err) {
        console.error(`[SyncOrchestrator] Failed to update affiliate_links for ${key}:`, err)
      }
    }
  }
}

/** Supabase クライアントを取得。未設定時は null を返す */
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  // Dynamic import to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
