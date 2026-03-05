/**
 * GET /api/admin/analytics/overview
 * Supabase analytics_daily から直近サマリーを取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'

interface OverviewData {
  totalPageviews: number
  totalUniqueUsers: number
  avgBounceRate: number
  avgCtr: number
  topArticles: Array<{
    articleId: string
    pageviews: number
    uniqueUsers: number
  }>
  period: { startDate: string; endDate: string }
}

function getMockOverviewData(): OverviewData {
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  return {
    totalPageviews: 0,
    totalUniqueUsers: 0,
    avgBounceRate: 0,
    avgCtr: 0,
    topArticles: [],
    period: { startDate, endDate },
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({
      data: getMockOverviewData(),
      source: 'mock',
    })
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('analytics_daily')
      .select('article_id, pageviews, unique_users, bounce_rate, ctr')
      .gte('date', startDate)
      .lte('date', endDate)

    if (error || !data || data.length === 0) {
      return NextResponse.json({
        data: getMockOverviewData(),
        source: error ? 'error' : 'empty',
      })
    }

    const totalPageviews = data.reduce(
      (sum: number, r: Record<string, unknown>) => sum + (Number(r.pageviews) || 0),
      0
    )
    const totalUniqueUsers = data.reduce(
      (sum: number, r: Record<string, unknown>) => sum + (Number(r.unique_users) || 0),
      0
    )
    const avgBounceRate =
      data.reduce(
        (sum: number, r: Record<string, unknown>) => sum + (Number(r.bounce_rate) || 0),
        0
      ) / data.length
    const avgCtr =
      data.reduce(
        (sum: number, r: Record<string, unknown>) => sum + (Number(r.ctr) || 0),
        0
      ) / data.length

    // 記事別集計 (上位10件)
    const articleMap = new Map<string, { pageviews: number; uniqueUsers: number }>()
    for (const row of data as Array<Record<string, unknown>>) {
      const id = String(row.article_id)
      const existing = articleMap.get(id) ?? { pageviews: 0, uniqueUsers: 0 }
      existing.pageviews += Number(row.pageviews) || 0
      existing.uniqueUsers += Number(row.unique_users) || 0
      articleMap.set(id, existing)
    }

    const topArticles = Array.from(articleMap.entries())
      .map(([articleId, stats]) => ({
        articleId,
        pageviews: stats.pageviews,
        uniqueUsers: stats.uniqueUsers,
      }))
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10)

    const overview: OverviewData = {
      totalPageviews,
      totalUniqueUsers,
      avgBounceRate,
      avgCtr,
      topArticles,
      period: { startDate, endDate },
    }

    return NextResponse.json({ data: overview, source: 'supabase' })
  } catch (err) {
    console.error('[admin/analytics/overview] Error:', err)
    return NextResponse.json({
      data: getMockOverviewData(),
      source: 'error',
    })
  }
}
