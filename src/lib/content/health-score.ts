/**
 * 記事ヘルススコアシステム
 * 順位変動 + UX品質 + ASP CTR/CV率 → 総合スコア (0-100)
 * アーキテクチャ図のHealth Score概念を実装
 */

// ============================================================
// 型定義
// ============================================================

/** ヘルススコア入力データ */
export interface HealthScoreInput {
  articleId: string
  // SEO メトリクス
  rankingPosition: number | null     // GSC 平均順位
  rankingChange7d: number | null     // 7日間の順位変動（負が改善）
  ctr: number | null                 // クリックスルー率 (0-1)
  impressions: number | null         // インプレッション数
  // UX メトリクス
  avgSessionDuration: number | null  // 平均セッション時間（秒）
  bounceRate: number | null          // 直帰率 (0-1)
  pageviews7d: number | null         // 7日間のPV数
  // 収益メトリクス
  aspClicks: number | null           // ASPクリック数
  aspConversions: number | null      // ASPコンバージョン数
  aspRevenue: number | null          // ASP収益（円）
}

/** ヘルススコア結果 */
export interface HealthScore {
  /** 総合スコア (0-100) */
  total: number
  /** SEOスコア (0-40) */
  seoScore: number
  /** UXスコア (0-30) */
  uxScore: number
  /** 収益スコア (0-30) */
  revenueScore: number
  /** ステータス判定 */
  status: 'healthy' | 'needs_improvement' | 'critical'
  /** 改善推奨事項 */
  recommendations: string[]
}

// ============================================================
// SEOスコア算出 (最大40点)
// ============================================================

/** SEOスコアの内部重み */
const SEO_WEIGHTS = {
  ranking: 15,        // 順位スコア（最大15点）
  rankingTrend: 10,   // 順位変動トレンド（最大10点）
  ctr: 10,            // CTRスコア（最大10点）
  impressions: 5,     // インプレッションスコア（最大5点）
} as const

/**
 * 検索順位をスコアに変換する
 * 1位 = 15点、3位以内 = 12点、10位以内 = 8点、20位以内 = 4点、それ以降 = 1点
 */
function scoreRanking(position: number | null): number {
  if (position === null) return 0
  if (position <= 1) return SEO_WEIGHTS.ranking
  if (position <= 3) return 12
  if (position <= 5) return 10
  if (position <= 10) return 8
  if (position <= 20) return 4
  if (position <= 50) return 2
  return 1
}

/**
 * 順位変動トレンドをスコアに変換する
 * 大幅改善 (>5位上昇) = 10点、改善 (1-5) = 7点、横ばい = 5点、悪化 = 2点
 */
function scoreRankingTrend(change7d: number | null): number {
  if (change7d === null) return 0
  // 負の値 = 順位改善（例: -5 は5位上昇）
  if (change7d <= -5) return SEO_WEIGHTS.rankingTrend
  if (change7d < 0) return 7
  if (change7d === 0) return 5
  if (change7d <= 3) return 3
  return 1 // 大幅悪化
}

/**
 * CTRをスコアに変換する
 * GSC平均CTRの目安: 1位=30%前後、10位=2%前後
 */
function scoreCTR(ctr: number | null): number {
  if (ctr === null) return 0
  if (ctr >= 0.15) return SEO_WEIGHTS.ctr        // 15%以上: 上位表示
  if (ctr >= 0.08) return 8
  if (ctr >= 0.04) return 6
  if (ctr >= 0.02) return 4
  if (ctr >= 0.01) return 2
  return 1
}

/**
 * インプレッション数をスコアに変換する
 */
function scoreImpressions(impressions: number | null): number {
  if (impressions === null) return 0
  if (impressions >= 10000) return SEO_WEIGHTS.impressions
  if (impressions >= 5000) return 4
  if (impressions >= 1000) return 3
  if (impressions >= 100) return 2
  return 1
}

function calculateSEOScore(input: HealthScoreInput): number {
  return (
    scoreRanking(input.rankingPosition) +
    scoreRankingTrend(input.rankingChange7d) +
    scoreCTR(input.ctr) +
    scoreImpressions(input.impressions)
  )
}

// ============================================================
// UXスコア算出 (最大30点)
// ============================================================

const UX_WEIGHTS = {
  sessionDuration: 12,  // セッション時間（最大12点）
  bounceRate: 10,       // 直帰率（最大10点）
  pageviews: 8,         // PV数（最大8点）
} as const

/**
 * 平均セッション時間をスコアに変換する
 * 3分以上 = 12点、2分 = 9点、1分 = 6点、30秒 = 3点
 */
function scoreSessionDuration(seconds: number | null): number {
  if (seconds === null) return 0
  if (seconds >= 180) return UX_WEIGHTS.sessionDuration
  if (seconds >= 120) return 9
  if (seconds >= 60) return 6
  if (seconds >= 30) return 3
  return 1
}

/**
 * 直帰率をスコアに変換する（低いほど良い）
 * 30%以下 = 10点、50% = 7点、70% = 4点、90%+ = 1点
 */
function scoreBounceRate(bounceRate: number | null): number {
  if (bounceRate === null) return 0
  if (bounceRate <= 0.30) return UX_WEIGHTS.bounceRate
  if (bounceRate <= 0.50) return 7
  if (bounceRate <= 0.70) return 4
  if (bounceRate <= 0.85) return 2
  return 1
}

/**
 * 7日間PV数をスコアに変換する
 */
function scorePageviews7d(pageviews: number | null): number {
  if (pageviews === null) return 0
  if (pageviews >= 1000) return UX_WEIGHTS.pageviews
  if (pageviews >= 500) return 6
  if (pageviews >= 100) return 4
  if (pageviews >= 30) return 2
  return 1
}

function calculateUXScore(input: HealthScoreInput): number {
  return (
    scoreSessionDuration(input.avgSessionDuration) +
    scoreBounceRate(input.bounceRate) +
    scorePageviews7d(input.pageviews7d)
  )
}

// ============================================================
// 収益スコア算出 (最大30点)
// ============================================================

const REVENUE_WEIGHTS = {
  aspClicks: 8,        // ASPクリック数（最大8点）
  aspConversions: 12,  // コンバージョン数（最大12点）
  aspRevenue: 10,      // 収益額（最大10点）
} as const

/**
 * ASPクリック数をスコアに変換する
 */
function scoreAspClicks(clicks: number | null): number {
  if (clicks === null) return 0
  if (clicks >= 100) return REVENUE_WEIGHTS.aspClicks
  if (clicks >= 50) return 6
  if (clicks >= 20) return 4
  if (clicks >= 5) return 2
  return 1
}

/**
 * ASPコンバージョン数をスコアに変換する
 */
function scoreAspConversions(conversions: number | null): number {
  if (conversions === null) return 0
  if (conversions >= 10) return REVENUE_WEIGHTS.aspConversions
  if (conversions >= 5) return 9
  if (conversions >= 2) return 6
  if (conversions >= 1) return 4
  return 1
}

/**
 * ASP収益額をスコアに変換する（円）
 */
function scoreAspRevenue(revenue: number | null): number {
  if (revenue === null) return 0
  if (revenue >= 100000) return REVENUE_WEIGHTS.aspRevenue  // 10万円以上
  if (revenue >= 50000) return 8
  if (revenue >= 20000) return 6
  if (revenue >= 5000) return 4
  if (revenue >= 1000) return 2
  return 1
}

function calculateRevenueScore(input: HealthScoreInput): number {
  return (
    scoreAspClicks(input.aspClicks) +
    scoreAspConversions(input.aspConversions) +
    scoreAspRevenue(input.aspRevenue)
  )
}

// ============================================================
// 改善推奨事項の生成
// ============================================================

/**
 * 各サブスコアに基づいた改善推奨事項を生成する
 */
function generateRecommendations(
  seoScore: number,
  uxScore: number,
  revenueScore: number,
  input: HealthScoreInput
): string[] {
  const recommendations: string[] = []

  // SEO関連の推奨事項
  if (seoScore < 20) {
    if (input.rankingPosition === null || input.rankingPosition > 20) {
      recommendations.push('検索順位が低いため、キーワード最適化とコンテンツ拡充を検討してください')
    }
    if (input.ctr !== null && input.ctr < 0.02) {
      recommendations.push('CTRが低いため、タイトルタグとメタディスクリプションの改善を推奨します')
    }
    if (input.rankingChange7d !== null && input.rankingChange7d > 3) {
      recommendations.push('順位が下降傾向です。競合分析とコンテンツの更新を検討してください')
    }
    if (input.impressions !== null && input.impressions < 100) {
      recommendations.push('インプレッション数が少ないため、関連キーワードの追加や内部リンクの強化を推奨します')
    }
  }

  // UX関連の推奨事項
  if (uxScore < 15) {
    if (input.avgSessionDuration !== null && input.avgSessionDuration < 60) {
      recommendations.push('滞在時間が短いため、記事の導入部を改善し、読者の関心を引く構成に変更してください')
    }
    if (input.bounceRate !== null && input.bounceRate > 0.70) {
      recommendations.push('直帰率が高いため、関連記事のリンク追加やCTAの配置見直しを推奨します')
    }
    if (input.pageviews7d !== null && input.pageviews7d < 30) {
      recommendations.push('PV数が低いため、SNSシェアやメルマガでの告知を検討してください')
    }
  }

  // 収益関連の推奨事項
  if (revenueScore < 15) {
    if (input.aspClicks !== null && input.aspClicks < 5) {
      recommendations.push('ASPクリック数が少ないため、CTAボタンの位置と文言を見直してください')
    }
    if (input.aspClicks !== null && input.aspConversions !== null &&
        input.aspClicks > 0 && (input.aspConversions / input.aspClicks) < 0.01) {
      recommendations.push('CVRが低いため、紹介するサービスの訴求ポイントを強化してください')
    }
    if (input.aspRevenue !== null && input.aspRevenue < 1000) {
      recommendations.push('収益が低いため、より報酬単価の高いASPプログラムへの変更を検討してください')
    }
  }

  // スコアが全体的に低い場合の総合的な推奨
  if (seoScore < 15 && uxScore < 10 && revenueScore < 10) {
    recommendations.push('総合的にパフォーマンスが低下しています。記事のリライトまたは非公開化を検討してください')
  }

  return recommendations
}

// ============================================================
// メインのスコア計算関数
// ============================================================

/**
 * 記事のヘルススコアを計算する
 *
 * @param input ヘルススコア入力データ
 * @returns ヘルススコア結果（総合スコア、サブスコア、ステータス、推奨事項）
 *
 * @example
 * ```ts
 * const score = calculateHealthScore({
 *   articleId: 'article-001',
 *   rankingPosition: 8,
 *   rankingChange7d: -2,
 *   ctr: 0.05,
 *   impressions: 3000,
 *   avgSessionDuration: 120,
 *   bounceRate: 0.55,
 *   pageviews7d: 200,
 *   aspClicks: 30,
 *   aspConversions: 3,
 *   aspRevenue: 15000,
 * })
 * console.log(score.total)   // 65
 * console.log(score.status)  // 'needs_improvement'
 * ```
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScore {
  const seoScore = calculateSEOScore(input)
  const uxScore = calculateUXScore(input)
  const revenueScore = calculateRevenueScore(input)

  // 合計を 0-100 にクランプ
  const total = Math.min(100, Math.max(0, seoScore + uxScore + revenueScore))

  // ステータス判定
  let status: HealthScore['status']
  if (total >= 70) {
    status = 'healthy'
  } else if (total >= 40) {
    status = 'needs_improvement'
  } else {
    status = 'critical'
  }

  // 改善推奨事項を生成
  const recommendations = generateRecommendations(seoScore, uxScore, revenueScore, input)

  return {
    total,
    seoScore,
    uxScore,
    revenueScore,
    status,
    recommendations,
  }
}

/**
 * ヘルススコアのステータスラベルを日本語で取得する
 */
export function getHealthStatusLabel(status: HealthScore['status']): string {
  switch (status) {
    case 'healthy':
      return '良好'
    case 'needs_improvement':
      return '改善必要'
    case 'critical':
      return '要注意'
  }
}

/**
 * 複数記事のヘルススコアを一括計算する
 */
export function calculateBatchHealthScores(
  inputs: HealthScoreInput[]
): Map<string, HealthScore> {
  const results = new Map<string, HealthScore>()
  for (const input of inputs) {
    results.set(input.articleId, calculateHealthScore(input))
  }
  return results
}

/**
 * ヘルススコアの分布を集計する
 */
export function getHealthScoreDistribution(
  scores: HealthScore[]
): { healthy: number; needsImprovement: number; critical: number } {
  return {
    healthy: scores.filter((s) => s.status === 'healthy').length,
    needsImprovement: scores.filter((s) => s.status === 'needs_improvement').length,
    critical: scores.filter((s) => s.status === 'critical').length,
  }
}
