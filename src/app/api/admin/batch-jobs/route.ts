/**
 * GET /api/admin/batch-jobs
 * バッチ生成ジョブ履歴の取得
 * クエリパラメータ: limit (default: 20), offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { BatchGenerationJobRow } from '@/types/database'
import type { BatchJobStatus } from '@/types/admin'

// ============================================================
// レスポンス型
// ============================================================

export interface BatchJobsResponse {
  jobs: BatchJobItem[]
  total: number
  limit: number
  offset: number
}

export interface BatchJobItem {
  id: string
  status: BatchJobStatus
  totalKeywords: number
  completedCount: number
  failedCount: number
  totalCostUsd: number
  startedAt: string
  completedAt: string | null
  createdAt: string
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const rawLimit = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit = isNaN(rawLimit) ? 20 : Math.min(Math.max(1, rawLimit), 100)
  const rawOffset = parseInt(searchParams.get('offset') ?? '0', 10)
  const offset = isNaN(rawOffset) ? 0 : Math.max(0, rawOffset)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // Supabase 未設定時は空リストを返す (フロントエンドがモックにフォールバック)
    const response: BatchJobsResponse = {
      jobs: [],
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
    const { data, error, count } = await (supabase as any)
      .from('batch_generation_jobs')
      .select('*', { count: 'exact' })
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    const jobs: BatchJobItem[] = (data ?? []).map((row: BatchGenerationJobRow) => ({
      id: row.id,
      status: row.status as BatchJobStatus,
      totalKeywords: row.total_keywords,
      completedCount: row.completed_count,
      failedCount: row.failed_count,
      totalCostUsd: row.total_cost_usd,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }))

    const response: BatchJobsResponse = {
      jobs,
      total: count ?? 0,
      limit,
      offset,
    }

    return NextResponse.json(response)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[admin/batch-jobs] Error:', errorMessage)

    return NextResponse.json(
      { error: 'Failed to fetch batch jobs', details: errorMessage },
      { status: 500 }
    )
  }
}
