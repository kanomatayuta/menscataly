/**
 * POST /api/pipeline/run
 * パイプライン手動実行トリガー
 * Authorization: Bearer <key> or X-Pipeline-Api-Key ヘッダーによる認証
 *
 * GET /api/pipeline/run?type=daily|pdca
 * Vercel Cron Jobs 自動実行用エンドポイント
 * Authorization: Bearer <CRON_SECRET> ヘッダーによる認証
 */

import { NextRequest, NextResponse, after } from 'next/server'
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
  maxArticles?: number
  enabledCategories?: string[]
}

// ============================================================
// 共通パイプライン実行ロジック
// ============================================================

async function executePipeline(
  pipelineType: PipelineType,
  dryRun: boolean,
  initialSharedData?: Record<string, unknown>
): Promise<NextResponse> {
  // パイプライン設定を取得
  const config = getPipelineConfig(pipelineType)
  if (dryRun) {
    config.dryRun = true
  }

  console.log(`[pipeline/run] Starting pipeline: type=${pipelineType}, dryRun=${dryRun}`)

  // 二重実行防止: 既に実行中のパイプラインがあれば 409 を返す
  const { getRunningPipelineIds } = await import('@/lib/pipeline/executor')
  const runningIds = getRunningPipelineIds()
  if (runningIds.length > 0) {
    return NextResponse.json(
      { success: false, error: 'パイプラインが既に実行中です', runningIds },
      { status: 409 }
    )
  }

  // DB-based lock check
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()
    const { data: runningInDb } = await (supabase as any)
      .from('pipeline_runs')
      .select('id')
      .eq('status', 'running')
      .limit(1)
    if (runningInDb && runningInDb.length > 0) {
      return NextResponse.json(
        { success: false, error: 'パイプラインが既に実行中です（DB）', runningIds: runningInDb.map((r: {id: string}) => r.id) },
        { status: 409 }
      )
    }
  } catch (e) {
    console.warn('[pipeline/run] DB lock check failed, continuing with memory check:', e)
  }

  try {
    // ステップを取得
    const steps = pipelineType === 'pdca'
      ? await getPDCAPipelineSteps()
      : await getDailyPipelineSteps()

    // パイプラインを非同期で実行（レスポンスは即時返却）
    const executor = new PipelineExecutor(config)
    const runId = `pipeline-${Date.now()}`

    // Next.js after() でレスポンス返却後もバックグラウンド実行を保証
    after(async () => {
      try {
        await executor.run(steps, initialSharedData)
        console.log(`[pipeline/run] Pipeline "${pipelineType}" completed (runId=${runId})`)
      } catch (err) {
        console.error(`[pipeline/run] Pipeline "${pipelineType}" failed (runId=${runId}):`, err)
      }
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
      const errorStatus = adminAuth.error ? getAuthErrorStatus(adminAuth.error) : 401
      return NextResponse.json(
        { error: adminAuth.error ?? { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: errorStatus }
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
  const maxArticles = body.maxArticles

  const initialSharedData: Record<string, unknown> = {}
  if (maxArticles && maxArticles >= 1 && maxArticles <= 10) {
    initialSharedData['maxArticles'] = maxArticles
  }
  if (body.enabledCategories && Array.isArray(body.enabledCategories) && body.enabledCategories.length > 0) {
    initialSharedData['enabledCategories'] = body.enabledCategories
  }

  return executePipeline(pipelineType, dryRun, initialSharedData)
}

// Vercel Cron Jobs サポート (GET リクエスト)
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Cron認証チェック: PIPELINE_API_KEY or CRON_SECRET (validatePipelineAuth が両方チェック)
  const auth = validatePipelineAuth(request)
  if (!auth.authorized) {
    const errorStatus = auth.error ? getAuthErrorStatus(auth.error) : 401
    return NextResponse.json(
      { error: auth.error ?? { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
      { status: errorStatus }
    )
  }

  // クエリパラメータから type を取得
  const url = new URL(request.url)
  const typeParam = url.searchParams.get('type')
  const pipelineType: PipelineType = typeParam === 'pdca' ? 'pdca' : 'daily'

  // 自動化設定をチェック（Cron実行時のみ）
  // マスタースイッチ（両方ON）がOFFなら全Cronをスキップ
  try {
    const { getAutomationConfig } = await import('@/app/api/admin/automation-config/route')
    const automationConfig = await getAutomationConfig()

    // マスタースイッチ: 両方ONでなければ自動実行しない
    const isAutoEnabled = automationConfig.dailyPipeline && automationConfig.pdcaBatch
    if (!isAutoEnabled) {
      console.log(`[pipeline/run] Auto mode is OFF (daily=${automationConfig.dailyPipeline}, pdca=${automationConfig.pdcaBatch}) — skipping Cron`)
      return NextResponse.json({ success: true, message: 'Auto mode is disabled', skipped: true })
    }

    if (pipelineType === 'daily' && !automationConfig.dailyPipeline) {
      console.log('[pipeline/run] Daily pipeline is disabled — skipping')
      return NextResponse.json({ success: true, message: 'Daily pipeline is disabled', skipped: true })
    }
    if (pipelineType === 'pdca' && !automationConfig.pdcaBatch) {
      console.log('[pipeline/run] PDCA batch is disabled — skipping')
      return NextResponse.json({ success: true, message: 'PDCA batch is disabled', skipped: true })
    }
  } catch (err) {
    // 設定取得失敗時はスキップ（安全側に倒す — 意図しない実行を防止）
    console.warn('[pipeline/run] Failed to check automation config, skipping:', err)
    return NextResponse.json({ success: true, message: 'Config unavailable — skipped for safety', skipped: true })
  }

  return executePipeline(pipelineType, false)
}
