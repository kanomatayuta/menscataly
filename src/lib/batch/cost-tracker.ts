/**
 * コスト追跡
 * AI生成コストの記録・集計・閾値チェック
 */

import { randomUUID } from 'crypto'
import type {
  GenerationCostRecord,
  CostSummary,
  CostType,
} from '@/types/batch-generation'

// ============================================================
// コスト記録の入力型
// ============================================================

export interface CostRecordInput {
  jobId?: string | null
  articleId?: string | null
  costType: CostType
  inputTokens: number
  outputTokens: number
  costUsd: number
  model: string
}

// ============================================================
// CostTracker クラス
// ============================================================

export class CostTracker {
  /** インメモリのコスト記録 (Supabase未設定時のフォールバック) */
  private inMemoryRecords: GenerationCostRecord[] = []

  /**
   * コスト記録を保存する
   */
  async recordCost(input: CostRecordInput): Promise<GenerationCostRecord> {
    const record: GenerationCostRecord = {
      id: randomUUID(),
      jobId: input.jobId ?? null,
      articleId: input.articleId ?? null,
      costType: input.costType,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      costUsd: input.costUsd,
      model: input.model,
      createdAt: new Date().toISOString(),
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      // Dry-run: インメモリに保存
      console.info('[CostTracker] Supabase not configured — storing cost in memory')
      this.inMemoryRecords.push(record)
      return record
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('generation_costs')
        .insert({
          id: record.id,
          job_id: record.jobId,
          article_id: record.articleId,
          cost_type: record.costType,
          input_tokens: record.inputTokens,
          output_tokens: record.outputTokens,
          cost_usd: record.costUsd,
          model: record.model,
        })

      if (error) {
        console.error('[CostTracker] Failed to record cost:', error.message)
        this.inMemoryRecords.push(record)
      }
    } catch (err) {
      console.error('[CostTracker] Supabase error:', err)
      this.inMemoryRecords.push(record)
    }

    return record
  }

  /**
   * 期間のコストサマリーを取得する
   */
  async getCostSummary(startDate: string, endDate: string): Promise<CostSummary> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return this.getInMemoryCostSummary(startDate, endDate)
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('generation_costs')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)

      if (error) {
        console.error('[CostTracker] Failed to query costs:', error.message)
        return this.getInMemoryCostSummary(startDate, endDate)
      }

      return this.aggregateCosts(data ?? [], startDate, endDate)
    } catch (err) {
      console.error('[CostTracker] Supabase query error:', err)
      return this.getInMemoryCostSummary(startDate, endDate)
    }
  }

  /**
   * コスト閾値チェック
   * COST_ALERT_THRESHOLD_USD 環境変数と比較する
   */
  async checkThreshold(): Promise<{
    exceeded: boolean
    currentCost: number
    threshold: number
  }> {
    const thresholdStr = process.env.COST_ALERT_THRESHOLD_USD
    const threshold = thresholdStr ? parseFloat(thresholdStr) : 50.0

    // 過去30日のコストを取得
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const summary = await this.getCostSummary(
      thirtyDaysAgo.toISOString(),
      now.toISOString()
    )

    return {
      exceeded: summary.totalCostUsd >= threshold,
      currentCost: summary.totalCostUsd,
      threshold,
    }
  }

  /**
   * インメモリレコードからサマリーを生成する
   */
  private getInMemoryCostSummary(startDate: string, endDate: string): CostSummary {
    const filtered = this.inMemoryRecords.filter(
      (r) => r.createdAt >= startDate && r.createdAt <= endDate
    )
    return this.aggregateCosts(filtered, startDate, endDate)
  }

  /**
   * レコード配列をサマリーに集約する
   */
  private aggregateCosts(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records: any[],
    startDate: string,
    endDate: string
  ): CostSummary {
    let totalCostUsd = 0
    let articleGenerationCost = 0
    let imageGenerationCost = 0
    let analysisCost = 0
    const articleIds = new Set<string>()

    for (const record of records) {
      const costUsd = parseFloat(record.cost_usd ?? record.costUsd ?? '0')
      const costType = record.cost_type ?? record.costType
      const articleId = record.article_id ?? record.articleId

      totalCostUsd += costUsd

      switch (costType) {
        case 'article_generation':
          articleGenerationCost += costUsd
          if (articleId) articleIds.add(articleId)
          break
        case 'image_generation':
          imageGenerationCost += costUsd
          break
        case 'analysis':
        case 'compliance_check':
          analysisCost += costUsd
          break
      }
    }

    const articleCount = articleIds.size || Math.max(1, records.length)

    return {
      totalCostUsd: Math.round(totalCostUsd * 1000000) / 1000000,
      articleGenerationCost: Math.round(articleGenerationCost * 1000000) / 1000000,
      imageGenerationCost: Math.round(imageGenerationCost * 1000000) / 1000000,
      analysisCost: Math.round(analysisCost * 1000000) / 1000000,
      articleCount,
      avgCostPerArticle: articleCount > 0 ? Math.round((totalCostUsd / articleCount) * 1000000) / 1000000 : 0,
      period: { startDate, endDate },
    }
  }
}
