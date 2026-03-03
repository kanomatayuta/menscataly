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
    pipelineStatus: {
      currentStatus: 'idle',
      lastRunAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      lastRunDurationMs: 45000,
      successRate7d: 92.5,
    },
    articleStats: {
      totalArticles: 24,
      publishedCount: 18,
      draftCount: 4,
      pendingReviewCount: 2,
      avgComplianceScore: 96.3,
    },
    revenueSummary: {
      totalRevenue30d: 127500,
      totalClicks30d: 3420,
      totalConversions30d: 15,
      topAsp: 'afb',
    },
    activeAlerts: [],
    costSummary: {
      totalCost30d: 12.45,
      articleGenerationCost: 9.80,
      imageGenerationCost: 1.85,
      avgCostPerArticle: 0.52,
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
    const articles = articlesResult.status === 'fulfilled' ? (articlesResult.value.data ?? []) : []
    const totalArticles = articles.length
    const publishedCount = articles.filter((a: { status: string }) => a.status === 'published').length
    const draftCount = articles.filter((a: { status: string }) => a.status === 'draft').length
    const pendingReviewCount = articles.filter((a: { status: string }) => a.status === 'review').length
    const complianceScores = articles
      .map((a: { compliance_score: number | null }) => a.compliance_score)
      .filter((s: number | null): s is number => s !== null)
    const avgComplianceScore = complianceScores.length > 0
      ? complianceScores.reduce((sum: number, s: number) => sum + s, 0) / complianceScores.length
      : 0

    // パイプライン統計
    const pipelineRuns = pipelineResult.status === 'fulfilled' ? (pipelineResult.value.data ?? []) : []
    const successRuns = pipelineRuns.filter((r: { status: string }) => r.status === 'success').length
    const successRate7d = pipelineRuns.length > 0
      ? (successRuns / pipelineRuns.length) * 100
      : 0
    const lastRun = pipelineRuns[0]

    // アクティブアラート
    const activeAlerts = alertsResult.status === 'fulfilled' ? (alertsResult.value.data ?? []) : []

    // コストサマリー
    const costs = costsResult.status === 'fulfilled' ? (costsResult.value.data ?? []) : []
    let totalCost30d = 0
    let articleGenerationCost = 0
    let imageGenerationCost = 0
    const costArticleIds = new Set<string>()

    for (const cost of costs) {
      const costUsd = parseFloat(cost.cost_usd ?? '0')
      totalCost30d += costUsd
      if (cost.cost_type === 'article_generation') {
        articleGenerationCost += costUsd
        if (cost.article_id) costArticleIds.add(cost.article_id)
      }
      if (cost.cost_type === 'image_generation') {
        imageGenerationCost += costUsd
      }
    }

    const costArticleCount = Math.max(costArticleIds.size, 1)

    const dashboard: AdminDashboardData = {
      pipelineStatus: {
        currentStatus: lastRun?.status ?? 'idle',
        lastRunAt: lastRun?.started_at ?? null,
        lastRunDurationMs: lastRun
          ? (lastRun.completed_at
            ? new Date(lastRun.completed_at).getTime() - new Date(lastRun.started_at).getTime()
            : null)
          : null,
        successRate7d,
      },
      articleStats: {
        totalArticles,
        publishedCount,
        draftCount,
        pendingReviewCount,
        avgComplianceScore: Math.round(avgComplianceScore * 100) / 100,
      },
      revenueSummary: {
        totalRevenue30d: 0,
        totalClicks30d: 0,
        totalConversions30d: 0,
        topAsp: null,
      },
      activeAlerts: activeAlerts.map((a: Record<string, unknown>) => ({
        id: a.id,
        type: a.type,
        severity: a.severity,
        status: a.status,
        title: a.title,
        message: a.message,
        metadata: a.metadata ?? {},
        createdAt: a.created_at,
        acknowledgedAt: a.acknowledged_at ?? null,
        resolvedAt: a.resolved_at ?? null,
      })),
      costSummary: {
        totalCost30d: Math.round(totalCost30d * 100) / 100,
        articleGenerationCost: Math.round(articleGenerationCost * 100) / 100,
        imageGenerationCost: Math.round(imageGenerationCost * 100) / 100,
        avgCostPerArticle: Math.round((totalCost30d / costArticleCount) * 100) / 100,
      },
    }

    return NextResponse.json(dashboard)
  } catch (err) {
    console.error('[admin/dashboard] Error:', err)
    // Supabaseエラー時はモックにフォールバック
    return NextResponse.json(getMockDashboardData())
  }
}
