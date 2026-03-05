/**
 * GET /api/batch/status/[jobId]
 * バッチ生成ジョブの進捗取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { getBatchProgress } from '@/lib/batch/generator'

// ============================================================
// Route Handler
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  // 認証チェック
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: 401 }
    )
  }

  const { jobId } = await params

  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId parameter is required' },
      { status: 400 }
    )
  }

  const progress = getBatchProgress(jobId)

  if (!progress) {
    return NextResponse.json(
      { error: `Job ${jobId} not found` },
      { status: 404 }
    )
  }

  return NextResponse.json(progress)
}
