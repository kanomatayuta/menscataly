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
// PipelineExecutor クラス
// ============================================================

export class PipelineExecutor {
  private config: PipelineConfig

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

    const context: PipelineContext = {
      runId,
      type: this.config.type,
      startedAt,
      config: this.config,
      stepLogs: [],
      sharedData: {},
    }

    console.log(`[Pipeline] Starting run ${runId} (type: ${this.config.type})`)

    let currentInput: unknown = initialInput
    let finalStatus: PipelineStatus = 'success'
    let finalError: string | null = null

    for (const step of steps) {
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

    console.log(`[Pipeline] Run ${runId} completed: ${finalStatus} (${durationMs}ms)`)
    return result
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
   */
  private executeWithTimeout(
    step: PipelineStep,
    input: unknown,
    context: PipelineContext
  ): Promise<unknown> {
    return Promise.race([
      step.execute(input, context),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Step "${step.name}" timed out after ${this.config.timeoutMs}ms`)),
          this.config.timeoutMs
        )
      ),
    ])
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
  const { complianceGateStep } = await import('./steps/compliance-gate')
  const { publishToMicroCMSStep } = await import('./steps/publish-to-microcms')
  const { syncToSupabaseStep } = await import('./steps/sync-to-supabase')

  return [
    fetchTrendsStep,
    fetchAnalyticsStep,
    complianceGateStep,
    publishToMicroCMSStep,
    syncToSupabaseStep,
  ]
}

/**
 * PDCAバッチパイプラインのステップを取得する
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPDCAPipelineSteps(): Promise<PipelineStep<any, any>[]> {
  const { fetchAnalyticsStep } = await import('./steps/fetch-analytics')
  const { fetchAspStep } = await import('./steps/fetch-asp')

  return [
    fetchAnalyticsStep,
    fetchAspStep,
  ]
}
