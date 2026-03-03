/**
 * POST /api/pipeline/run
 * パイプライン手動実行トリガー
 * X-Pipeline-Api-Key ヘッダーによる認証
 */

import { NextRequest, NextResponse } from 'next/server'
import { PipelineExecutor, getDailyPipelineSteps, getPDCAPipelineSteps } from '@/lib/pipeline/executor'
import { getPipelineConfig } from '@/lib/pipeline/scheduler'
import type { PipelineType, PipelineRunResponse } from '@/lib/pipeline/types'

// ============================================================
// 認証ヘルパー
// ============================================================

function authenticateRequest(request: NextRequest): boolean {
  const apiKey = process.env.PIPELINE_API_KEY
  if (!apiKey) {
    // 環境変数未設定時は開発環境として認証スキップ
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    console.error('[pipeline/run] PIPELINE_API_KEY is not configured')
    return false
  }

  const providedKey = request.headers.get('X-Pipeline-Api-Key')
  return providedKey === apiKey
}

// ============================================================
// リクエスト型
// ============================================================

interface RunPipelineRequest {
  type?: PipelineType
  dryRun?: boolean
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 認証チェック
  if (!authenticateRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing X-Pipeline-Api-Key' },
      { status: 401 }
    )
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

// Vercel Cron Jobs サポート (GET リクエスト)
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Vercel Cron は GET で呼び出されることがある
  return POST(request)
}
