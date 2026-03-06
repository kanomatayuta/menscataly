/**
 * パフォーマンスアラートステップ
 * PDCAパイプライン (23:00 JST) で実行される
 *
 * 1. 前ステップのヘルススコア結果を取得
 * 2. 順位下降 (position change > 5) をチェック
 * 3. CTR低下 (閾値以下) をチェック
 * 4. クリティカル記事に対してアラートを作成
 * 5. 改善が必要な記事リストを出力
 */

import type { PipelineContext, PipelineStep } from '../types'
import type { HealthScoreStepOutput, ArticleHealthScore } from './calculate-health-scores'

// ============================================================
// 型定義
// ============================================================

/** パフォーマンスアラートの種類 */
export type PerformanceAlertReason =
  | 'rank_drop'
  | 'ctr_low'
  | 'bounce_rate_high'
  | 'critical_health_score'
  | 'no_pageviews'

/** 改善対象記事 */
export interface ImprovementTarget {
  articleId: string
  title: string
  slug: string
  healthScore: number
  status: 'healthy' | 'needs_improvement' | 'critical'
  reasons: PerformanceAlertReason[]
  recommendations: string[]
  alertId: string | null
}

/** ステップ出力 */
export interface PerformanceAlertsStepOutput {
  targets: ImprovementTarget[]
  alertsCreated: number
  summary: {
    totalChecked: number
    criticalCount: number
    needsImprovementCount: number
    alertsCreated: number
  }
}

// ============================================================
// 閾値定数
// ============================================================

const THRESHOLDS = {
  /** CTR がこの値以下で警告 */
  ctrLow: 0.01,
  /** 直帰率がこの値以上で警告 */
  bounceRateHigh: 0.85,
  /** ヘルススコアがこの値以下で critical アラート */
  healthScoreCritical: 30,
  /** ヘルススコアがこの値以下で needs_improvement */
  healthScoreWarning: 50,
  /** PV がこの値以下で no_pageviews 警告 */
  pageviewsMinimum: 5,
} as const

// ============================================================
// アラート分析ヘルパー
// ============================================================

/**
 * 記事のパフォーマンス問題を分析する
 */
function analyzeArticlePerformance(
  articleScore: ArticleHealthScore
): PerformanceAlertReason[] {
  const reasons: PerformanceAlertReason[] = []
  const input = articleScore.input

  // 1. 順位下降チェック (rankingChange7d > 5 は大幅悪化)
  if (input.rankingChange7d !== null && input.rankingChange7d > 5) {
    reasons.push('rank_drop')
  }

  // 2. CTR 低下チェック
  if (input.ctr !== null && input.ctr < THRESHOLDS.ctrLow) {
    reasons.push('ctr_low')
  }

  // 3. 直帰率チェック
  if (input.bounceRate !== null && input.bounceRate > THRESHOLDS.bounceRateHigh) {
    reasons.push('bounce_rate_high')
  }

  // 4. ヘルススコア critical チェック
  if (articleScore.healthScore.total <= THRESHOLDS.healthScoreCritical) {
    reasons.push('critical_health_score')
  }

  // 5. PV ゼロ/極少チェック
  if (input.pageviews7d !== null && input.pageviews7d < THRESHOLDS.pageviewsMinimum) {
    reasons.push('no_pageviews')
  }

  return reasons
}

/**
 * アラート理由を日本語に変換する
 */
function reasonToLabel(reason: PerformanceAlertReason): string {
  switch (reason) {
    case 'rank_drop':
      return '検索順位が大幅に下降'
    case 'ctr_low':
      return 'CTRが閾値以下'
    case 'bounce_rate_high':
      return '直帰率が高い'
    case 'critical_health_score':
      return 'ヘルススコアがクリティカル'
    case 'no_pageviews':
      return 'PVがほぼゼロ'
  }
}

/**
 * アラートの重大度を判定する
 */
function determineSeverity(
  reasons: PerformanceAlertReason[]
): 'critical' | 'warning' | 'info' {
  if (reasons.includes('critical_health_score') || reasons.includes('rank_drop')) {
    return 'critical'
  }
  if (reasons.length >= 2) {
    return 'warning'
  }
  return 'info'
}

// ============================================================
// ステップ実装
// ============================================================

export const performanceAlertsStep: PipelineStep<unknown, PerformanceAlertsStepOutput> = {
  name: 'performance-alerts',
  description: 'パフォーマンス低下記事を検出してアラートを作成する',
  maxRetries: 1,

  async execute(_input: unknown, context: PipelineContext): Promise<PerformanceAlertsStepOutput> {
    console.log(`[performance-alerts] Starting performance analysis (run: ${context.runId})`)

    // 1. 前ステップのヘルススコアを取得
    const healthScoreData = context.sharedData['healthScores'] as
      | HealthScoreStepOutput
      | undefined

    if (!healthScoreData || healthScoreData.scores.length === 0) {
      console.warn('[performance-alerts] No health score data available — skipping alerts')
      const emptyOutput: PerformanceAlertsStepOutput = {
        targets: [],
        alertsCreated: 0,
        summary: {
          totalChecked: 0,
          criticalCount: 0,
          needsImprovementCount: 0,
          alertsCreated: 0,
        },
      }
      context.sharedData['performanceAlerts'] = emptyOutput
      return emptyOutput
    }

    console.log(
      `[performance-alerts] Analyzing ${healthScoreData.scores.length} articles for performance issues`
    )

    // 2. 各記事のパフォーマンス問題を分析
    const targets: ImprovementTarget[] = []
    let alertsCreated = 0

    // AlertManager を動的インポート
    let alertManager: Awaited<ReturnType<typeof createAlertManager>> | null = null
    try {
      alertManager = await createAlertManager()
    } catch (err) {
      console.error('[performance-alerts] Failed to initialize AlertManager:', err)
    }

    for (const articleScore of healthScoreData.scores) {
      const reasons = analyzeArticlePerformance(articleScore)

      // 問題がある記事のみ対象
      if (reasons.length === 0 && articleScore.healthScore.status === 'healthy') {
        continue
      }

      // 改善必要だが具体的な理由がない場合はヘルススコアの推奨事項を使用
      if (reasons.length === 0 && articleScore.healthScore.status !== 'healthy') {
        // ヘルススコアの status が needs_improvement/critical の場合も記録
      }

      let alertId: string | null = null

      // 3. critical または問題が2つ以上ある記事にはアラートを作成
      if (reasons.length > 0 && alertManager) {
        const severity = determineSeverity(reasons)
        const reasonLabels = reasons.map(reasonToLabel).join(', ')

        // warning 以上でのみアラートを作成
        if (severity === 'critical' || severity === 'warning') {
          try {
            const alert = await alertManager.createAlert(
              {
                type: 'performance_degradation',
                severity,
                title: `パフォーマンス低下: ${articleScore.title}`,
                message: `${reasonLabels} (ヘルススコア: ${articleScore.healthScore.total}/100)`,
                metadata: {
                  articleId: articleScore.articleId,
                  slug: articleScore.slug,
                  healthScore: articleScore.healthScore.total,
                  seoScore: articleScore.healthScore.seoScore,
                  uxScore: articleScore.healthScore.uxScore,
                  revenueScore: articleScore.healthScore.revenueScore,
                  reasons,
                },
              },
              { skipNotification: true } // バッチ処理中は個別通知をスキップ
            )
            alertId = alert.id
            alertsCreated++

            console.log(
              `[performance-alerts] Alert created: "${articleScore.title}" — ${severity} (${reasonLabels})`
            )
          } catch (err) {
            console.error(
              `[performance-alerts] Failed to create alert for "${articleScore.title}":`,
              err
            )
          }
        }
      }

      targets.push({
        articleId: articleScore.articleId,
        title: articleScore.title,
        slug: articleScore.slug,
        healthScore: articleScore.healthScore.total,
        status: articleScore.healthScore.status,
        reasons,
        recommendations: articleScore.healthScore.recommendations,
        alertId,
      })
    }

    // 4. サマリー集計
    const criticalCount = targets.filter((t) => t.status === 'critical').length
    const needsImprovementCount = targets.filter((t) => t.status === 'needs_improvement').length

    const output: PerformanceAlertsStepOutput = {
      targets,
      alertsCreated,
      summary: {
        totalChecked: healthScoreData.scores.length,
        criticalCount,
        needsImprovementCount,
        alertsCreated,
      },
    }

    // 共有データに保存
    context.sharedData['performanceAlerts'] = output

    console.log(
      `[performance-alerts] Completed: checked=${healthScoreData.scores.length}, ` +
      `critical=${criticalCount}, needs_improvement=${needsImprovementCount}, ` +
      `alerts_created=${alertsCreated}`
    )

    return output
  },
}

// ============================================================
// AlertManager ファクトリ (動的インポート)
// ============================================================

async function createAlertManager() {
  const { AlertManager } = await import('@/lib/monitoring/alert-manager')
  return new AlertManager()
}
