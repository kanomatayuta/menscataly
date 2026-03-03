/**
 * 週次レポートジェネレーター
 * KPIトレンド、カテゴリ別パフォーマンス、月次目標進捗、AIコスト効率分析
 * KGI: 12ヶ月以内に月次収益30万円達成
 */

import { DailyReportGenerator, type DailyReport } from './daily-report'

// ============================================================
// 型定義
// ============================================================

/** KPIトレンド（7日間比較） */
export interface KPITrend {
  /** 指標名 */
  metric: string
  /** 今週の値 */
  currentValue: number
  /** 先週の値 */
  previousValue: number
  /** 変化量 */
  change: number
  /** 変化率 (%) */
  changePercent: number
  /** トレンド方向 */
  trend: 'up' | 'down' | 'flat'
  /** ポジティブな変化かどうか（収益UPは良い、コストUPは悪い等） */
  isPositive: boolean
}

/** カテゴリ別パフォーマンス */
export interface CategoryPerformance {
  /** カテゴリ名 */
  category: string
  /** 記事数 */
  articleCount: number
  /** 総PV */
  totalPageviews: number
  /** 総収益（円） */
  totalRevenue: number
  /** 平均ヘルススコア */
  avgHealthScore: number
  /** 収益/記事（円） */
  revenuePerArticle: number
}

/** 月次目標進捗 */
export interface MonthlyTargetProgress {
  /** 今月の累計収益（円） */
  currentMonthRevenue: number
  /** 月次目標（円） — KGI: 300,000円 */
  monthlyTarget: number
  /** 達成率 (%) */
  achievementRate: number
  /** 残り日数 */
  remainingDays: number
  /** 目標達成に必要な日次収益（円） */
  requiredDailyRevenue: number
  /** 先月比 (%) */
  momChangePercent: number
}

/** AIコスト効率分析 */
export interface AICostEfficiency {
  /** 今週の合計コスト (USD) */
  totalCostUsd: number
  /** 生成記事数 */
  articleCount: number
  /** 記事あたりコスト (USD) */
  costPerArticle: number
  /** 収益あたりコスト（ROI: 円/USD） */
  revenuePerCostUsd: number
  /** 先週比コスト変化 (%) */
  costChangePercent: number
  /** コスト効率評価 */
  efficiency: 'excellent' | 'good' | 'acceptable' | 'poor'
}

/** 週次レポートデータ */
export interface WeeklyReport {
  /** レポート対象期間（開始日） */
  weekStartDate: string
  /** レポート対象期間（終了日） */
  weekEndDate: string
  /** レポート生成日時 (ISO 8601) */
  generatedAt: string
  /** KPIトレンド */
  kpiTrends: KPITrend[]
  /** カテゴリ別パフォーマンス */
  categoryPerformance: CategoryPerformance[]
  /** 月次目標進捗 */
  monthlyProgress: MonthlyTargetProgress
  /** AIコスト効率 */
  costEfficiency: AICostEfficiency
  /** 日次レポートの集約データ */
  dailySummaries: DailyReport[]
  /** 週次サマリーテキスト */
  summary: string
}

// ============================================================
// ヘルパー関数
// ============================================================

/** 日付文字列から N日前の日付を計算する */
function subtractDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() - days)
  return date.toISOString().split('T')[0]
}

/** 月の残り日数を計算する */
function getRemainingDaysInMonth(dateStr: string): number {
  const date = new Date(dateStr)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return lastDay.getDate() - date.getDate()
}

/** 日付の配列を生成する (startDate <= d <= endDate) */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)

  while (start <= end) {
    dates.push(start.toISOString().split('T')[0])
    start.setDate(start.getDate() + 1)
  }

  return dates
}

/** KPIトレンドを計算する */
function calculateTrend(
  metric: string,
  currentValue: number,
  previousValue: number,
  higherIsBetter: boolean = true
): KPITrend {
  const change = currentValue - previousValue
  const changePercent = previousValue !== 0
    ? (change / previousValue) * 100
    : currentValue > 0 ? 100 : 0

  let trend: KPITrend['trend']
  if (Math.abs(changePercent) < 1) {
    trend = 'flat'
  } else if (change > 0) {
    trend = 'up'
  } else {
    trend = 'down'
  }

  const isPositive = higherIsBetter ? change >= 0 : change <= 0

  return {
    metric,
    currentValue,
    previousValue,
    change,
    changePercent: Math.round(changePercent * 10) / 10,
    trend,
    isPositive,
  }
}

/** コスト効率を評価する */
function evaluateCostEfficiency(revenuePerCostUsd: number): AICostEfficiency['efficiency'] {
  // 1 USD のAIコストで何円の収益を生むか
  if (revenuePerCostUsd >= 5000) return 'excellent'  // 1USD → 5000円以上
  if (revenuePerCostUsd >= 2000) return 'good'       // 1USD → 2000円以上
  if (revenuePerCostUsd >= 500) return 'acceptable'   // 1USD → 500円以上
  return 'poor'
}

// ============================================================
// WeeklyReportGenerator クラス
// ============================================================

/**
 * 週次レポートジェネレーター
 *
 * @example
 * ```ts
 * const generator = new WeeklyReportGenerator()
 * const report = await generator.generate('2026-02-24', '2026-03-02')
 * const markdown = generator.formatAsMarkdown(report)
 * ```
 */
export class WeeklyReportGenerator {
  /** KGI: 月次収益目標 (円) */
  private readonly monthlyRevenueTarget: number

  constructor(monthlyRevenueTarget: number = 300000) {
    this.monthlyRevenueTarget = monthlyRevenueTarget
  }

  /**
   * 週次レポートを生成する
   *
   * @param weekStartDate 週の開始日 (YYYY-MM-DD)
   * @param weekEndDate 週の終了日 (YYYY-MM-DD)
   * @param overrides テスト用に日次レポートを直接渡す
   */
  async generate(
    weekStartDate: string,
    weekEndDate: string,
    overrides?: {
      currentWeekReports?: DailyReport[]
      previousWeekReports?: DailyReport[]
      categoryPerformance?: CategoryPerformance[]
      monthlyProgress?: MonthlyTargetProgress
    }
  ): Promise<WeeklyReport> {
    const now = new Date().toISOString()
    const dailyGenerator = new DailyReportGenerator()

    // 今週の日次レポートを集約
    const currentWeekReports = overrides?.currentWeekReports
      ?? await this.collectDailyReports(weekStartDate, weekEndDate, dailyGenerator)

    // 先週の日次レポートを集約（比較用）
    const prevStart = subtractDays(weekStartDate, 7)
    const prevEnd = subtractDays(weekEndDate, 7)
    const previousWeekReports = overrides?.previousWeekReports
      ?? await this.collectDailyReports(prevStart, prevEnd, dailyGenerator)

    // KPIトレンド算出
    const kpiTrends = this.calculateKPITrends(currentWeekReports, previousWeekReports)

    // カテゴリ別パフォーマンス
    const categoryPerformance = overrides?.categoryPerformance
      ?? await this.fetchCategoryPerformance()

    // 月次目標進捗
    const monthlyProgress = overrides?.monthlyProgress
      ?? await this.calculateMonthlyProgress(weekEndDate, currentWeekReports)

    // AIコスト効率
    const costEfficiency = this.calculateCostEfficiency(currentWeekReports, previousWeekReports)

    // サマリーテキスト生成
    const summary = this.generateSummary(kpiTrends, monthlyProgress, costEfficiency)

    return {
      weekStartDate,
      weekEndDate,
      generatedAt: now,
      kpiTrends,
      categoryPerformance,
      monthlyProgress,
      costEfficiency,
      dailySummaries: currentWeekReports,
      summary,
    }
  }

  /**
   * 日次レポートを日付範囲で収集する
   */
  private async collectDailyReports(
    startDate: string,
    endDate: string,
    generator: DailyReportGenerator
  ): Promise<DailyReport[]> {
    const dates = getDateRange(startDate, endDate)
    const reports: DailyReport[] = []

    for (const date of dates) {
      try {
        const report = await generator.generate(date)
        reports.push(report)
      } catch (err) {
        console.error(`[WeeklyReport] Failed to generate daily report for ${date}:`, err)
      }
    }

    return reports
  }

  /**
   * KPIトレンドを算出する
   */
  private calculateKPITrends(
    current: DailyReport[],
    previous: DailyReport[]
  ): KPITrend[] {
    // 今週・先週の集計
    const currentRevenue = current.reduce((sum, r) => sum + r.revenue.totalRevenue, 0)
    const previousRevenue = previous.reduce((sum, r) => sum + r.revenue.totalRevenue, 0)

    const currentConversions = current.reduce((sum, r) => sum + r.revenue.totalConversions, 0)
    const previousConversions = previous.reduce((sum, r) => sum + r.revenue.totalConversions, 0)

    const currentClicks = current.reduce((sum, r) => sum + r.revenue.totalClicks, 0)
    const previousClicks = previous.reduce((sum, r) => sum + r.revenue.totalClicks, 0)

    const currentArticles = current.reduce((sum, r) => sum + r.articles.publishedCount, 0)
    const previousArticles = previous.reduce((sum, r) => sum + r.articles.publishedCount, 0)

    const currentCost = current.reduce((sum, r) => sum + r.cost.totalCostUsd, 0)
    const previousCost = previous.reduce((sum, r) => sum + r.cost.totalCostUsd, 0)

    const currentAlerts = current.length > 0
      ? current[current.length - 1].compliance.activeAlertCount
      : 0
    const previousAlerts = previous.length > 0
      ? previous[previous.length - 1].compliance.activeAlertCount
      : 0

    return [
      calculateTrend('収益 (円)', currentRevenue, previousRevenue, true),
      calculateTrend('コンバージョン', currentConversions, previousConversions, true),
      calculateTrend('クリック数', currentClicks, previousClicks, true),
      calculateTrend('公開記事数', currentArticles, previousArticles, true),
      calculateTrend('AIコスト (USD)', currentCost, previousCost, false),
      calculateTrend('アクティブアラート', currentAlerts, previousAlerts, false),
    ]
  }

  /**
   * カテゴリ別パフォーマンスを取得する
   */
  private async fetchCategoryPerformance(): Promise<CategoryPerformance[]> {
    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('article_performance')
        .select('category,pageviews,revenue,health_score')

      if (error || !data) {
        return this.defaultCategoryPerformance()
      }

      type PerfRow = { category: string; pageviews: number; revenue: number; health_score: number }
      const rows = data as PerfRow[]

      // カテゴリ別に集計
      const categoryMap = new Map<string, {
        articleCount: number
        totalPageviews: number
        totalRevenue: number
        healthScores: number[]
      }>()

      for (const row of rows) {
        const existing = categoryMap.get(row.category) ?? {
          articleCount: 0, totalPageviews: 0, totalRevenue: 0, healthScores: [],
        }
        existing.articleCount++
        existing.totalPageviews += row.pageviews ?? 0
        existing.totalRevenue += row.revenue ?? 0
        if (row.health_score != null) {
          existing.healthScores.push(row.health_score)
        }
        categoryMap.set(row.category, existing)
      }

      return Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        articleCount: data.articleCount,
        totalPageviews: data.totalPageviews,
        totalRevenue: data.totalRevenue,
        avgHealthScore: data.healthScores.length > 0
          ? Math.round(data.healthScores.reduce((a, b) => a + b, 0) / data.healthScores.length)
          : 0,
        revenuePerArticle: data.articleCount > 0
          ? Math.round(data.totalRevenue / data.articleCount)
          : 0,
      })).sort((a, b) => b.totalRevenue - a.totalRevenue)
    } catch {
      return this.defaultCategoryPerformance()
    }
  }

  /**
   * 月次目標進捗を計算する
   */
  private async calculateMonthlyProgress(
    currentDate: string,
    _currentWeekReports: DailyReport[]
  ): Promise<MonthlyTargetProgress> {
    let currentMonthRevenue = 0

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      const monthStart = currentDate.substring(0, 7) + '-01'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('asp_revenue')
        .select('revenue')
        .gte('date', monthStart)
        .lte('date', currentDate)

      if (!error && data) {
        type RevenueRow = { revenue: number }
        currentMonthRevenue = (data as RevenueRow[]).reduce((sum, r) => sum + (r.revenue ?? 0), 0)
      }
    } catch {
      // フォールバック: 今週のレポートから推計
      currentMonthRevenue = 0
    }

    const remainingDays = getRemainingDaysInMonth(currentDate)
    const remainingTarget = this.monthlyRevenueTarget - currentMonthRevenue
    const requiredDailyRevenue = remainingDays > 0 ? Math.ceil(remainingTarget / remainingDays) : 0

    return {
      currentMonthRevenue,
      monthlyTarget: this.monthlyRevenueTarget,
      achievementRate: Math.round((currentMonthRevenue / this.monthlyRevenueTarget) * 100 * 10) / 10,
      remainingDays,
      requiredDailyRevenue: Math.max(0, requiredDailyRevenue),
      momChangePercent: 0, // 先月比は別途計算が必要（ここではプレースホルダー）
    }
  }

  /**
   * AIコスト効率を計算する
   */
  private calculateCostEfficiency(
    current: DailyReport[],
    previous: DailyReport[]
  ): AICostEfficiency {
    const totalCostUsd = current.reduce((sum, r) => sum + r.cost.totalCostUsd, 0)
    const articleCount = current.reduce((sum, r) => sum + r.articles.generatedCount, 0)
    const totalRevenue = current.reduce((sum, r) => sum + r.revenue.totalRevenue, 0)
    const previousCost = previous.reduce((sum, r) => sum + r.cost.totalCostUsd, 0)

    const costPerArticle = articleCount > 0 ? totalCostUsd / articleCount : 0
    const revenuePerCostUsd = totalCostUsd > 0 ? totalRevenue / totalCostUsd : 0
    const costChangePercent = previousCost > 0
      ? ((totalCostUsd - previousCost) / previousCost) * 100
      : 0

    return {
      totalCostUsd,
      articleCount,
      costPerArticle: Math.round(costPerArticle * 100) / 100,
      revenuePerCostUsd: Math.round(revenuePerCostUsd),
      costChangePercent: Math.round(costChangePercent * 10) / 10,
      efficiency: evaluateCostEfficiency(revenuePerCostUsd),
    }
  }

  /**
   * 週次サマリーテキストを生成する
   */
  private generateSummary(
    kpiTrends: KPITrend[],
    monthlyProgress: MonthlyTargetProgress,
    costEfficiency: AICostEfficiency
  ): string {
    const parts: string[] = []

    // 収益トレンド
    const revenueTrend = kpiTrends.find((k) => k.metric === '収益 (円)')
    if (revenueTrend) {
      const arrow = revenueTrend.trend === 'up' ? '+' : revenueTrend.trend === 'down' ? '' : ''
      parts.push(`収益: ${revenueTrend.currentValue.toLocaleString()}円 (${arrow}${revenueTrend.changePercent}%)`)
    }

    // 月次目標
    parts.push(`月次目標達成率: ${monthlyProgress.achievementRate}% (残${monthlyProgress.remainingDays}日)`)
    if (monthlyProgress.requiredDailyRevenue > 0) {
      parts.push(`目標達成に必要な日次収益: ${monthlyProgress.requiredDailyRevenue.toLocaleString()}円/日`)
    }

    // コスト効率
    const efficiencyLabel = {
      excellent: '非常に高い',
      good: '良好',
      acceptable: '普通',
      poor: '改善必要',
    }[costEfficiency.efficiency]
    parts.push(`AIコスト効率: ${efficiencyLabel} (1USD→${costEfficiency.revenuePerCostUsd}円)`)

    return parts.join('\n')
  }

  /**
   * レポートをマークダウン形式にフォーマットする
   */
  formatAsMarkdown(report: WeeklyReport): string {
    const lines: string[] = []

    lines.push(`# MENS CATALY 週次レポート`)
    lines.push(`期間: ${report.weekStartDate} 〜 ${report.weekEndDate}`)
    lines.push('')

    // KPIトレンド
    lines.push('## KPIトレンド（7日間比較）')
    lines.push('| 指標 | 今週 | 先週 | 変化 | 変化率 |')
    lines.push('|------|------|------|------|--------|')
    for (const trend of report.kpiTrends) {
      const arrow = trend.isPositive ? (trend.trend === 'flat' ? '-' : '+') : (trend.trend === 'flat' ? '-' : '!')
      const currentStr = typeof trend.currentValue === 'number'
        ? trend.currentValue.toLocaleString()
        : String(trend.currentValue)
      const previousStr = typeof trend.previousValue === 'number'
        ? trend.previousValue.toLocaleString()
        : String(trend.previousValue)
      lines.push(
        `| ${trend.metric} | ${currentStr} | ${previousStr} | ${trend.change >= 0 ? '+' : ''}${trend.change.toLocaleString()} | ${arrow}${trend.changePercent}% |`
      )
    }
    lines.push('')

    // カテゴリ別パフォーマンス
    if (report.categoryPerformance.length > 0) {
      lines.push('## カテゴリ別パフォーマンス')
      lines.push('| カテゴリ | 記事数 | PV | 収益(円) | 平均HS | 記事あたり収益 |')
      lines.push('|----------|--------|-----|----------|--------|----------------|')
      for (const cat of report.categoryPerformance) {
        lines.push(
          `| ${cat.category} | ${cat.articleCount} | ${cat.totalPageviews.toLocaleString()} | ${cat.totalRevenue.toLocaleString()} | ${cat.avgHealthScore} | ${cat.revenuePerArticle.toLocaleString()} |`
        )
      }
      lines.push('')
    }

    // 月次目標進捗
    lines.push('## 月次目標進捗')
    const mp = report.monthlyProgress
    lines.push(`- 月次目標: ${mp.monthlyTarget.toLocaleString()}円`)
    lines.push(`- 今月累計: ${mp.currentMonthRevenue.toLocaleString()}円`)
    lines.push(`- 達成率: ${mp.achievementRate}%`)
    lines.push(`- 残り日数: ${mp.remainingDays}日`)
    if (mp.requiredDailyRevenue > 0) {
      lines.push(`- 必要日次収益: ${mp.requiredDailyRevenue.toLocaleString()}円/日`)
    }
    lines.push('')

    // AIコスト効率
    lines.push('## AIコスト効率')
    const ce = report.costEfficiency
    lines.push(`- 週間コスト: $${ce.totalCostUsd.toFixed(2)}`)
    lines.push(`- 生成記事数: ${ce.articleCount}件`)
    lines.push(`- 記事あたりコスト: $${ce.costPerArticle.toFixed(2)}`)
    lines.push(`- 収益/コスト比: ${ce.revenuePerCostUsd}円/USD`)
    lines.push(`- コスト効率: ${ce.efficiency}`)
    lines.push(`- 先週比コスト変化: ${ce.costChangePercent >= 0 ? '+' : ''}${ce.costChangePercent}%`)
    lines.push('')

    // サマリー
    lines.push('## サマリー')
    lines.push(report.summary)
    lines.push('')

    lines.push('---')
    lines.push(`生成日時: ${report.generatedAt}`)

    return lines.join('\n')
  }

  /**
   * デフォルトのカテゴリパフォーマンス
   */
  private defaultCategoryPerformance(): CategoryPerformance[] {
    return ['aga', 'hair-removal', 'skincare', 'ed'].map((category) => ({
      category,
      articleCount: 0,
      totalPageviews: 0,
      totalRevenue: 0,
      avgHealthScore: 0,
      revenuePerArticle: 0,
    }))
  }
}
