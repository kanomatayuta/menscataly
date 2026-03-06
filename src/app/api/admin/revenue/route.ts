/**
 * GET /api/admin/revenue
 * ASP別収益サマリー取得
 *
 * 1. revenue_daily テーブルから期間内の実データを取得
 * 2. データがなければ asp_programs から ASP 名一覧をゼロデータとして返す
 * 3. Supabase 未設定 or エラー時はモックにフォールバック（source: 'mock'）
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { RevenueSummary } from '@/types/admin'

// ============================================================
// モックデータ
// ============================================================

function getMockRevenueSummary(): RevenueSummary[] {
  return [
    {
      aspName: 'afb',
      totalClicks: 1250,
      totalConversions: 8,
      totalRevenue: 92500,
      conversionRate: 0.64,
      monthlyConversions: 8,
      monthlyRevenueJpy: 92500,
      monthOverMonthChange: 15.2,
      topArticles: [
        { slug: 'aga-treatment-cost-guide', title: 'AGA治療の費用相場と選び方ガイド', conversions: 5 },
      ],
    },
    {
      aspName: 'a8',
      totalClicks: 890,
      totalConversions: 5,
      totalRevenue: 43000,
      conversionRate: 0.56,
      monthlyConversions: 5,
      monthlyRevenueJpy: 43000,
      monthOverMonthChange: 8.3,
      topArticles: [
        { slug: 'mens-hair-removal-comparison', title: 'メンズ医療脱毛おすすめクリニック比較', conversions: 3 },
      ],
    },
    {
      aspName: 'accesstrade',
      totalClicks: 670,
      totalConversions: 3,
      totalRevenue: 36000,
      conversionRate: 0.45,
      monthlyConversions: 3,
      monthlyRevenueJpy: 36000,
      monthOverMonthChange: -2.1,
      topArticles: [],
    },
    {
      aspName: 'valuecommerce',
      totalClicks: 420,
      totalConversions: 2,
      totalRevenue: 22000,
      conversionRate: 0.48,
      monthlyConversions: 2,
      monthlyRevenueJpy: 22000,
      monthOverMonthChange: 5.0,
      topArticles: [],
    },
    {
      aspName: 'felmat',
      totalClicks: 310,
      totalConversions: 2,
      totalRevenue: 45000,
      conversionRate: 0.65,
      monthlyConversions: 2,
      monthlyRevenueJpy: 45000,
      monthOverMonthChange: 22.0,
      topArticles: [],
    },
  ]
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const endDate = searchParams.get('endDate') ?? new Date().toISOString().split('T')[0]
  const startDate =
    searchParams.get('startDate') ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      revenue: getMockRevenueSummary(),
      period: { startDate, endDate },
      source: 'mock' as const,
      reason: 'Supabase credentials not configured',
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // revenue_daily テーブルから期間内データを取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: revenueRows, error: revenueError } = await (supabase as any)
      .from('revenue_daily')
      .select('asp_name, clicks, conversions_confirmed, conversions_pending, revenue_confirmed, revenue_pending, article_slug')
      .gte('date', startDate)
      .lte('date', endDate)

    if (revenueError) {
      console.error('[admin/revenue] revenue_daily query error:', revenueError.message)
      // revenue_daily テーブルが存在しない場合も含めてフォールバック
      return NextResponse.json({
        revenue: getMockRevenueSummary(),
        period: { startDate, endDate },
        source: 'mock' as const,
        reason: `revenue_daily query error: ${revenueError.message}`,
      })
    }

    // revenue_daily にデータがある場合 → 実データから集計
    if (revenueRows && revenueRows.length > 0) {
      const aspMap = new Map<
        string,
        {
          clicks: number
          conversions: number
          revenue: number
          articleConversions: Map<string, number>
        }
      >()

      for (const row of revenueRows) {
        const aspName = row.asp_name as string
        if (!aspMap.has(aspName)) {
          aspMap.set(aspName, { clicks: 0, conversions: 0, revenue: 0, articleConversions: new Map() })
        }
        const entry = aspMap.get(aspName)!
        entry.clicks += Number(row.clicks) || 0
        entry.conversions += (Number(row.conversions_confirmed) || 0) + (Number(row.conversions_pending) || 0)
        entry.revenue += (Number(row.revenue_confirmed) || 0) + (Number(row.revenue_pending) || 0)

        if (row.article_slug) {
          const slug = row.article_slug as string
          entry.articleConversions.set(
            slug,
            (entry.articleConversions.get(slug) ?? 0) + (Number(row.conversions_confirmed) || 0)
          )
        }
      }

      // 前月データ取得 (monthOverMonthChange 計算用)
      const prevEndDate = new Date(startDate)
      prevEndDate.setDate(prevEndDate.getDate() - 1)
      const prevStartDate = new Date(prevEndDate)
      prevStartDate.setDate(prevStartDate.getDate() - 30)
      const prevStartStr = prevStartDate.toISOString().split('T')[0]
      const prevEndStr = prevEndDate.toISOString().split('T')[0]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prevRows } = await (supabase as any)
        .from('revenue_daily')
        .select('asp_name, revenue_confirmed, revenue_pending')
        .gte('date', prevStartStr)
        .lte('date', prevEndStr)

      const prevRevenueByAsp = new Map<string, number>()
      if (prevRows) {
        for (const row of prevRows) {
          const aspName = row.asp_name as string
          prevRevenueByAsp.set(
            aspName,
            (prevRevenueByAsp.get(aspName) ?? 0) + (Number(row.revenue_confirmed) || 0) + (Number(row.revenue_pending) || 0)
          )
        }
      }

      const revenue: RevenueSummary[] = Array.from(aspMap.entries()).map(([aspName, agg]) => {
        const cvr = agg.clicks > 0 ? (agg.conversions / agg.clicks) * 100 : 0
        const prevRev = prevRevenueByAsp.get(aspName) ?? 0
        const momChange = prevRev > 0 ? ((agg.revenue - prevRev) / prevRev) * 100 : 0

        const topArticles = Array.from(agg.articleConversions.entries())
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([slug, conversions]) => ({
            slug,
            title: slug, // slug をフォールバック表示名として使用
            conversions,
          }))

        return {
          aspName,
          totalClicks: agg.clicks,
          totalConversions: agg.conversions,
          totalRevenue: Math.round(agg.revenue),
          conversionRate: Math.round(cvr * 100) / 100,
          monthlyConversions: agg.conversions,
          monthlyRevenueJpy: Math.round(agg.revenue),
          monthOverMonthChange: Math.round(momChange * 10) / 10,
          topArticles,
        }
      })

      revenue.sort((a, b) => b.totalRevenue - a.totalRevenue)

      return NextResponse.json({
        revenue,
        period: { startDate, endDate },
        source: 'live' as const,
      })
    }

    // revenue_daily にデータがない場合 → asp_programs からASP名一覧をゼロデータとして返す
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: programs, error: progError } = await (supabase as any)
      .from('asp_programs')
      .select('asp_name')
      .eq('is_active', true)

    if (progError || !programs || programs.length === 0) {
      return NextResponse.json({
        revenue: [],
        period: { startDate, endDate },
        source: 'empty' as const,
        reason: 'No revenue data or ASP programs found',
      })
    }

    const aspNames = Array.from(
      new Set(programs.map((p: { asp_name: string }) => p.asp_name as string))
    ) as string[]

    const revenue: RevenueSummary[] = aspNames.map((aspName) => ({
      aspName,
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      conversionRate: 0,
      monthlyConversions: 0,
      monthlyRevenueJpy: 0,
      monthOverMonthChange: 0,
      topArticles: [],
    }))

    return NextResponse.json({
      revenue,
      period: { startDate, endDate },
      source: 'empty' as const,
      reason: 'No revenue_daily data yet; showing ASP list with zero values',
    })
  } catch (err) {
    console.error('[admin/revenue] Error:', err)
    return NextResponse.json({
      revenue: getMockRevenueSummary(),
      period: { startDate, endDate },
      source: 'mock' as const,
      reason: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
