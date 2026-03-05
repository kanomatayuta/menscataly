/**
 * GET /api/admin/articles/analytics
 * 記事ごとの PV・クリック・CV・収益を集計して返す
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { ArticleAnalytics } from '@/types/admin'

export async function GET(request: NextRequest) {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error?.message ?? 'Unauthorized' },
      { status: auth.error?.code === 'FORBIDDEN' ? 403 : 401 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // Supabase未接続: ゼロデータ返却
    return NextResponse.json({ analytics: [] as ArticleAnalytics[] })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // affiliate_links: article_id ごとの click_count, conversion_count, revenue 合計
    const { data: affiliateData, error: affErr } = await (supabase as any)
      .from('affiliate_links')
      .select('article_id, click_count, conversion_count, revenue')

    if (affErr) {
      console.error('[articles/analytics] affiliate_links error:', affErr)
    }

    // analytics_daily: 30日間の pageviews 合計
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const since = thirtyDaysAgo.toISOString().split('T')[0]

    const { data: dailyData, error: dailyErr } = await (supabase as any)
      .from('analytics_daily')
      .select('article_id, pageviews')
      .gte('date', since)

    if (dailyErr) {
      console.error('[articles/analytics] analytics_daily error:', dailyErr)
    }

    // 集計
    const map = new Map<string, ArticleAnalytics>()

    const ensure = (articleId: string): ArticleAnalytics => {
      let entry = map.get(articleId)
      if (!entry) {
        entry = { articleId, pageviews: 0, clicks: 0, conversions: 0, revenue: 0 }
        map.set(articleId, entry)
      }
      return entry
    }

    if (affiliateData) {
      for (const row of affiliateData) {
        if (!row.article_id) continue
        const entry = ensure(row.article_id)
        entry.clicks += row.click_count ?? 0
        entry.conversions += row.conversion_count ?? 0
        entry.revenue += row.revenue ?? 0
      }
    }

    if (dailyData) {
      for (const row of dailyData) {
        if (!row.article_id) continue
        const entry = ensure(row.article_id)
        entry.pageviews += row.pageviews ?? 0
      }
    }

    const analytics = Array.from(map.values())
    return NextResponse.json({ analytics })
  } catch (err) {
    console.error('[articles/analytics] Unexpected error:', err)
    return NextResponse.json({ analytics: [] as ArticleAnalytics[] })
  }
}
