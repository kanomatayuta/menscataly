/**
 * GET /api/pipeline/status
 * 最新のパイプライン実行状況を取得する
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePipelineAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import type { PipelineStatusResponse } from '@/lib/pipeline/types'
import type { PipelineRunRow } from '@/types/database'

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validatePipelineAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // Supabase 未設定時はデフォルトレスポンスを返す
    const response: PipelineStatusResponse = {
      runId: null,
      type: null,
      status: 'idle',
      startedAt: null,
      completedAt: null,
      durationMs: null,
      stepLogs: [],
      error: null,
    }
    return NextResponse.json(response)
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single() as { data: PipelineRunRow | null; error: { code: string; message: string } | null }

    if (error) {
      if (error.code === 'PGRST116') {
        // レコードなし
        const response: PipelineStatusResponse = {
          runId: null,
          type: null,
          status: 'idle',
          startedAt: null,
          completedAt: null,
          durationMs: null,
          stepLogs: [],
          error: null,
        }
        return NextResponse.json(response)
      }
      throw error
    }

    const run = data!

    const durationMs =
      run.completed_at
        ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
        : null

    const response: PipelineStatusResponse = {
      runId: run.id,
      type: run.type as PipelineStatusResponse['type'],
      status: run.status as PipelineStatusResponse['status'],
      startedAt: run.started_at,
      completedAt: run.completed_at,
      durationMs,
      stepLogs: run.steps_json as unknown as PipelineStatusResponse['stepLogs'],
      error: run.error,
    }

    return NextResponse.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[pipeline/status] Error:', errorMessage)

    return NextResponse.json(
      { error: 'Failed to fetch pipeline status', details: errorMessage },
      { status: 500 }
    )
  }
}
