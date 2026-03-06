/**
 * GET /api/admin/articles/analytics
 * 記事ごとの PV・クリック・CV・収益を集計して返す
 *
 * Query params:
 *   articleId — 特定記事のみ取得。指定時は単一記事の集計 + アフィリエイトリンク詳細を返す
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { ArticleAnalytics, AffiliateLinkPerformance } from '@/types/admin'

/** 単一記事のアナリティクス (articleId指定時) */
interface SingleArticleAnalyticsResponse {
  pageviews: number
  affiliateClicks: number
  conversions: number
  revenue: number
  links: AffiliateLinkPerformance[]
}

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

  // articleId query param
  const articleId = request.nextUrl.searchParams.get('articleId')

  if (!supabaseUrl || !serviceRoleKey) {
    // Supabase未接続: ゼロデータ返却
    if (articleId) {
      const empty: SingleArticleAnalyticsResponse = {
        pageviews: 0,
        affiliateClicks: 0,
        conversions: 0,
        revenue: 0,
        links: [],
      }
      return NextResponse.json(empty)
    }
    return NextResponse.json({ analytics: [] as ArticleAnalytics[] })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // ── Single article mode ──
    if (articleId) {
      return await handleSingleArticle(supabase, articleId)
    }

    // ── All articles mode (既存ロジック) ──
    return await handleAllArticles(supabase)
  } catch (err) {
    console.error('[articles/analytics] Unexpected error:', err)
    if (articleId) {
      const empty: SingleArticleAnalyticsResponse = {
        pageviews: 0,
        affiliateClicks: 0,
        conversions: 0,
        revenue: 0,
        links: [],
      }
      return NextResponse.json(empty)
    }
    return NextResponse.json({ analytics: [] as ArticleAnalytics[] })
  }
}

// ------------------------------------------------------------------
// Single article analytics
// ------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSingleArticle(supabase: any, articleId: string) {
  const result: SingleArticleAnalyticsResponse = {
    pageviews: 0,
    affiliateClicks: 0,
    conversions: 0,
    revenue: 0,
    links: [],
  }

  // affiliate_links filtered by article_id
  const { data: affiliateData, error: affErr } = await supabase
    .from('affiliate_links')
    .select('asp_name, program_name, click_count, conversion_count, revenue')
    .eq('article_id', articleId)
    .order('click_count', { ascending: false })

  if (affErr) {
    console.error('[articles/analytics] affiliate_links error:', affErr)
  }

  if (affiliateData) {
    for (const row of affiliateData) {
      result.affiliateClicks += row.click_count ?? 0
      result.conversions += row.conversion_count ?? 0
      result.revenue += row.revenue ?? 0
      result.links.push({
        aspName: row.asp_name ?? '',
        programName: row.program_name ?? '',
        clickCount: row.click_count ?? 0,
        conversionCount: row.conversion_count ?? 0,
        revenue: row.revenue ?? 0,
      })
    }
  }

  // analytics_daily: 30-day PV for this article
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: dailyData, error: dailyErr } = await supabase
    .from('analytics_daily')
    .select('pageviews')
    .eq('article_id', articleId)
    .gte('date', since)

  if (dailyErr) {
    console.error('[articles/analytics] analytics_daily error:', dailyErr)
  }

  if (dailyData) {
    for (const row of dailyData) {
      result.pageviews += row.pageviews ?? 0
    }
  }

  return NextResponse.json(result)
}

// ------------------------------------------------------------------
// All articles analytics (existing behavior)
// ------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAllArticles(supabase: any) {
  // affiliate_links: article_id ごとの click_count, conversion_count, revenue 合計
  const { data: affiliateData, error: affErr } = await supabase
    .from('affiliate_links')
    .select('article_id, click_count, conversion_count, revenue')

  if (affErr) {
    console.error('[articles/analytics] affiliate_links error:', affErr)
  }

  // analytics_daily: 30日間の pageviews 合計
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: dailyData, error: dailyErr } = await supabase
    .from('analytics_daily')
    .select('article_id, pageviews')
    .gte('date', since)

  if (dailyErr) {
    console.error('[articles/analytics] analytics_daily error:', dailyErr)
  }

  // 集計
  const map = new Map<string, ArticleAnalytics>()

  const ensure = (id: string): ArticleAnalytics => {
    let entry = map.get(id)
    if (!entry) {
      entry = { articleId: id, pageviews: 0, searchClicks: 0, affiliateClicks: 0, conversions: 0, revenue: 0 }
      map.set(id, entry)
    }
    return entry
  }

  if (affiliateData) {
    for (const row of affiliateData) {
      if (!row.article_id) continue
      const entry = ensure(row.article_id)
      entry.affiliateClicks += row.click_count ?? 0
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
}
