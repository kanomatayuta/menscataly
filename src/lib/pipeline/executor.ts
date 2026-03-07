/**
 * パイプライン実行エンジン
 * データ取得 → 分析 → 記事生成 → 薬機法チェック → 公開 の順次実行
 * エラー時リトライ（最大3回）、Supabaseへの実行記録を担当
 */

import { randomUUID } from 'crypto'
import type {
  PipelineConfig,
  PipelineContext,
  PipelineResult,
  PipelineStatus,
  PipelineStep,
  StepLog,
  StepStatus,
} from './types'
import type { SlackBlock } from '@/lib/notification/slack'

// ============================================================
// デフォルト設定
// ============================================================

const DEFAULT_CONFIG: PipelineConfig = {
  type: 'manual',
  maxConcurrentSteps: 1,
  retryDelayMs: 5000,
  timeoutMs: 1800000,  // 30分
  enableSupabaseLogging: true,
  dryRun: false,
}

// ============================================================
// Global registry: track running pipelines for stop support
// ============================================================

const runningPipelines = new Map<string, AbortController>()

/** Get all currently running pipeline run IDs */
export function getRunningPipelineIds(): string[] {
  return Array.from(runningPipelines.keys())
}

/** Abort a running pipeline by runId. Returns true if found and aborted. */
export function abortPipeline(runId: string): boolean {
  const controller = runningPipelines.get(runId)
  if (controller) {
    controller.abort()
    runningPipelines.delete(runId)
    return true
  }
  return false
}

/** Abort all running pipelines. Returns number of pipelines aborted. */
export function abortAllPipelines(): number {
  let count = 0
  for (const [id, controller] of runningPipelines) {
    controller.abort()
    runningPipelines.delete(id)
    count++
  }
  return count
}

/**
 * Supabase から status='running' のパイプラインを検索し、
 * まだ runningPipelines に登録されていないものを 'failed'（タイムアウト）として更新する。
 * サーバーリロード後の孤立 running レコードをクリーンアップする。
 */
export async function cleanupOrphanedPipelines(): Promise<number> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) return 0

    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // status='running' のレコードを取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('pipeline_runs')
      .select('id')
      .eq('status', 'running')

    if (error || !data || data.length === 0) return 0

    // メモリ内の runningPipelines に存在しないものは orphaned
    const orphanedIds = data
      .map((r: { id: string }) => r.id)
      .filter((id: string) => !runningPipelines.has(id))

    if (orphanedIds.length === 0) return 0

    // orphaned レコードを 'failed' に更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('pipeline_runs')
      .update({
        status: 'failed',
        error: 'サーバー再起動により中断されました',
        completed_at: new Date().toISOString(),
      })
      .in('id', orphanedIds)

    if (updateError) {
      console.error('[pipeline] Failed to cleanup orphaned pipelines:', updateError.message)
      return 0
    }

    console.log(`[pipeline] Cleaned up ${orphanedIds.length} orphaned pipeline(s)`)
    return orphanedIds.length
  } catch (err) {
    console.error('[pipeline] cleanupOrphanedPipelines error:', err)
    return 0
  }
}

// ============================================================
// PipelineExecutor クラス
// ============================================================

export class PipelineExecutor {
  private config: PipelineConfig
  private lastSharedData: Record<string, unknown> | null = null

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * パイプラインを実行する
   * @param steps 実行するステップの配列（順次実行）
   * @param initialInput 最初のステップへの入力
   */
  async run<TInitial = unknown>(
    steps: PipelineStep[],
    initialInput: TInitial = {} as TInitial
  ): Promise<PipelineResult> {
    const runId = randomUUID()
    const startedAt = new Date().toISOString()

    // Register abort controller for this run
    const abortController = new AbortController()
    runningPipelines.set(runId, abortController)

    // initialInput がオブジェクトの場合、sharedData の初期値として使用
    const initialSharedData = (initialInput && typeof initialInput === 'object' && !Array.isArray(initialInput))
      ? { ...(initialInput as Record<string, unknown>) }
      : {}

    const context: PipelineContext = {
      runId,
      type: this.config.type,
      startedAt,
      config: this.config,
      stepLogs: [],
      sharedData: initialSharedData,
      signal: abortController.signal,
    }

    console.log(`[Pipeline] Starting run ${runId} (type: ${this.config.type})`)

    // Record "running" status to Supabase immediately so UI can detect it
    if (this.config.enableSupabaseLogging && !this.config.dryRun) {
      await this.recordRunningToSupabase(runId, startedAt)
    }

    try {
      let currentInput: unknown = initialInput
      let finalStatus: PipelineStatus = 'success'
      let finalError: string | null = null

      for (const step of steps) {
        // Check abort before each step
        if (abortController.signal.aborted) {
          finalStatus = 'failed'
          finalError = 'パイプラインが手動で停止されました'
          console.log(`[Pipeline] Run ${runId} was stopped by user`)
          break
        }

        const stepResult = await this.executeStep(step, currentInput, context)
        context.stepLogs.push(stepResult.log)

        if (stepResult.log.status === 'failed') {
          finalStatus = 'failed'
          finalError = stepResult.log.error
          console.error(`[Pipeline] Step "${step.name}" failed — aborting pipeline`)

          // パイプライン失敗アラートを作成
          try {
            await this.createFailureAlert(step.name, stepResult.log.error, context.runId)
          } catch (err) {
            console.error('[Pipeline] Failed to create alert:', err)
          }

          break
        }

        // 次のステップへの入力として出力を渡す
        currentInput = stepResult.output
      }

      const completedAt = new Date().toISOString()
      const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()

      const result: PipelineResult = {
        runId,
        type: this.config.type,
        status: finalStatus,
        startedAt,
        completedAt,
        durationMs,
        stepLogs: context.stepLogs,
        error: finalError,
        metadata: {
          totalSteps: steps.length,
          completedSteps: context.stepLogs.filter(l => l.status === 'success').length,
          failedSteps: context.stepLogs.filter(l => l.status === 'failed').length,
          dryRun: this.config.dryRun,
        },
      }

      // Supabaseへの記録
      if (this.config.enableSupabaseLogging && !this.config.dryRun) {
        await this.recordToSupabase(result)
      }

      // sharedData を保存（完了通知内でPDCAレポート生成に使用）
      this.lastSharedData = context.sharedData

      // Slack完了通知（dryRun時はスキップ）
      if (!this.config.dryRun) {
        try {
          await this.sendCompletionNotification(result)
        } catch (err) {
          console.error('[Pipeline] Failed to send completion notification:', err)
        }
      }

      console.log(`[Pipeline] Run ${runId} completed: ${finalStatus} (${durationMs}ms)`)
      return result
    } finally {
      // Clean up from registry — always runs even if an unexpected error is thrown
      runningPipelines.delete(runId)
    }
  }

  /**
   * 単一ステップをリトライ付きで実行する
   */
  private async executeStep(
    step: PipelineStep,
    input: unknown,
    context: PipelineContext
  ): Promise<{ log: StepLog; output: unknown }> {
    const maxRetries = step.maxRetries ?? 3
    const stepStartedAt = new Date().toISOString()
    let lastError: string | null = null

    console.log(`[Pipeline] Executing step: ${step.name}`)

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[Pipeline] Retrying step "${step.name}" (attempt ${attempt}/${maxRetries})`)
        await this.sleep(this.config.retryDelayMs * attempt)
      }

      try {
        const output = await this.executeWithTimeout(step, input, context)
        const completedAt = new Date().toISOString()

        const log: StepLog = {
          stepName: step.name,
          status: 'success',
          startedAt: stepStartedAt,
          completedAt,
          durationMs: new Date(completedAt).getTime() - new Date(stepStartedAt).getTime(),
          error: null,
          metadata: {
            attempts: attempt + 1,
          },
        }

        console.log(`[Pipeline] Step "${step.name}" succeeded (attempt ${attempt + 1})`)
        return { log, output }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.warn(`[Pipeline] Step "${step.name}" failed (attempt ${attempt + 1}): ${lastError}`)
      }
    }

    // 全リトライ失敗
    const completedAt = new Date().toISOString()
    const log: StepLog = {
      stepName: step.name,
      status: 'failed' as StepStatus,
      startedAt: stepStartedAt,
      completedAt,
      durationMs: new Date(completedAt).getTime() - new Date(stepStartedAt).getTime(),
      error: lastError,
      metadata: {
        attempts: maxRetries + 1,
      },
    }

    return { log, output: null }
  }

  /**
   * ステップをタイムアウト付きで実行する
   * ステップ完了時に setTimeout をクリアして Timer リークを防止する
   */
  private executeWithTimeout(
    step: PipelineStep,
    input: unknown,
    context: PipelineContext
  ): Promise<unknown> {
    const timeoutMs = step.timeoutMs ?? this.config.timeoutMs
    let timeoutId: NodeJS.Timeout

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Step "${step.name}" timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    })

    return Promise.race([
      step.execute(input, context).finally(() => clearTimeout(timeoutId)),
      timeoutPromise,
    ])
  }

  /**
   * 実行開始時に "running" ステータスを Supabase に記録する
   * ポーリングUIで実行中を検出できるようにする
   */
  private async recordRunningToSupabase(runId: string, startedAt: string): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) return

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('pipeline_runs')
        .upsert({
          id: runId,
          type: this.config.type,
          status: 'running',
          started_at: startedAt,
          completed_at: null,
          steps_json: [],
          error: null,
        })
    } catch (err) {
      console.error('[Pipeline] Failed to record running status:', err)
    }
  }

  /**
   * 実行結果をSupabaseへ記録する
   * 環境変数が未設定の場合はスキップ
   */
  private async recordToSupabase(result: PipelineResult): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[Pipeline] Supabase env vars not set — skipping log recording')
      return
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('pipeline_runs')
        .upsert({
          id: result.runId,
          type: result.type,
          status: result.status,
          started_at: result.startedAt,
          completed_at: result.completedAt,
          steps_json: result.stepLogs,
          error: result.error,
        })

      if (error) {
        console.error('[Pipeline] Failed to record to Supabase:', error.message)
      } else {
        console.log(`[Pipeline] Recorded run ${result.runId} to Supabase`)
      }
    } catch (err) {
      // Supabase記録失敗はパイプライン全体を止めない
      console.error('[Pipeline] Supabase recording error:', err)
    }
  }

  /**
   * パイプライン完了時のSlack通知を送信する
   * 成功/失敗に関わらずサマリーを通知する
   */
  private async sendCompletionNotification(result: PipelineResult): Promise<void> {
    try {
      const { SlackNotifier } = await import('@/lib/notification/slack')
      const notifier = new SlackNotifier()

      const isSuccess = result.status === 'success'
      const emoji = isSuccess ? ':white_check_mark:' : ':x:'
      const statusLabel = isSuccess ? '成功' : '失敗'
      const durationSec = (result.durationMs / 1000).toFixed(1)

      const stepSummary = result.stepLogs
        .map((log) => {
          const icon = log.status === 'success' ? ':white_check_mark:' : ':x:'
          const duration = log.durationMs != null ? `${(log.durationMs / 1000).toFixed(1)}s` : '-'
          return `${icon} ${log.stepName} (${duration})`
        })
        .join('\n')

      const blocks: SlackBlock[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} パイプライン${statusLabel}: ${result.type}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*タイプ:*\n${result.type}` },
            { type: 'mrkdwn', text: `*ステータス:*\n${statusLabel}` },
            { type: 'mrkdwn', text: `*実行時間:*\n${durationSec}秒` },
            { type: 'mrkdwn', text: `*ステップ:*\n${result.metadata.completedSteps}/${result.metadata.totalSteps} 完了` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*ステップ詳細:*\n${stepSummary}`,
          },
        },
      ]

      // 失敗時はエラー情報を追加
      if (result.error) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*エラー:*\n\`\`\`${result.error}\`\`\``,
          },
        })
      }

      const fallbackText = `[Pipeline] ${result.type} ${statusLabel} — ${result.metadata.completedSteps}/${result.metadata.totalSteps} steps (${durationSec}s)`

      await notifier.sendMessage('#レポート', fallbackText, blocks)

      // PDCAパイプラインの場合、詳細分析レポートも送信
      if (result.type === 'pdca' && result.status === 'success') {
        try {
          const { buildPDCAReport } = await import('./pdca-report')
          const report = buildPDCAReport({
            result,
            sharedData: this.lastSharedData ?? {},
          })
          await notifier.sendMessage('#レポート', report.text, report.blocks)
        } catch (reportErr) {
          console.error('[Pipeline] PDCA report error:', reportErr)
        }
      }

      // Daily パイプラインの場合、生成記事の一覧をリンク付きで送信
      if ((result.type === 'daily' || result.type === 'manual') && result.status === 'success') {
        try {
          const published = (this.lastSharedData?.['publishedArticles'] ?? []) as Array<{
            title: string
            slug: string
          }>
          if (published.length > 0) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://menscataly.com'
            const articleLines = published
              .map((a) => `• <${baseUrl}/articles/${a.slug}|${a.title}>`)
              .join('\n')

            const articleBlocks: SlackBlock[] = [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `📝 新規記事 ${published.length}件を作成しました`,
                  emoji: true,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: articleLines,
                },
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: {
                      type: 'mrkdwn',
                      text: `Run: ${result.runId} | ステータス: 下書き（microCMSで公開してください）`,
                    },
                  },
                ],
              },
            ]

            const articleFallback = `[記事作成] ${published.length}件: ${published.map((a) => a.title).join(', ')}`
            await notifier.sendMessage('#記事', articleFallback, articleBlocks)
          }
        } catch (articleErr) {
          console.error('[Pipeline] Article notification error:', articleErr)
        }
      }
    } catch (err) {
      console.error('[Pipeline] Completion notification error:', err)
    }
  }

  /**
   * パイプライン失敗時のアラートを作成する (動的インポート)
   */
  private async createFailureAlert(
    stepName: string,
    error: string | null,
    runId: string
  ): Promise<void> {
    try {
      const { AlertManager } = await import('@/lib/monitoring/alert-manager')
      const alertManager = new AlertManager()
      await alertManager.createAlert({
        type: 'pipeline_failure',
        severity: 'critical',
        title: `パイプラインステップ "${stepName}" が失敗しました`,
        message: error ?? 'Unknown error',
        metadata: { runId, stepName },
      })
    } catch (err) {
      console.error('[Pipeline] AlertManager import/create error:', err)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================
// デフォルトのパイプラインステップ群を組み立てるファクトリ関数
// ============================================================

/**
 * 日次パイプラインのステップを取得する
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDailyPipelineSteps(): Promise<PipelineStep<any, any>[]> {
  const { fetchTrendsStep } = await import('./steps/fetch-trends')
  const { fetchAnalyticsStep } = await import('./steps/fetch-analytics')
  const { generateArticlesStep } = await import('./steps/generate-articles')
  const { complianceGateStep } = await import('./steps/compliance-gate')
  const { publishToMicroCMSStep } = await import('./steps/publish-to-microcms')
  const { syncToSupabaseStep } = await import('./steps/sync-to-supabase')

  return [
    fetchTrendsStep,
    fetchAnalyticsStep,
    generateArticlesStep,
    complianceGateStep,
    publishToMicroCMSStep,
    syncToSupabaseStep,
  ]
}

/**
 * PDCAバッチパイプラインのステップを取得する
 *
 * 完全なPDCAループ:
 * 1. fetch-analytics — GA4/GSC からアナリティクスデータ取得
 * 2. fetch-asp — ASP各社から収益データ取得
 * 3. calculate-health-scores — 全記事のヘルススコア算出
 * 4. auto-depublish — コンプライアンス違反記事の自動非公開化
 * 5. performance-alerts — パフォーマンス低下検出・アラート作成
 * 6. execute-rewrites — 低パフォーマンス記事の自動リライト
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPDCAPipelineSteps(): Promise<PipelineStep<any, any>[]> {
  const { fetchAnalyticsStep } = await import('./steps/fetch-analytics')
  const { fetchAspStep } = await import('./steps/fetch-asp')
  const { calculateHealthScoresStep } = await import('./steps/calculate-health-scores')
  const { autoDepublishStep } = await import('./steps/auto-depublish')
  const { performanceAlertsStep } = await import('./steps/performance-alerts')
  const { executeRewritesStep } = await import('./steps/execute-rewrites')

  return [
    fetchAnalyticsStep,
    fetchAspStep,
    calculateHealthScoresStep,
    autoDepublishStep,
    performanceAlertsStep,
    executeRewritesStep,
  ]
}
