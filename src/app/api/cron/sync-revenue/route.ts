/**
 * GET /api/cron/sync-revenue
 * Vercel Cron用: CRON_SECRET認証 → ReportSyncOrchestrator.syncDaily()
 */

import { NextResponse } from 'next/server'
import { validateCronAuth } from '@/lib/admin/auth'
import { GA4ClickProvider } from '@/lib/asp/reports/ga4-click-provider'
import { A8ReportProvider } from '@/lib/asp/reports/a8-report-provider'
import { ReportSyncOrchestrator } from '@/lib/asp/reports/sync-orchestrator'

export async function GET(request: Request) {
  if (!validateCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const orchestrator = new ReportSyncOrchestrator([
      new GA4ClickProvider(),
      new A8ReportProvider(),
    ])

    const result = await orchestrator.syncDaily()

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Cron SyncRevenue] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
