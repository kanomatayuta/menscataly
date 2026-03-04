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
import type { ContentCategory } from '@/types/content'

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
// 内部拡張型: BatchGenerationProgress + キーワード別進捗
// ============================================================

interface InternalBatchProgress extends BatchGenerationProgress {
  /** 各キーワードの個別進捗 */
  keywordProgress: KeywordGenerationProgress[]
  /** 現在処理中のキーワード数 */
  inProgressCount: number
}

// ============================================================
// バッチ生成進捗ストア (インメモリ)
// ============================================================

const progressStore = new Map<string, InternalBatchProgress>()

/**
 * ジョブIDから進捗を取得する
 */
export function getBatchProgress(jobId: string): BatchGenerationProgress | null {
  const internal = progressStore.get(jobId)
  if (!internal) return null
  // Return the public shape (InternalBatchProgress extends BatchGenerationProgress)
  return {
    jobId: internal.jobId,
    status: internal.status,
    total: internal.total,
    completed: internal.completed,
    failed: internal.failed,
    progressPercent: internal.progressPercent,
    currentKeywords: internal.currentKeywords,
    estimatedRemainingSeconds: internal.estimatedRemainingSeconds,
    totalCostUsd: internal.totalCostUsd,
    startedAt: internal.startedAt,
    updatedAt: internal.updatedAt,
  }
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
    const keywords = request.keywords ?? []

    // 進捗オブジェクトを初期化
    const progress: InternalBatchProgress = {
      jobId,
      status: 'running',
      total: keywords.length,
      completed: 0,
      failed: 0,
      progressPercent: 0,
      currentKeywords: [],
      inProgressCount: 0,
      keywordProgress: keywords.map((kw) => ({
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
      estimatedRemainingSeconds: undefined,
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
      progress.keywordProgress = progress.keywordProgress.map((p) => ({
        ...p,
        status: 'completed' as const,
        complianceScore: 95,
        costUsd: 0,
        completedAt: new Date().toISOString(),
      }))
      progress.completed = keywords.length
      progress.progressPercent = 100
      progressStore.set(jobId, progress)
      return getBatchProgress(jobId)!
    }

    // バックグラウンドで生成を実行
    this.executeGeneration(jobId, request, progress).catch((err) => {
      console.error(`[BatchGenerator] Unexpected error for job ${jobId}:`, err)
      progress.status = 'failed'
      progress.updatedAt = new Date().toISOString()
      progressStore.set(jobId, progress)
    })

    return getBatchProgress(jobId)!
  }

  /**
   * 生成処理の実行 (並行数制限付き)
   */
  private async executeGeneration(
    jobId: string,
    request: BatchGenerationRequest,
    progress: InternalBatchProgress
  ): Promise<void> {
    const maxConcurrent = request.maxConcurrent ?? 2
    const semaphore = new Semaphore(maxConcurrent)
    const startTime = Date.now()
    const keywords = request.keywords ?? []

    const promises = keywords.map((keyword, index) =>
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
    const allFailed = progress.failed === keywords.length

    if (allFailed) {
      progress.status = 'failed'
    } else {
      progress.status = 'completed'
    }

    progress.estimatedRemainingSeconds = 0
    progress.progressPercent = 100
    progress.currentKeywords = []
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
    progress: InternalBatchProgress,
    semaphore: Semaphore,
    batchStartTime: number
  ): Promise<void> {
    await semaphore.acquire()

    const kwProgress = progress.keywordProgress[index]
    kwProgress.status = 'generating'
    kwProgress.startedAt = new Date().toISOString()
    progress.inProgressCount++
    progress.currentKeywords = progress.keywordProgress
      .filter((p) => p.status === 'generating')
      .map((p) => p.keyword)
    progress.updatedAt = new Date().toISOString()

    try {
      // ArticleGenerator と ASP セレクターを動的インポート
      const { ArticleGenerator } = await import('@/lib/content/generator')
      const { selectBestPrograms, toAffiliateLinks } = await import('@/lib/asp/selector')
      const { injectAffiliateLinksByCategory } = await import('@/lib/asp/link-injector')
      const generator = new ArticleGenerator()

      // カテゴリに最適なアフィリエイトリンクを選定
      const bestPrograms = await selectBestPrograms(keyword.category as ContentCategory)
      const affiliateLinks = toAffiliateLinks(bestPrograms)

      const response = await generator.generate({
        category: keyword.category,
        keyword: keyword.keyword,
        subKeywords: keyword.subKeywords,
        targetAudience: keyword.targetAudience,
        tone: keyword.tone,
        targetLength: keyword.targetLength,
        affiliateLinks,
      })

      // 生成後にアフィリエイトリンクをHTMLとして注入
      response.article.content = await injectAffiliateLinksByCategory(
        response.article.content,
        keyword.category as ContentCategory
      )

      // コンプライアンスチェック
      kwProgress.status = 'compliance_check'
      progress.updatedAt = new Date().toISOString()

      const complianceScore = response.compliance.score
      kwProgress.complianceScore = complianceScore

      // コンプライアンス閾値チェック
      const threshold = request.complianceThreshold ?? 80
      if (complianceScore < threshold) {
        throw new Error(
          `Compliance score ${complianceScore} is below threshold ${threshold}`
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
      progress.completed++

      // onArticleGenerated コールバック呼び出し
      if (request.onArticleGenerated) {
        try {
          await request.onArticleGenerated(response.article, keyword.keyword)
        } catch (callbackErr) {
          console.error(
            `[BatchGenerator] onArticleGenerated callback failed for "${keyword.keyword}":`,
            callbackErr
          )
        }
      }

      // 進捗率と残り時間推定を更新
      const keywords = request.keywords ?? []
      progress.progressPercent = Math.round(
        ((progress.completed + progress.failed) / keywords.length) * 100
      )
      const elapsed = Date.now() - batchStartTime
      const avgTimePerArticle = elapsed / progress.completed
      const remaining = keywords.length - progress.completed - progress.failed
      progress.estimatedRemainingSeconds = Math.round((avgTimePerArticle * remaining) / 1000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      kwProgress.status = 'failed'
      kwProgress.error = errorMessage
      kwProgress.completedAt = new Date().toISOString()
      progress.failed++

      console.error(
        `[BatchGenerator] Keyword "${keyword.keyword}" failed: ${errorMessage}`
      )

      if (!request.continueOnError) {
        // 残りのキーワードをスキップ扱いにする
        for (const p of progress.keywordProgress) {
          if (p.status === 'pending') {
            p.status = 'failed'
            p.error = 'Batch aborted due to error'
            progress.failed++
          }
        }
      }

      // 進捗率を更新
      const keywords = request.keywords ?? []
      progress.progressPercent = Math.round(
        ((progress.completed + progress.failed) / keywords.length) * 100
      )
    } finally {
      progress.inProgressCount = Math.max(0, progress.inProgressCount - 1)
      progress.currentKeywords = progress.keywordProgress
        .filter((p) => p.status === 'generating')
        .map((p) => p.keyword)
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
          total_keywords: (request.keywords ?? []).length,
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
    progress: InternalBatchProgress
  ): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      const errorMessages = progress.keywordProgress
        .filter((p) => p.error)
        .map((p) => `${p.keyword}: ${p.error}`)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('batch_generation_jobs')
        .update({
          status: progress.status,
          completed_count: progress.completed,
          failed_count: progress.failed,
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
