/**
 * GET /api/admin/costs
 * コストサマリー取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { CostTracker } from '@/lib/batch/cost-tracker'

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate =
    searchParams.get('startDate') ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = searchParams.get('endDate') ?? new Date().toISOString()

  try {
    const tracker = new CostTracker()
    const summary = await tracker.getCostSummary(startDate, endDate)
    const threshold = await tracker.checkThreshold()

    return NextResponse.json({
      summary,
      threshold: {
        exceeded: threshold.exceeded,
        currentCost: threshold.currentCost,
        limit: threshold.threshold,
      },
    })
  } catch (err) {
    console.error('[admin/costs] Error:', err)
    return NextResponse.json(
      { error: 'Failed to retrieve cost summary' },
      { status: 500 }
    )
  }
}
