/**
 * POST /api/pipeline/stop
 * 実行中のパイプラインを停止する
 * Pipeline API Key または Admin Session (Cookie) で認証
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePipelineAuth, validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  try {
    const { abortAllPipelines, getRunningPipelineIds } = await import('@/lib/pipeline/executor')
    const runningIds = getRunningPipelineIds()
    const aborted = abortAllPipelines()

    return NextResponse.json({
      success: true,
      message: aborted > 0 ? `${aborted}件のパイプラインを停止しました` : '実行中のパイプラインはありません',
      abortedCount: aborted,
      abortedIds: runningIds,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[pipeline/stop] Error:', errorMessage)
    return NextResponse.json(
      { error: 'Failed to stop pipeline', details: errorMessage },
      { status: 500 }
    )
  }
}
