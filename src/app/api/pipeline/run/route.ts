/**
 * POST /api/pipeline/run
 * パイプライン手動実行トリガー
 * Authorization: Bearer <key> or X-Pipeline-Api-Key ヘッダーによる認証
 *
 * GET /api/pipeline/run?type=daily|pdca
 * Vercel Cron Jobs 自動実行用エンドポイント
 * Authorization: Bearer <CRON_SECRET> ヘッダーによる認証
 */

import { NextRequest, NextResponse } from 'next/server'
import { PipelineExecutor, getDailyPipelineSteps, getPDCAPipelineSteps } from '@/lib/pipeline/executor'
import { getPipelineConfig } from '@/lib/pipeline/scheduler'
import { validatePipelineAuth, validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import type { PipelineType, PipelineRunResponse } from '@/lib/pipeline/types'

// ============================================================
// リクエスト型
// ============================================================

interface RunPipelineRequest {
  type?: PipelineType
  dryRun?: boolean
}

// ============================================================
// 共通パイプライン実行ロジック
// ============================================================

async function executePipeline(
  pipelineType: PipelineType,
  dryRun: boolean
): Promise<NextResponse> {
  // パイプライン設定を取得
  const config = getPipelineConfig(pipelineType)
  if (dryRun) {
    config.dryRun = true
  }

  console.log(`[pipeline/run] Starting pipeline: type=${pipelineType}, dryRun=${dryRun}`)

  try {
    // ステップを取得
    const steps = pipelineType === 'pdca'
      ? await getPDCAPipelineSteps()
      : await getDailyPipelineSteps()

    // パイプラインを非同期で実行（レスポンスは即時返却）
    const executor = new PipelineExecutor(config)

    // バックグラウンドで実行（Vercel/Cloud Run はバックグラウンドタスクを制限するため
    // 実際の環境では Cloud Run Job を使用することを推奨）
    const runPromise = executor.run(steps)

    // Cloud Run / Vercel では waitUntil を使用して非同期実行を保証する
    // ここでは即時レスポンスを返し、バックグラウンド実行を開始する
    const runId = await new Promise<string>((resolve) => {
      // runId を取得するため一時的にレースコンディションを回避
      let resolved = false

      // タイムアウト付きで runId を待つ（500ms）
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve(`pipeline-${Date.now()}`)
        }
      }, 500)

      runPromise
        .then(result => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            resolve(result.runId)
          }
        })
        .catch(err => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            console.error('[pipeline/run] Pipeline execution error:', err)
            resolve(`pipeline-error-${Date.now()}`)
          }
        })
    })

    const response: PipelineRunResponse = {
      success: true,
      runId,
      message: `Pipeline "${pipelineType}" started successfully`,
      status: 'running',
    }

    return NextResponse.json(response, { status: 202 })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[pipeline/run] Failed to start pipeline:', errorMessage)

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Failed to start pipeline',
      },
      { status: 500 }
    )
  }
}

// ============================================================
// Route Handlers
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 認証チェック: Pipeline API Key → Supabase セッション (管理画面からの手動実行)
  const pipelineAuth = validatePipelineAuth(request)
  if (!pipelineAuth.authorized) {
    const adminAuth = await validateAdminAuth(request)
    if (!adminAuth.authorized) {
      return NextResponse.json(
        { error: adminAuth.error },
        { status: getAuthErrorStatus(adminAuth.error!) }
      )
    }
  }

  // リクエストボディのパース
  let body: RunPipelineRequest = {}
  try {
    const text = await request.text()
    if (text) {
      body = JSON.parse(text) as RunPipelineRequest
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const pipelineType: PipelineType = body.type ?? 'manual'
  const dryRun = body.dryRun ?? false

  return executePipeline(pipelineType, dryRun)
}

// Vercel Cron Jobs サポート (GET リクエスト)
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Cron認証チェック: PIPELINE_API_KEY or CRON_SECRET (validatePipelineAuth が両方チェック)
  const auth = validatePipelineAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    )
  }

  // クエリパラメータから type を取得
  const url = new URL(request.url)
  const typeParam = url.searchParams.get('type')
  const pipelineType: PipelineType = typeParam === 'pdca' ? 'pdca' : 'daily'

  // 自動化設定をチェック（Cron実行時のみ）
  try {
    const { getAutomationConfig } = await import('@/app/api/admin/automation-config/route')
    const automationConfig = await getAutomationConfig()

    if (pipelineType === 'daily' && !automationConfig.dailyPipeline) {
      console.log('[pipeline/run] Daily pipeline is disabled — skipping')
      return NextResponse.json({ success: true, message: 'Daily pipeline is disabled', skipped: true })
    }
    if (pipelineType === 'pdca' && !automationConfig.pdcaBatch) {
      console.log('[pipeline/run] PDCA batch is disabled — skipping')
      return NextResponse.json({ success: true, message: 'PDCA batch is disabled', skipped: true })
    }
  } catch (err) {
    // 設定取得失敗時は実行を継続（安全側に倒す）
    console.warn('[pipeline/run] Failed to check automation config, proceeding:', err)
  }

  return executePipeline(pipelineType, false)
}
