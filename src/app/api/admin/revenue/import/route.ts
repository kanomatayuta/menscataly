/**
 * POST /api/admin/revenue/import
 * CSVアップロードAPI: FormData から CSV ファイル + asp_name を受取 → パース → upsert
 */

import { NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { A8ReportProvider } from '@/lib/asp/reports/a8-report-provider'
import { ReportSyncOrchestrator } from '@/lib/asp/reports/sync-orchestrator'

export async function POST(request: Request) {
  // 認証
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error?.message ?? 'Unauthorized' },
      { status: auth.error ? getAuthErrorStatus(auth.error) : 401 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const aspName = formData.get('asp_name') as string | null

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing file in form data' },
        { status: 400 }
      )
    }

    if (!aspName) {
      return NextResponse.json(
        { error: 'Missing asp_name in form data' },
        { status: 400 }
      )
    }

    const csvContent = await file.text()

    // ASP別パース
    let records
    switch (aspName) {
      case 'a8': {
        const provider = new A8ReportProvider()
        records = provider.importFromCSV(csvContent)
        break
      }
      default:
        return NextResponse.json(
          { error: `Unsupported ASP: ${aspName}. Currently only 'a8' CSV import is supported.` },
          { status: 400 }
        )
    }

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No records found in CSV' },
        { status: 400 }
      )
    }

    // Orchestrator で upsert
    const orchestrator = new ReportSyncOrchestrator([])
    const enriched = await orchestrator.enrichWithArticleSlug(records)
    const count = await orchestrator.upsertToRevenueDailyTable(enriched)

    return NextResponse.json({
      imported: count,
      aspName,
      records: records.length,
    })
  } catch (error) {
    console.error('[Revenue Import] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
