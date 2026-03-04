/**
 * GET /api/admin/dashboard
 * 管理画面ダッシュボードデータ取得
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { AdminDashboardData } from '@/types/admin'

// ============================================================
// モックダッシュボードデータ
// ============================================================

function getMockDashboardData(): AdminDashboardData {
  return {
    pipeline: {
      status: 'idle',
      lastRunAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      lastRunSuccess: true,
      totalRuns: 42,
    },
    articles: {
      total: 24,
      published: 18,
      draft: 4,
      pendingReview: 2,
      avgComplianceScore: 96.3,
    },
    revenue: {
      monthlyTotalJpy: 127500,
      monthOverMonthChange: 12.5,
      byAsp: [],
    },
    alerts: [],
    costs: {
      monthlyTotalUsd: 12.45,
      articleAvgUsd: 0.52,
      budgetRemainingUsd: 87.55,
    },
  }
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // Supabase未設定: モックデータを返す
    return NextResponse.json(getMockDashboardData())
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // 並行クエリで各データを取得
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [
      articlesResult,
      pipelineResult,
      alertsResult,
      costsResult,
    ] = await Promise.allSettled([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('articles').select('status, compliance_score', { count: 'exact' }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('pipeline_runs').select('*').gte('started_at', sevenDaysAgo).order('started_at', { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('monitoring_alerts').select('*').eq('status', 'active').order('created_at', { ascending: false }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from('generation_costs').select('*').gte('created_at', thirtyDaysAgo),
    ])

    // 記事統計
    const articleRows = articlesResult.status === 'fulfilled' ? (articlesResult.value.data ?? []) : []
    const total = articleRows.length
    const published = articleRows.filter((a: { status: string }) => a.status === 'published').length
    const draft = articleRows.filter((a: { status: string }) => a.status === 'draft').length
    const pendingReview = articleRows.filter((a: { status: string }) => a.status === 'review').length
    const complianceScores = articleRows
      .map((a: { compliance_score: number | null }) => a.compliance_score)
      .filter((s: number | null): s is number => s !== null)
    const avgComplianceScore = complianceScores.length > 0
      ? complianceScores.reduce((sum: number, s: number) => sum + s, 0) / complianceScores.length
      : 0

    // パイプライン統計
    const pipelineRuns = pipelineResult.status === 'fulfilled' ? (pipelineResult.value.data ?? []) : []
    const successRuns = pipelineRuns.filter((r: { status: string }) => r.status === 'success').length
    const lastRun = pipelineRuns[0]

    // アクティブアラート
    const alertRows = alertsResult.status === 'fulfilled' ? (alertsResult.value.data ?? []) : []

    // コストサマリー
    const costRows = costsResult.status === 'fulfilled' ? (costsResult.value.data ?? []) : []
    let monthlyTotalUsd = 0
    const costArticleIds = new Set<string>()

    for (const cost of costRows) {
      const costUsd = parseFloat(cost.cost_usd ?? '0')
      monthlyTotalUsd += costUsd
      if (cost.article_id) costArticleIds.add(cost.article_id)
    }

    const costArticleCount = Math.max(costArticleIds.size, 1)

    const dashboard: AdminDashboardData = {
      pipeline: {
        status: lastRun?.status === 'running' ? 'running' : lastRun?.status === 'error' ? 'error' : 'idle',
        lastRunAt: lastRun?.started_at ?? undefined,
        lastRunSuccess: lastRun?.status === 'success',
        totalRuns: pipelineRuns.length,
      },
      articles: {
        total,
        published,
        draft,
        pendingReview,
        avgComplianceScore: Math.round(avgComplianceScore * 100) / 100,
      },
      revenue: {
        monthlyTotalJpy: 0,
        monthOverMonthChange: 0,
        byAsp: [],
      },
      alerts: alertRows.map((a: Record<string, unknown>) => ({
        id: String(a.id),
        level: (a.severity as 'info' | 'warning' | 'critical') ?? 'info',
        status: (a.status as 'active' | 'acknowledged' | 'resolved') ?? 'active',
        title: String(a.title ?? ''),
        message: String(a.message ?? ''),
        source: String(a.source ?? ''),
        createdAt: String(a.created_at ?? ''),
        resolvedAt: a.resolved_at ? String(a.resolved_at) : undefined,
      })),
      costs: {
        monthlyTotalUsd: Math.round(monthlyTotalUsd * 100) / 100,
        articleAvgUsd: Math.round((monthlyTotalUsd / costArticleCount) * 100) / 100,
        budgetRemainingUsd: Math.round((100 - monthlyTotalUsd) * 100) / 100,
      },
    }

    return NextResponse.json(dashboard)
  } catch (err) {
    console.error('[admin/dashboard] Error:', err)
    // Supabaseエラー時はモックにフォールバック
    return NextResponse.json(getMockDashboardData())
  }
}
