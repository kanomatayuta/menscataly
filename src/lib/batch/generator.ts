/**
 * バッチ記事生成エンジン
 * 複数キーワードの記事を並行生成する (セマフォで並行数制限)
 */

import { randomUUID } from 'crypto'
import type {
  BatchGenerationRequest,
  BatchGenerationProgress,
  KeywordGenerationProgress,
  KeywordTarget,
} from '@/types/batch-generation'
import type { BatchJobStatus } from '@/types/admin'

// ============================================================
// セマフォ (並行数制限)
// ============================================================

class Semaphore {
  private current = 0
  private waiting: (() => void)[] = []

  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++
      return
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    this.current--
    const next = this.waiting.shift()
    if (next) {
      this.current++
      next()
    }
  }
}

// ============================================================
// バッチ生成進捗ストア (インメモリ)
// ============================================================

const progressStore = new Map<string, BatchGenerationProgress>()

/**
 * ジョブIDから進捗を取得する
 */
export function getBatchProgress(jobId: string): BatchGenerationProgress | null {
  return progressStore.get(jobId) ?? null
}

// ============================================================
// BatchArticleGenerator クラス
// ============================================================

export class BatchArticleGenerator {
  /**
   * バッチ記事生成を実行する
   */
  async generateBatch(
    request: BatchGenerationRequest
  ): Promise<BatchGenerationProgress> {
    const jobId = randomUUID()
    const now = new Date().toISOString()

    // 進捗オブジェクトを初期化
    const progress: BatchGenerationProgress = {
      jobId,
      status: 'running',
      totalKeywords: request.keywords.length,
      completedCount: 0,
      failedCount: 0,
      inProgressCount: 0,
      progress: request.keywords.map((kw) => ({
        keywordId: kw.id,
        keyword: kw.keyword,
        status: 'pending',
        articleId: null,
        complianceScore: null,
        costUsd: null,
        startedAt: null,
        completedAt: null,
        error: null,
      })),
      totalCostUsd: 0,
      estimatedRemainingMs: null,
      startedAt: now,
      updatedAt: now,
    }

    // インメモリストアに保存
    progressStore.set(jobId, progress)

    // Supabaseへジョブ作成 (利用可能な場合)
    await this.createJobInSupabase(jobId, request)

    // ドライランモード
    if (request.dryRun) {
      progress.status = 'completed'
      progress.updatedAt = new Date().toISOString()
      progress.progress = progress.progress.map((p) => ({
        ...p,
        status: 'completed',
        complianceScore: 95,
        costUsd: 0,
        completedAt: new Date().toISOString(),
      }))
      progress.completedCount = request.keywords.length
      progressStore.set(jobId, progress)
      return progress
    }

    // バックグラウンドで生成を実行
    this.executeGeneration(jobId, request, progress).catch((err) => {
      console.error(`[BatchGenerator] Unexpected error for job ${jobId}:`, err)
      progress.status = 'failed'
      progress.updatedAt = new Date().toISOString()
      progressStore.set(jobId, progress)
    })

    return progress
  }

  /**
   * 生成処理の実行 (並行数制限付き)
   */
  private async executeGeneration(
    jobId: string,
    request: BatchGenerationRequest,
    progress: BatchGenerationProgress
  ): Promise<void> {
    const semaphore = new Semaphore(request.maxConcurrent)
    const startTime = Date.now()

    const promises = request.keywords.map((keyword, index) =>
      this.processKeyword(
        keyword,
        index,
        request,
        progress,
        semaphore,
        startTime
      )
    )

    await Promise.allSettled(promises)

    // 最終ステータスを更新
    const hasFailures = progress.failedCount > 0
    const allFailed = progress.failedCount === request.keywords.length

    if (allFailed) {
      progress.status = 'failed'
    } else if (hasFailures) {
      progress.status = 'completed' // 一部失敗でも completed
    } else {
      progress.status = 'completed'
    }

    progress.estimatedRemainingMs = 0
    progress.updatedAt = new Date().toISOString()
    progressStore.set(jobId, progress)

    // Supabaseへ完了記録
    await this.updateJobInSupabase(jobId, progress)
  }

  /**
   * 単一キーワードの記事生成処理
   */
  private async processKeyword(
    keyword: KeywordTarget,
    index: number,
    request: BatchGenerationRequest,
    progress: BatchGenerationProgress,
    semaphore: Semaphore,
    batchStartTime: number
  ): Promise<void> {
    await semaphore.acquire()

    const kwProgress = progress.progress[index]
    kwProgress.status = 'generating'
    kwProgress.startedAt = new Date().toISOString()
    progress.inProgressCount++
    progress.updatedAt = new Date().toISOString()

    try {
      // ArticleGenerator を動的インポート
      const { ArticleGenerator } = await import('@/lib/content/generator')
      const generator = new ArticleGenerator()

      const response = await generator.generate({
        category: keyword.category,
        keyword: keyword.keyword,
        subKeywords: keyword.subKeywords,
        targetAudience: keyword.targetAudience,
        tone: keyword.tone,
        targetLength: keyword.targetLength,
        outlineHints: keyword.outlineHints,
      })

      // コンプライアンスチェック
      kwProgress.status = 'compliance_check'
      progress.updatedAt = new Date().toISOString()

      const complianceScore = response.compliance.score
      kwProgress.complianceScore = complianceScore

      // コンプライアンス閾値チェック
      if (complianceScore < request.complianceThreshold) {
        throw new Error(
          `Compliance score ${complianceScore} is below threshold ${request.complianceThreshold}`
        )
      }

      // コスト記録
      const costUsd = response.article.complianceScore
        ? 0.05 // ダミー記事の場合
        : 0
      kwProgress.costUsd = costUsd
      progress.totalCostUsd += costUsd

      // 成功
      kwProgress.status = 'completed'
      kwProgress.articleId = response.article.id ?? randomUUID()
      kwProgress.completedAt = new Date().toISOString()
      progress.completedCount++

      // 残り時間推定
      const elapsed = Date.now() - batchStartTime
      const avgTimePerArticle = elapsed / progress.completedCount
      const remaining = progress.totalKeywords - progress.completedCount - progress.failedCount
      progress.estimatedRemainingMs = Math.round(avgTimePerArticle * remaining)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      kwProgress.status = 'failed'
      kwProgress.error = errorMessage
      kwProgress.completedAt = new Date().toISOString()
      progress.failedCount++

      console.error(
        `[BatchGenerator] Keyword "${keyword.keyword}" failed: ${errorMessage}`
      )

      if (!request.continueOnError) {
        // 残りのキーワードをスキップ扱いにする
        for (const p of progress.progress) {
          if (p.status === 'pending') {
            p.status = 'failed'
            p.error = 'Batch aborted due to error'
            progress.failedCount++
          }
        }
      }
    } finally {
      progress.inProgressCount = Math.max(0, progress.inProgressCount - 1)
      progress.updatedAt = new Date().toISOString()
      semaphore.release()
    }
  }

  /**
   * Supabaseへバッチジョブを作成する
   */
  private async createJobInSupabase(
    jobId: string,
    request: BatchGenerationRequest
  ): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[BatchGenerator] Supabase not configured — skipping job creation')
      return
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('batch_generation_jobs')
        .insert({
          id: jobId,
          status: 'running',
          total_keywords: request.keywords.length,
          created_by: request.requestedBy,
        })

      if (error) {
        console.error('[BatchGenerator] Failed to create job in Supabase:', error.message)
      }
    } catch (err) {
      console.error('[BatchGenerator] Supabase job creation error:', err)
    }
  }

  /**
   * Supabaseのバッチジョブを更新する
   */
  private async updateJobInSupabase(
    jobId: string,
    progress: BatchGenerationProgress
  ): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      const errorMessages = progress.progress
        .filter((p) => p.error)
        .map((p) => `${p.keyword}: ${p.error}`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('batch_generation_jobs')
        .update({
          status: progress.status,
          completed_count: progress.completedCount,
          failed_count: progress.failedCount,
          completed_at: new Date().toISOString(),
          total_cost_usd: progress.totalCostUsd,
          error_messages: errorMessages,
        })
        .eq('id', jobId)

      if (error) {
        console.error('[BatchGenerator] Failed to update job in Supabase:', error.message)
      }
    } catch (err) {
      console.error('[BatchGenerator] Supabase job update error:', err)
    }
  }
}
