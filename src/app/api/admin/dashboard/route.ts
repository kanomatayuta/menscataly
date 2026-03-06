/**
 * GET /api/admin/dashboard
 * 管理画面ダッシュボードデータ取得
 *
 * Phase 3b: fetchDashboardData を共通 lib 関数から呼び出す
 * API route は外部クライアント (CLI / cron) 向けに残す
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { fetchDashboardData } from '@/lib/admin/dashboard-data'

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  try {
    const dashboard = await fetchDashboardData()
    return NextResponse.json({ data: dashboard, source: 'live' as const })
  } catch (err) {
    console.error('[admin/dashboard] Error:', err)
    // エラー時はモックにフォールバック
    const { getMockDashboardData } = await import('@/lib/admin/dashboard-data')
    return NextResponse.json({
      data: getMockDashboardData(),
      source: 'mock' as const,
      reason: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
