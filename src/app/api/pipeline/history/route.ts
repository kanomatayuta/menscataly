/**
 * GET /api/pipeline/history
 * パイプライン実行履歴を取得する
 * クエリパラメータ: limit (default: 20), offset (default: 0), type
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePipelineAuth, validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import type { PipelineHistoryResponse, PipelineType } from '@/lib/pipeline/types'

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  // クエリパラメータのパース
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const typeFilter = searchParams.get('type') as PipelineType | null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // Supabase 未設定時は空リストを返す
    const response: PipelineHistoryResponse = {
      runs: [],
      total: 0,
      limit,
      offset,
    }
    return NextResponse.json(response)
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('pipeline_runs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // type フィルタ
    if (typeFilter) {
      query = query.eq('type', typeFilter)
    }

    const { data, error, count } = await query

    if (error) {
      throw error
    }

    const response: PipelineHistoryResponse = {
      runs: (data ?? []) as PipelineHistoryResponse['runs'],
      total: count ?? 0,
      limit,
      offset,
    }

    return NextResponse.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[pipeline/history] Error:', errorMessage)

    return NextResponse.json(
      { error: 'Failed to fetch pipeline history', details: errorMessage },
      { status: 500 }
    )
  }
}
