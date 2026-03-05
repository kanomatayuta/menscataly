/**
 * GET /api/admin/analytics/trends
 * BigQuery or Supabase からトレンドデータを取得
 *
 * Query params:
 *   range: '7d' | '30d' | '90d' (default: '30d')
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { queryArticleMetrics } from '@/lib/analytics/bigquery-client'
import type { DateRange } from '@/lib/analytics/types'

function getDateRange(rangeParam: string): DateRange {
  const days = rangeParam === '7d' ? 7 : rangeParam === '90d' ? 90 : 30
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error?.message ?? 'Unauthorized' },
      { status: auth.error?.code === 'FORBIDDEN' ? 403 : 401 }
    )
  }

  try {
    const rangeParam = request.nextUrl.searchParams.get('range') ?? '30d'
    const range = getDateRange(rangeParam)

    const metrics = await queryArticleMetrics(range)

    // BigQuery 未設定時は空配列が返る
    if (metrics.length === 0) {
      return NextResponse.json({
        data: [],
        range,
        source: 'none',
        message: 'BigQuery not configured or no data available',
      })
    }

    return NextResponse.json({
      data: metrics,
      range,
      source: 'bigquery',
    })
  } catch (err) {
    console.error('[admin/analytics/trends] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch trend data' },
      { status: 500 }
    )
  }
}
