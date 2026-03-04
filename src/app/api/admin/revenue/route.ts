/**
 * GET /api/admin/revenue
 * ASP別収益サマリー取得
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
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate =
    searchParams.get('startDate') ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const endDate = searchParams.get('endDate') ?? new Date().toISOString()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      revenue: getMockRevenueSummary(),
      period: { startDate, endDate },
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // asp_programs テーブルからASP別集計を取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('asp_programs')
      .select('*')
      .eq('is_active', true)

    if (error) {
      console.error('[admin/revenue] Query error:', error.message)
      return NextResponse.json({
        revenue: getMockRevenueSummary(),
        period: { startDate, endDate },
      })
    }

    // ASP名でグループ化
    const aspGroups = new Map<string, typeof data>()
    for (const program of data ?? []) {
      const aspName = program.asp_name as string
      if (!aspGroups.has(aspName)) {
        aspGroups.set(aspName, [])
      }
      aspGroups.get(aspName)!.push(program)
    }

    const revenue: RevenueSummary[] = Array.from(aspGroups.entries()).map(
      ([aspName]) => ({
        aspName,
        totalClicks: 0,
        totalConversions: 0,
        totalRevenue: 0,
        conversionRate: 0,
        monthlyConversions: 0,
        monthlyRevenueJpy: 0,
        monthOverMonthChange: 0,
        topArticles: [],
      })
    )

    return NextResponse.json({ revenue, period: { startDate, endDate } })
  } catch (err) {
    console.error('[admin/revenue] Error:', err)
    return NextResponse.json({
      revenue: getMockRevenueSummary(),
      period: { startDate, endDate },
    })
  }
}
