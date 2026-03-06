/**
 * /api/admin/review-queue/stats
 * GET: レビューキュー統計
 *   - pending/approved/rejected/revision の各カウント
 *   - 直近7日間の処理数
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { withRateLimit } from '@/lib/admin/rate-limit'
import type { ReviewQueueStats } from '@/types/admin'

// ============================================================
// モックデータ
// ============================================================

function getMockStats(): ReviewQueueStats {
  return {
    pending: 5,
    approved: 25,
    rejected: 3,
    revision: 2,
    total: 35,
    processedLast7Days: 12,
  }
}

// ============================================================
// GET: レビューキュー統計
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rateLimited = withRateLimit(request, 'admin:review-queue:stats')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    const status = auth.error ? getAuthErrorStatus(auth.error) : 401
    return NextResponse.json({ error: auth.error }, { status })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ stats: getMockStats() })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // ステータス別カウントを並行取得
    const statusCounts = await Promise.all(
      (['pending', 'approved', 'rejected', 'revision'] as const).map(async (s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await (supabase as any)
          .from('article_review_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', s)

        if (error) {
          const pgCode = (error as { code?: string }).code
          if (pgCode === '42P01' || error.message?.includes('does not exist')) {
            return { status: s, count: 0 }
          }
          console.error(`[admin/review-queue/stats] Count error for ${s}:`, error.message)
          return { status: s, count: 0 }
        }
        return { status: s, count: count ?? 0 }
      })
    )

    // 直近7日間の処理数 (reviewed_at が7日以内のもの)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: processedCount, error: processedError } = await (supabase as any)
      .from('article_review_queue')
      .select('*', { count: 'exact', head: true })
      .not('reviewed_at', 'is', null)
      .gte('reviewed_at', sevenDaysAgo)

    if (processedError) {
      const pgCode = (processedError as { code?: string }).code
      if (pgCode === '42P01' || processedError.message?.includes('does not exist')) {
        console.warn('[admin/review-queue/stats] Table not found, returning mock')
        return NextResponse.json({ stats: getMockStats() })
      }
      console.error('[admin/review-queue/stats] Processed count error:', processedError.message)
    }

    const countsMap: Record<string, number> = {}
    for (const { status: s, count } of statusCounts) {
      countsMap[s] = count
    }

    const stats: ReviewQueueStats = {
      pending: countsMap['pending'] ?? 0,
      approved: countsMap['approved'] ?? 0,
      rejected: countsMap['rejected'] ?? 0,
      revision: countsMap['revision'] ?? 0,
      total: Object.values(countsMap).reduce((sum, c) => sum + c, 0),
      processedLast7Days: processedCount ?? 0,
    }

    return NextResponse.json({ stats })
  } catch (err) {
    console.error('[admin/review-queue/stats] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
