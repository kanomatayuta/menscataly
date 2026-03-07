/**
 * GET /api/pipeline/status
 * 最新のパイプライン実行状況を取得する
 * Pipeline API Key または Admin Session (Cookie) で認証
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePipelineAuth, validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import type { PipelineStatusResponse } from '@/lib/pipeline/types'
import type { PipelineRunRow } from '@/types/database'

let cleanupDone = false

export async function GET(request: NextRequest): Promise<NextResponse> {
  // サーバーリロード後の孤立 running レコードを1回だけクリーンアップ
  if (!cleanupDone) {
    try {
      const { cleanupOrphanedPipelines } = await import('@/lib/pipeline/executor')
      await cleanupOrphanedPipelines()
    } catch (err) {
      console.error('[pipeline/status] Orphaned pipeline cleanup error:', err)
    }
    cleanupDone = true
  }
  // Pipeline API Key → Admin Session のフォールバック認証
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      runs: [],
      stats: { totalArticles: 0, totalPipelineRuns: 0, successRate: 0, avgComplianceScore: 0 },
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // 直近10件の実行履歴 + 記事数を並列取得
    const [runsResult, articlesResult] = await Promise.allSettled([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('pipeline_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('articles')
        .select('id, compliance_score', { count: 'exact' }),
    ])

    const runs: PipelineRunRow[] = runsResult.status === 'fulfilled' ? (runsResult.value.data ?? []) : []
    const articles = articlesResult.status === 'fulfilled' ? articlesResult.value : { data: [], count: 0 }

    // Stats calculation
    const totalArticles = articles.count ?? (articles.data?.length ?? 0)
    const totalRuns = runs.length
    const successRuns = runs.filter((r) => r.status === 'success').length
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scores = (articles.data ?? []).map((a: any) => a.compliance_score).filter((s: unknown): s is number => typeof s === 'number' && s > 0)
    const avgComplianceScore = scores.length > 0 ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0

    // Also return legacy single-run format for backwards compatibility
    const latestRun = runs[0]
    const legacy: PipelineStatusResponse = latestRun ? {
      runId: latestRun.id,
      type: latestRun.type as PipelineStatusResponse['type'],
      status: latestRun.status as PipelineStatusResponse['status'],
      startedAt: latestRun.started_at,
      completedAt: latestRun.completed_at,
      durationMs: latestRun.completed_at
        ? new Date(latestRun.completed_at).getTime() - new Date(latestRun.started_at).getTime()
        : null,
      stepLogs: latestRun.steps_json as unknown as PipelineStatusResponse['stepLogs'],
      error: latestRun.error,
    } : {
      runId: null, type: null, status: 'idle', startedAt: null,
      completedAt: null, durationMs: null, stepLogs: [], error: null,
    }

    return NextResponse.json({
      ...legacy,
      runs,
      stats: { totalArticles, totalPipelineRuns: totalRuns, successRate, avgComplianceScore },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[pipeline/status] Error:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline status', details: 'Internal server error' },
      { status: 500 }
    )
  }
}
