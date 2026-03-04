/**
 * 日次レポートジェネレーター
 * パイプライン実行結果、記事生成、収益、コスト、コンプライアンスを集約して
 * マークダウンおよびSlack Blocks形式でレポートを出力する
 */

import type { HealthScore } from '@/lib/content/health-score'
import { getHealthScoreDistribution } from '@/lib/content/health-score'

// ============================================================
// 型定義
// ============================================================

/** パイプライン実行サマリー */
export interface PipelineExecutionSummary {
  /** 実行回数 */
  totalRuns: number
  /** 成功回数 */
  successCount: number
  /** 失敗回数 */
  failedCount: number
  /** 平均実行時間 (ms) */
  avgDurationMs: number
}

/** 記事生成サマリー */
export interface ArticleGenerationSummary {
  /** 生成された記事数 */
  generatedCount: number
  /** 公開された記事数 */
  publishedCount: number
  /** リジェクトされた記事数（コンプライアンス不合格） */
  rejectedCount: number
  /** 平均コンプライアンススコア */
  avgComplianceScore: number
}

/** 収益サマリー */
export interface DailyRevenueSummary {
  /** 総クリック数 */
  totalClicks: number
  /** 総コンバージョン数 */
  totalConversions: number
  /** 総収益（円） */
  totalRevenue: number
  /** CVR（コンバージョン率） */
  cvr: number
  /** ASP別収益 */
  revenueByAsp: Array<{ aspName: string; revenue: number; conversions: number }>
}

/** コストサマリー */
export interface DailyCostSummary {
  /** 記事生成コスト (USD) */
  articleGenerationCostUsd: number
  /** 画像生成コスト (USD) */
  imageGenerationCostUsd: number
  /** 分析コスト (USD) */
  analysisCostUsd: number
  /** 合計コスト (USD) */
  totalCostUsd: number
}

/** コンプライアンスアラートサマリー */
export interface ComplianceAlertSummary {
  /** アクティブアラート数 */
  activeAlertCount: number
  /** クリティカルアラート数 */
  criticalCount: number
  /** 警告アラート数 */
  warningCount: number
  /** 自動非公開された記事数 */
  depublishedCount: number
}

/** パフォーマンス上位記事 */
export interface TopArticle {
  /** 記事タイトル */
  title: string
  /** PV数 */
  pageviews: number
  /** 収益（円） */
  revenue: number
  /** ヘルススコア */
  healthScore: number
}

/** 日次レポートデータ */
export interface DailyReport {
  /** レポート対象日 (YYYY-MM-DD) */
  date: string
  /** レポート生成日時 (ISO 8601) */
  generatedAt: string
  /** パイプライン実行サマリー */
  pipeline: PipelineExecutionSummary
  /** 記事生成サマリー */
  articles: ArticleGenerationSummary
  /** 収益サマリー */
  revenue: DailyRevenueSummary
  /** コストサマリー */
  cost: DailyCostSummary
  /** コンプライアンスアラート */
  compliance: ComplianceAlertSummary
  /** パフォーマンス上位5記事 */
  topArticles: TopArticle[]
  /** ヘルススコア分布 */
  healthScoreDistribution: {
    healthy: number
    needsImprovement: number
    critical: number
  }
}

/** Slack Block */
export interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: Array<{ type: string; text: string; emoji?: boolean }>
  fields?: Array<{ type: string; text: string }>
}

// ============================================================
// DailyReportGenerator クラス
// ============================================================

/**
 * 日次レポートジェネレーター
 *
 * @example
 * ```ts
 * const generator = new DailyReportGenerator()
 * const report = await generator.generate('2026-03-03')
 * const markdown = generator.formatAsMarkdown(report)
 * const blocks = generator.formatAsSlackBlocks(report)
 * ```
 */
export class DailyReportGenerator {
  /**
   * 日次レポートを生成する
   * 各データソースからデータを取得し、構造化されたレポートに集約する
   *
   * @param date レポート対象日 (YYYY-MM-DD)
   * @param overrides テスト用にデータを直接渡す場合のオーバーライド
   */
  async generate(
    date: string,
    overrides?: Partial<DailyReport>
  ): Promise<DailyReport> {
    const now = new Date().toISOString()

    // 各サマリーを取得（オーバーライドがあればそれを使用）
    const pipeline = overrides?.pipeline ?? await this.fetchPipelineSummary(date)
    const articles = overrides?.articles ?? await this.fetchArticleSummary(date)
    const revenue = overrides?.revenue ?? await this.fetchRevenueSummary(date)
    const cost = overrides?.cost ?? await this.fetchCostSummary(date)
    const compliance = overrides?.compliance ?? await this.fetchComplianceSummary(date)
    const topArticles = overrides?.topArticles ?? await this.fetchTopArticles(date)
    const healthScoreDistribution = overrides?.healthScoreDistribution ?? await this.fetchHealthScoreDistribution()

    return {
      date,
      generatedAt: now,
      pipeline,
      articles,
      revenue,
      cost,
      compliance,
      topArticles,
      healthScoreDistribution,
    }
  }

  /**
   * レポートをマークダウン形式にフォーマットする（Slack配信用）
   */
  formatAsMarkdown(report: DailyReport): string {
    const lines: string[] = []

    lines.push(`# MENS CATALY 日次レポート — ${report.date}`)
    lines.push('')

    // パイプライン実行サマリー
    lines.push('## パイプライン実行')
    lines.push(`- 実行回数: ${report.pipeline.totalRuns}`)
    lines.push(`- 成功: ${report.pipeline.successCount} / 失敗: ${report.pipeline.failedCount}`)
    lines.push(`- 平均実行時間: ${Math.round(report.pipeline.avgDurationMs / 1000)}秒`)
    lines.push('')

    // 記事生成サマリー
    lines.push('## 記事生成')
    lines.push(`- 生成: ${report.articles.generatedCount}件`)
    lines.push(`- 公開: ${report.articles.publishedCount}件`)
    lines.push(`- リジェクト: ${report.articles.rejectedCount}件`)
    lines.push(`- 平均コンプライアンススコア: ${report.articles.avgComplianceScore.toFixed(1)}`)
    lines.push('')

    // 収益サマリー
    lines.push('## 収益')
    lines.push(`- クリック: ${report.revenue.totalClicks.toLocaleString()}`)
    lines.push(`- CV: ${report.revenue.totalConversions}件`)
    lines.push(`- 収益: ${report.revenue.totalRevenue.toLocaleString()}円`)
    lines.push(`- CVR: ${(report.revenue.cvr * 100).toFixed(2)}%`)
    if (report.revenue.revenueByAsp.length > 0) {
      lines.push('- ASP別:')
      for (const asp of report.revenue.revenueByAsp) {
        lines.push(`  - ${asp.aspName}: ${asp.revenue.toLocaleString()}円 (${asp.conversions}CV)`)
      }
    }
    lines.push('')

    // コストサマリー
    lines.push('## コスト (AI生成)')
    lines.push(`- 記事生成: $${report.cost.articleGenerationCostUsd.toFixed(2)}`)
    lines.push(`- 画像生成: $${report.cost.imageGenerationCostUsd.toFixed(2)}`)
    lines.push(`- 分析: $${report.cost.analysisCostUsd.toFixed(2)}`)
    lines.push(`- **合計: $${report.cost.totalCostUsd.toFixed(2)}**`)
    lines.push('')

    // コンプライアンス
    lines.push('## コンプライアンス')
    lines.push(`- アクティブアラート: ${report.compliance.activeAlertCount}件`)
    lines.push(`- クリティカル: ${report.compliance.criticalCount}件`)
    lines.push(`- 警告: ${report.compliance.warningCount}件`)
    lines.push(`- 自動非公開: ${report.compliance.depublishedCount}件`)
    lines.push('')

    // トップ記事
    if (report.topArticles.length > 0) {
      lines.push('## パフォーマンス TOP 5')
      for (let i = 0; i < report.topArticles.length; i++) {
        const article = report.topArticles[i]
        lines.push(`${i + 1}. **${article.title}** — PV: ${article.pageviews}, 収益: ${article.revenue.toLocaleString()}円, HS: ${article.healthScore}`)
      }
      lines.push('')
    }

    // ヘルススコア分布
    lines.push('## ヘルススコア分布')
    const dist = report.healthScoreDistribution
    lines.push(`- 良好 (>=70): ${dist.healthy}件`)
    lines.push(`- 改善必要 (40-69): ${dist.needsImprovement}件`)
    lines.push(`- 要注意 (<40): ${dist.critical}件`)
    lines.push('')

    lines.push(`---`)
    lines.push(`生成日時: ${report.generatedAt}`)

    return lines.join('\n')
  }

  /**
   * レポートをSlack Blocks形式にフォーマットする（リッチフォーマット用）
   */
  formatAsSlackBlocks(report: DailyReport): SlackBlock[] {
    const blocks: SlackBlock[] = []

    // ヘッダー
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: `MENS CATALY 日次レポート ${report.date}`, emoji: true },
    })

    // パイプライン & 記事
    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*パイプライン*\n成功 ${report.pipeline.successCount}/${report.pipeline.totalRuns}` },
        { type: 'mrkdwn', text: `*記事生成*\n生成 ${report.articles.generatedCount} / 公開 ${report.articles.publishedCount} / NG ${report.articles.rejectedCount}` },
      ],
    })

    // 収益 & コスト
    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*収益*\n${report.revenue.totalRevenue.toLocaleString()}円 (${report.revenue.totalConversions}CV)` },
        { type: 'mrkdwn', text: `*AI コスト*\n$${report.cost.totalCostUsd.toFixed(2)}` },
      ],
    })

    // コンプライアンス
    if (report.compliance.criticalCount > 0 || report.compliance.depublishedCount > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:warning: *コンプライアンス*\nクリティカル: ${report.compliance.criticalCount}件 / 自動非公開: ${report.compliance.depublishedCount}件`,
        },
      })
    }

    // 区切り線
    blocks.push({ type: 'divider' })

    // TOP記事
    if (report.topArticles.length > 0) {
      const topList = report.topArticles
        .map((a, i) => `${i + 1}. ${a.title} — ${a.pageviews}PV, ${a.revenue.toLocaleString()}円`)
        .join('\n')

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*TOP 5 記事*\n${topList}` },
      })
    }

    // ヘルススコア分布
    const dist = report.healthScoreDistribution
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `HS分布: 良好 ${dist.healthy} | 改善 ${dist.needsImprovement} | 要注意 ${dist.critical} | 生成: ${report.generatedAt}`,
        },
      ],
    })

    return blocks
  }

  // ============================================================
  // データ取得ヘルパー（Supabase/GA4/GSC/ASP からの取得）
  // ============================================================

  /**
   * パイプライン実行サマリーを取得する
   */
  private async fetchPipelineSummary(date: string): Promise<PipelineExecutionSummary> {
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('pipeline_runs')
        .select('*')
        .gte('started_at', startOfDay)
        .lte('started_at', endOfDay)

      if (error || !data) {
        return this.emptyPipelineSummary()
      }

      const runs = data as Array<{ status: string; started_at: string; completed_at: string | null }>
      const successCount = runs.filter((r) => r.status === 'success').length
      const failedCount = runs.filter((r) => r.status === 'failed').length

      const durations = runs
        .filter((r) => r.completed_at)
        .map((r) => new Date(r.completed_at!).getTime() - new Date(r.started_at).getTime())

      return {
        totalRuns: runs.length,
        successCount,
        failedCount,
        avgDurationMs: durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
      }
    } catch {
      return this.emptyPipelineSummary()
    }
  }

  /**
   * 記事生成サマリーを取得する
   */
  private async fetchArticleSummary(date: string): Promise<ArticleGenerationSummary> {
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('article_reviews')
        .select('status,compliance_score')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)

      if (error || !data) {
        return this.emptyArticleSummary()
      }

      type ReviewRow = { status: string; compliance_score: number }
      const reviews = data as ReviewRow[]
      const scores = reviews.map((r) => r.compliance_score).filter((s) => s != null)

      return {
        generatedCount: reviews.length,
        publishedCount: reviews.filter((r) => r.status === 'approved').length,
        rejectedCount: reviews.filter((r) => r.status === 'rejected').length,
        avgComplianceScore: scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
      }
    } catch {
      return this.emptyArticleSummary()
    }
  }

  /**
   * 収益サマリーを取得する
   */
  private async fetchRevenueSummary(date: string): Promise<DailyRevenueSummary> {
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('asp_revenue')
        .select('*')
        .eq('date', date)

      if (error || !data) {
        return this.emptyRevenueSummary()
      }

      type RevenueRow = { asp_name: string; clicks: number; conversions: number; revenue: number }
      const rows = data as RevenueRow[]

      const totalClicks = rows.reduce((sum, r) => sum + (r.clicks ?? 0), 0)
      const totalConversions = rows.reduce((sum, r) => sum + (r.conversions ?? 0), 0)
      const totalRevenue = rows.reduce((sum, r) => sum + (r.revenue ?? 0), 0)

      // ASP別集計
      const aspMap = new Map<string, { revenue: number; conversions: number }>()
      for (const row of rows) {
        const existing = aspMap.get(row.asp_name) ?? { revenue: 0, conversions: 0 }
        existing.revenue += row.revenue ?? 0
        existing.conversions += row.conversions ?? 0
        aspMap.set(row.asp_name, existing)
      }

      return {
        totalClicks,
        totalConversions,
        totalRevenue,
        cvr: totalClicks > 0 ? totalConversions / totalClicks : 0,
        revenueByAsp: Array.from(aspMap.entries())
          .map(([aspName, data]) => ({ aspName, ...data }))
          .sort((a, b) => b.revenue - a.revenue),
      }
    } catch {
      return this.emptyRevenueSummary()
    }
  }

  /**
   * コストサマリーを取得する
   */
  private async fetchCostSummary(date: string): Promise<DailyCostSummary> {
    try {
      const { CostTracker } = await import('@/lib/batch/cost-tracker')
      const tracker = new CostTracker()
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`
      const summary = await tracker.getCostSummary(startOfDay, endOfDay)

      return {
        articleGenerationCostUsd: summary.articleGenerationCost,
        imageGenerationCostUsd: summary.imageGenerationCost,
        analysisCostUsd: summary.analysisCost,
        totalCostUsd: summary.totalCostUsd,
      }
    } catch {
      return this.emptyCostSummary()
    }
  }

  /**
   * コンプライアンスアラートサマリーを取得する
   */
  private async fetchComplianceSummary(_date: string): Promise<ComplianceAlertSummary> {
    try {
      const { AlertManager } = await import('@/lib/monitoring/alert-manager')
      const alertManager = new AlertManager()
      const activeAlerts = await alertManager.getActiveAlerts()

      return {
        activeAlertCount: activeAlerts.length,
        criticalCount: activeAlerts.filter((a) => a.level === 'critical').length,
        warningCount: activeAlerts.filter((a) => a.level === 'warning').length,
        depublishedCount: activeAlerts.filter(
          (a) => a.type === 'compliance_violation' && (a.metadata?.autoDepublished === true || a.metadata?.depublished === true)
        ).length,
      }
    } catch {
      return { activeAlertCount: 0, criticalCount: 0, warningCount: 0, depublishedCount: 0 }
    }
  }

  /**
   * パフォーマンス上位5記事を取得する
   */
  private async fetchTopArticles(_date: string): Promise<TopArticle[]> {
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('article_performance')
        .select('title,pageviews,revenue,health_score')
        .order('pageviews', { ascending: false })
        .limit(5)

      if (error || !data) {
        return []
      }

      type PerfRow = { title: string; pageviews: number; revenue: number; health_score: number }
      return (data as PerfRow[]).map((row) => ({
        title: row.title,
        pageviews: row.pageviews ?? 0,
        revenue: row.revenue ?? 0,
        healthScore: row.health_score ?? 0,
      }))
    } catch {
      return []
    }
  }

  /**
   * ヘルススコア分布を取得する
   */
  private async fetchHealthScoreDistribution(): Promise<{
    healthy: number
    needsImprovement: number
    critical: number
  }> {
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('article_health_scores')
        .select('total_score')

      if (error || !data) {
        return { healthy: 0, needsImprovement: 0, critical: 0 }
      }

      type ScoreRow = { total_score: number }
      const scores = (data as ScoreRow[]).map((row) => ({
        total: row.total_score,
        status: row.total_score >= 70 ? 'healthy' : row.total_score >= 40 ? 'needs_improvement' : 'critical',
      } as HealthScore))

      return getHealthScoreDistribution(scores as HealthScore[])
    } catch {
      return { healthy: 0, needsImprovement: 0, critical: 0 }
    }
  }

  // ============================================================
  // 空サマリーファクトリ
  // ============================================================

  private emptyPipelineSummary(): PipelineExecutionSummary {
    return { totalRuns: 0, successCount: 0, failedCount: 0, avgDurationMs: 0 }
  }

  private emptyArticleSummary(): ArticleGenerationSummary {
    return { generatedCount: 0, publishedCount: 0, rejectedCount: 0, avgComplianceScore: 0 }
  }

  private emptyRevenueSummary(): DailyRevenueSummary {
    return { totalClicks: 0, totalConversions: 0, totalRevenue: 0, cvr: 0, revenueByAsp: [] }
  }

  private emptyCostSummary(): DailyCostSummary {
    return { articleGenerationCostUsd: 0, imageGenerationCostUsd: 0, analysisCostUsd: 0, totalCostUsd: 0 }
  }
}
