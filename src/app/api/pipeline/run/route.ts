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

  // 二重実行防止: メモリチェック (高速パス)
  const { getRunningPipelineIds } = await import('@/lib/pipeline/executor')
  const runningIds = getRunningPipelineIds()
  if (runningIds.length > 0) {
    return NextResponse.json(
      { success: false, error: 'パイプラインが既に実行中です', runningIds },
      { status: 409 }
    )
  }

  // DB-based atomic lock: INSERT ... ON CONFLICT で排他制御 (TOCTOU レース防止)
  const runId = `pipeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // まず既存の running レコードを確認 (SELECT FOR UPDATE 相当)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // 排他的INSERT: 同じ runId で INSERT し、成功すればロック取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any)
      .from('pipeline_runs')
      .insert({
        id: runId,
        type: pipelineType,
        status: 'running',
        started_at: new Date().toISOString(),
      })

    if (insertError) {
      console.warn('[pipeline/run] DB lock insert failed:', insertError.message)
      // INSERT失敗 = 別プロセスが先にロック取得した可能性
      return NextResponse.json(
        { success: false, error: 'パイプラインのロック取得に失敗しました' },
        { status: 409 }
      )
    }
  } catch (e) {
    console.warn('[pipeline/run] DB lock check failed, continuing with memory check only:', e)
  }

  try {
    // ステップを取得
    const steps = pipelineType === 'pdca'
      ? await getPDCAPipelineSteps()
      : await getDailyPipelineSteps()

    // パイプラインを非同期で実行（レスポンスは即時返却）
    const executor = new PipelineExecutor(config)

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

/**
 * Vercel Cron Jobs サポート (GET リクエスト)
 *
 * 多層防御 (Fail-safe Design):
 *   Layer 1: 環境変数 ENABLE_CRON_JOBS === 'true' が明示的に設定されていなければスキップ
 *   Layer 2: getAutomationConfig() で DB 上の設定を取得（失敗時はスキップ）
 *   Layer 3: 設定値の厳密な型チェック (=== true のみ許可、truthy 値を拒否)
 *
 * 原則: 疑わしきは停止。設定が読めない、DB が落ちている、テーブルがない、値が不正 → 全て自動実行をスキップ。
 *
 * 環境変数:
 *   ENABLE_CRON_JOBS - "true" を明示的に設定した場合のみ Cron 自動実行を許可。
 *                      未設定・空文字・"1"・"yes" 等では動作しない (Fail-safe)。
 *                      Vercel 本番環境でのみ設定すること。
 */
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

  // ================================================================
  // Layer 1: 環境変数チェック
  // ENABLE_CRON_JOBS=true が明示的に設定されていなければスキップ。
  // "1", "yes", "TRUE" 等の truthy 値は許可しない（厳密一致のみ）。
  // ================================================================
  const cronEnabled = process.env.ENABLE_CRON_JOBS === 'true'
  if (!cronEnabled) {
    console.log(`[pipeline/run] ENABLE_CRON_JOBS is not "true" (value=${JSON.stringify(process.env.ENABLE_CRON_JOBS)}) — skipping Cron`)
    return NextResponse.json({
      success: true,
      message: 'ENABLE_CRON_JOBS is not enabled — Cron execution skipped',
      skipped: true,
    })
  }

  // クエリパラメータから type を取得
  const url = new URL(request.url)
  const typeParam = url.searchParams.get('type')
  const pipelineType: PipelineType = typeParam === 'pdca' ? 'pdca' : 'daily'

  // ================================================================
  // Layer 2: DB 設定チェック (getAutomationConfig)
  // try-catch で囲み、失敗時は安全側に倒してスキップ。
  // ================================================================
  let automationConfig: Awaited<ReturnType<typeof import('@/app/api/admin/automation-config/route').getAutomationConfig>> | null = null
  try {
    const { getAutomationConfig } = await import('@/app/api/admin/automation-config/route')
    automationConfig = await getAutomationConfig()
  } catch (err) {
    // 設定取得失敗時はスキップ（安全側に倒す — 意図しない実行を防止）
    console.warn('[pipeline/run] Failed to fetch automation config, skipping for safety:', err)
    return NextResponse.json({
      success: true,
      message: 'Config unavailable — skipped for safety',
      skipped: true,
    })
  }

  // automationConfig が null や undefined の場合もスキップ
  if (!automationConfig) {
    console.warn('[pipeline/run] automationConfig is null/undefined — skipping for safety')
    return NextResponse.json({
      success: true,
      message: 'Config unavailable — skipped for safety',
      skipped: true,
    })
  }

  // ================================================================
  // Layer 3: 設定値の厳密な型チェック
  // === true のみ許可。truthy 値 ("true", 1, "1" 等) は拒否。
  // ================================================================
  if (pipelineType === 'daily') {
    if (automationConfig.dailyPipeline !== true) {
      console.log(`[pipeline/run] dailyPipeline is not true (value=${JSON.stringify(automationConfig.dailyPipeline)}, type=${typeof automationConfig.dailyPipeline}) — skipping`)
      return NextResponse.json({
        success: true,
        message: 'Daily pipeline is disabled',
        skipped: true,
      })
    }
  } else if (pipelineType === 'pdca') {
    if (automationConfig.pdcaBatch !== true) {
      console.log(`[pipeline/run] pdcaBatch is not true (value=${JSON.stringify(automationConfig.pdcaBatch)}, type=${typeof automationConfig.pdcaBatch}) — skipping`)
      return NextResponse.json({
        success: true,
        message: 'PDCA batch is disabled',
        skipped: true,
      })
    }
  }

  return executePipeline(pipelineType, false)
}
