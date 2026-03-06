/**
 * ヘルススコア算出ステップ
 * PDCAパイプライン (23:00 JST) で実行される
 *
 * 1. 前ステップのアナリティクス/ASP収益データを取得
 * 2. microCMS から公開済み記事を一覧取得
 * 3. Supabase analytics_daily から各記事の7日間メトリクスを取得
 * 4. calculateHealthScore() で各記事をスコアリング
 * 5. スコア結果を context.sharedData に保存し、後続ステップに渡す
 */

import type { PipelineContext, PipelineStep, AnalyticsData, AspRevenueData } from '../types'
import { calculateHealthScore } from '@/lib/content/health-score'
import type { HealthScoreInput, HealthScore } from '@/lib/content/health-score'

// ============================================================
// 型定義
// ============================================================

/** 記事ごとのヘルススコア結果 */
export interface ArticleHealthScore {
  articleId: string
  title: string
  slug: string
  healthScore: HealthScore
  input: HealthScoreInput
}

/** ステップ出力 */
export interface HealthScoreStepOutput {
  scores: ArticleHealthScore[]
  summary: {
    total: number
    healthy: number
    needsImprovement: number
    critical: number
    averageScore: number
  }
}

// ============================================================
// microCMS 記事取得ヘルパー
// ============================================================

interface MicroCMSArticleMinimal {
  id: string
  title: string
  slug: string
}

/**
 * microCMS から公開済み記事の一覧を取得する
 * microCMS SDK を使わず REST API を直接呼び出す (パイプライン実行コンテキスト)
 */
async function fetchPublishedArticlesFromMicroCMS(): Promise<MicroCMSArticleMinimal[]> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain || !apiKey) {
    console.warn('[calculate-health-scores] microCMS not configured — returning empty list')
    return []
  }

  try {
    const url = `https://${serviceDomain}.microcms.io/api/v1/articles?limit=100&fields=id,title,slug`
    const response = await fetch(url, {
      headers: { 'X-MICROCMS-API-KEY': apiKey },
    })

    if (!response.ok) {
      throw new Error(`microCMS API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      contents: MicroCMSArticleMinimal[]
      totalCount: number
    }
    return data.contents ?? []
  } catch (err) {
    console.error('[calculate-health-scores] Failed to fetch articles from microCMS:', err)
    return []
  }
}

// ============================================================
// Supabase アナリティクスデータ取得ヘルパー
// ============================================================

interface AnalyticsDailyRecord {
  article_id: string
  date: string
  pageviews: number
  unique_users: number
  avg_time: number
  bounce_rate: number
  ctr: number
  conversions: number
}

/**
 * Supabase analytics_daily から過去7日間のデータを取得する
 */
async function fetchAnalyticsDailyFromSupabase(): Promise<AnalyticsDailyRecord[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[calculate-health-scores] Supabase not configured — returning empty analytics')
    return []
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('analytics_daily')
      .select('*')
      .gte('date', sevenDaysAgo)
      .order('date', { ascending: false }) as {
      data: AnalyticsDailyRecord[] | null
      error: { message: string } | null
    }

    if (error) {
      console.error('[calculate-health-scores] Supabase query error:', error.message)
      return []
    }

    return data ?? []
  } catch (err) {
    console.error('[calculate-health-scores] Failed to fetch analytics from Supabase:', err)
    return []
  }
}

// ============================================================
// データ集約ヘルパー
// ============================================================

interface AggregatedMetrics {
  totalPageviews: number
  avgSessionDuration: number
  avgBounceRate: number
  avgCtr: number
  totalConversions: number
}

/**
 * 特定記事の7日間メトリクスを集約する
 */
function aggregateMetrics(records: AnalyticsDailyRecord[]): AggregatedMetrics {
  if (records.length === 0) {
    return {
      totalPageviews: 0,
      avgSessionDuration: 0,
      avgBounceRate: 0,
      avgCtr: 0,
      totalConversions: 0,
    }
  }

  const totalPageviews = records.reduce((sum, r) => sum + r.pageviews, 0)
  const avgSessionDuration = records.reduce((sum, r) => sum + r.avg_time, 0) / records.length
  const avgBounceRate = records.reduce((sum, r) => sum + r.bounce_rate, 0) / records.length
  const avgCtr = records.reduce((sum, r) => sum + r.ctr, 0) / records.length
  const totalConversions = records.reduce((sum, r) => sum + r.conversions, 0)

  return {
    totalPageviews,
    avgSessionDuration,
    avgBounceRate,
    avgCtr,
    totalConversions,
  }
}

/**
 * context.sharedData のアナリティクスデータからarticleIdでフィルタする
 */
function findAnalyticsDataForArticle(
  analyticsData: AnalyticsData[],
  articleId: string,
  slug: string
): AnalyticsData | null {
  // articleId またはスラッグで一致する最新データを探す
  return analyticsData.find(
    (a) => a.articleId === articleId || a.articleId === slug
  ) ?? null
}

/**
 * context.sharedData のASP収益データからarticleIdに関連する収益を集計する
 * (現在のASPデータはarticle単位ではないため、全体の合計を使用)
 */
function aggregateAspRevenue(aspData: AspRevenueData[]): {
  totalClicks: number
  totalConversions: number
  totalRevenue: number
} {
  return {
    totalClicks: aspData.reduce((sum, r) => sum + r.clicks, 0),
    totalConversions: aspData.reduce((sum, r) => sum + r.conversions, 0),
    totalRevenue: aspData.reduce((sum, r) => sum + r.revenue, 0),
  }
}

// ============================================================
// ステップ実装
// ============================================================

export const calculateHealthScoresStep: PipelineStep<unknown, HealthScoreStepOutput> = {
  name: 'calculate-health-scores',
  description: '全公開記事のヘルススコアを算出する',
  maxRetries: 2,

  async execute(_input: unknown, context: PipelineContext): Promise<HealthScoreStepOutput> {
    console.log(`[calculate-health-scores] Starting health score calculation (run: ${context.runId})`)

    // 1. 前ステップから共有データを取得 (オプショナル)
    const analyticsData = (context.sharedData['analytics'] as AnalyticsData[] | undefined) ?? []
    const aspData = (context.sharedData['aspRevenue'] as AspRevenueData[] | undefined) ?? []

    console.log(
      `[calculate-health-scores] Shared data: analytics=${analyticsData.length} rows, asp=${aspData.length} rows`
    )

    // 2. microCMS から公開済み記事を取得
    const articles = await fetchPublishedArticlesFromMicroCMS()
    console.log(`[calculate-health-scores] Fetched ${articles.length} published articles from microCMS`)

    if (articles.length === 0) {
      console.warn('[calculate-health-scores] No articles to score — returning empty result')
      const emptyOutput: HealthScoreStepOutput = {
        scores: [],
        summary: { total: 0, healthy: 0, needsImprovement: 0, critical: 0, averageScore: 0 },
      }
      context.sharedData['healthScores'] = emptyOutput
      return emptyOutput
    }

    // 3. Supabase analytics_daily から7日間データを取得
    const analyticsDailyRecords = await fetchAnalyticsDailyFromSupabase()
    console.log(`[calculate-health-scores] Fetched ${analyticsDailyRecords.length} analytics_daily records`)

    // articleId別にグルーピング
    const recordsByArticle = new Map<string, AnalyticsDailyRecord[]>()
    for (const record of analyticsDailyRecords) {
      const existing = recordsByArticle.get(record.article_id) ?? []
      existing.push(record)
      recordsByArticle.set(record.article_id, existing)
    }

    // ASP収益全体集計 (記事別のASPデータがないため全体の平均を使用)
    const aspTotals = aggregateAspRevenue(aspData)
    const aspPerArticle = articles.length > 0
      ? {
          clicks: Math.floor(aspTotals.totalClicks / articles.length),
          conversions: Math.floor(aspTotals.totalConversions / articles.length),
          revenue: Math.floor(aspTotals.totalRevenue / articles.length),
        }
      : { clicks: 0, conversions: 0, revenue: 0 }

    // 4. 各記事のヘルススコアを算出
    const scores: ArticleHealthScore[] = []

    for (const article of articles) {
      try {
        // Supabase analytics_daily からの集約メトリクス
        const articleRecords = recordsByArticle.get(article.id) ?? []
        const metrics = aggregateMetrics(articleRecords)

        // context.sharedData のアナリティクスデータでフォールバック
        const pipelineAnalytics = findAnalyticsDataForArticle(
          analyticsData,
          article.id,
          article.slug
        )

        // HealthScoreInput を構築
        const input: HealthScoreInput = {
          articleId: article.id,
          // SEO メトリクス
          rankingPosition: null,  // GSC position は sync-analytics で格納されていない
          rankingChange7d: null,  // 順位変動は別途計算が必要
          ctr: metrics.avgCtr > 0
            ? metrics.avgCtr
            : (pipelineAnalytics?.ctr ?? null),
          impressions: null,  // GSC impressions は analytics_daily にない
          // UX メトリクス
          avgSessionDuration: metrics.avgSessionDuration > 0
            ? metrics.avgSessionDuration
            : (pipelineAnalytics?.avgTime ?? null),
          bounceRate: metrics.avgBounceRate > 0
            ? metrics.avgBounceRate
            : (pipelineAnalytics?.bounceRate ?? null),
          pageviews7d: metrics.totalPageviews > 0
            ? metrics.totalPageviews
            : (pipelineAnalytics?.pageviews ?? null),
          // 収益メトリクス (記事別データがないため均等分配)
          aspClicks: aspPerArticle.clicks > 0 ? aspPerArticle.clicks : null,
          aspConversions: aspPerArticle.conversions > 0 ? aspPerArticle.conversions : null,
          aspRevenue: aspPerArticle.revenue > 0 ? aspPerArticle.revenue : null,
        }

        const healthScore = calculateHealthScore(input)

        scores.push({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          healthScore,
          input,
        })
      } catch (err) {
        console.error(
          `[calculate-health-scores] Error scoring article "${article.title}" (${article.id}):`,
          err
        )
        // 個別記事のエラーは記録してスキップ（パイプラインは継続）
      }
    }

    // 5. サマリーを集計
    const healthy = scores.filter((s) => s.healthScore.status === 'healthy').length
    const needsImprovement = scores.filter((s) => s.healthScore.status === 'needs_improvement').length
    const critical = scores.filter((s) => s.healthScore.status === 'critical').length
    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.healthScore.total, 0) / scores.length)
        : 0

    const output: HealthScoreStepOutput = {
      scores,
      summary: {
        total: scores.length,
        healthy,
        needsImprovement,
        critical,
        averageScore,
      },
    }

    // 6. 共有データに保存（後続ステップで使用）
    context.sharedData['healthScores'] = output

    console.log(
      `[calculate-health-scores] Scored ${scores.length} articles: ` +
      `healthy=${healthy}, needs_improvement=${needsImprovement}, critical=${critical}, ` +
      `avg_score=${averageScore}`
    )

    return output
  },
}
