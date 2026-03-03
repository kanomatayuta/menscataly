/**
 * GET /api/pipeline/status
 * 最新のパイプライン実行状況を取得する
 */

import { NextRequest, NextResponse } from 'next/server'
import type { PipelineStatusResponse } from '@/lib/pipeline/types'

// ============================================================
// 認証ヘルパー
// ============================================================

function authenticateRequest(request: NextRequest): boolean {
  const apiKey = process.env.PIPELINE_API_KEY
  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    return false
  }

  const providedKey = request.headers.get('X-Pipeline-Api-Key')
  return providedKey === apiKey
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!authenticateRequest(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing X-Pipeline-Api-Key' },
      { status: 401 }
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

    // 最新の実行レコードを取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

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

    const run = data as {
      id: string
      type: string
      status: string
      started_at: string
      completed_at: string | null
      steps_json: unknown[]
      error: string | null
    }

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
      stepLogs: run.steps_json as PipelineStatusResponse['stepLogs'],
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
