/**
 * AI記事プランナー
 * アーキテクチャ定義: 日次5記事新規 + 3記事改善をAIが自動選定
 * トレンドスコア × 検索ボリューム × 収益ポテンシャル で優先度を算出
 */

import type { KeywordTarget, KeywordPriority } from '@/types/batch-generation'
import type { ContentCategory } from '@/types/content'
import { KEYWORD_TARGETS } from '@/lib/content/keywords/targets'
import { calculateHealthScore, type HealthScoreInput, type HealthScore } from './health-score'

// ============================================================
// 型定義
// ============================================================

/** 日次記事プラン */
export interface DailyArticlePlan {
  /** 新規作成対象キーワード（最大5件） */
  newArticles: PlannedNewArticle[]
  /** 改善対象記事（最大3件） */
  improvementArticles: PlannedImprovementArticle[]
  /** プラン作成日時 (ISO 8601) */
  plannedAt: string
  /** プラン作成理由（AI分析サマリー） */
  summary: string
}

/** 新規記事プラン */
export interface PlannedNewArticle {
  /** キーワードターゲット */
  keyword: KeywordTarget
  /** 優先度スコア (0-100) */
  priorityScore: number
  /** 選定理由 */
  reason: string
}

/** 改善記事プラン */
export interface PlannedImprovementArticle {
  /** 記事ID */
  articleId: string
  /** 記事タイトル */
  title: string
  /** 改善理由 */
  reason: string
  /** ヘルススコア */
  healthScore: HealthScore
  /** 推奨アクション */
  recommendedActions: string[]
}

/** 既存記事情報（改善対象の判定に使用） */
export interface ExistingArticleInfo {
  articleId: string
  title: string
  keyword: string
  category: ContentCategory
  publishedAt: string
  /** ヘルススコア入力データ（GSC/GA4/ASPから取得） */
  healthScoreInput: HealthScoreInput
}

/** トレンドデータ（pytrends等から取得） */
export interface TrendDataInput {
  keyword: string
  /** トレンドスコア (0-100, Google Trends相対値) */
  trendScore: number
  /** トレンド上昇中かどうか */
  isRising: boolean
}

/** プランナー設定 */
export interface ArticlePlannerConfig {
  /** 新規記事の日次上限（デフォルト: 5） */
  maxNewArticles: number
  /** 改善記事の日次上限（デフォルト: 3） */
  maxImprovementArticles: number
  /** 改善対象のヘルススコア閾値（デフォルト: 60） */
  improvementThreshold: number
  /** 既に記事が存在するキーワードを除外するか */
  excludeExistingKeywords: boolean
}

// ============================================================
// 優先度スコア算出
// ============================================================

/**
 * 優先度スコアの重み定義
 * アーキテクチャ仕様: trend_score * 0.3 + search_volume_normalized * 0.3 + revenue_potential * 0.4
 */
const PRIORITY_WEIGHTS = {
  trendScore: 0.3,
  searchVolumeNormalized: 0.3,
  revenuePotential: 0.4,
} as const

/** KeywordPriority を数値に変換（収益ポテンシャルの一部として使用） */
function priorityToScore(priority: KeywordPriority): number {
  switch (priority) {
    case 'high': return 80
    case 'medium': return 50
    case 'low': return 20
  }
}

/**
 * 検索ボリュームを 0-100 に正規化する
 * 全キーワードの最大値を基準にスケーリング
 */
function normalizeSearchVolume(volume: number, maxVolume: number): number {
  if (maxVolume <= 0) return 0
  return Math.min(100, Math.round((volume / maxVolume) * 100))
}

/**
 * カテゴリの収益ポテンシャルを算出する
 * 報酬単価の高いカテゴリほどスコアが高い
 */
function getCategoryRevenuePotential(category: ContentCategory): number {
  // ASP報酬平均の相対評価
  const categoryScores: Record<ContentCategory, number> = {
    'hair-removal': 85,  // 脱毛は報酬単価が高い
    aga: 75,             // AGA治療も高報酬
    ed: 70,              // ED治療
    skincare: 55,        // スキンケアは比較的低め
  }
  return categoryScores[category]
}

/**
 * キーワードの優先度スコアを計算する
 * @returns 0-100 のスコア
 */
function calculatePriorityScore(
  keyword: KeywordTarget,
  trendScore: number,
  maxSearchVolume: number
): number {
  const normalizedVolume = normalizeSearchVolume(keyword.searchVolume, maxSearchVolume)
  const revenuePotential = (
    priorityToScore(keyword.priority) * 0.5 +
    getCategoryRevenuePotential(keyword.category) * 0.5
  )

  const score = (
    trendScore * PRIORITY_WEIGHTS.trendScore +
    normalizedVolume * PRIORITY_WEIGHTS.searchVolumeNormalized +
    revenuePotential * PRIORITY_WEIGHTS.revenuePotential
  )

  return Math.min(100, Math.round(score))
}

// ============================================================
// ArticlePlanner クラス
// ============================================================

/**
 * AI記事プランナー
 *
 * @example
 * ```ts
 * const planner = new ArticlePlanner()
 * const plan = await planner.planDailyArticles({
 *   existingArticles: [...],
 *   trendData: [...],
 * })
 * console.log(plan.newArticles.length)        // 最大5
 * console.log(plan.improvementArticles.length) // 最大3
 * ```
 */
export class ArticlePlanner {
  private readonly config: ArticlePlannerConfig

  constructor(config: Partial<ArticlePlannerConfig> = {}) {
    this.config = {
      maxNewArticles: config.maxNewArticles ?? 5,
      maxImprovementArticles: config.maxImprovementArticles ?? 3,
      improvementThreshold: config.improvementThreshold ?? 60,
      excludeExistingKeywords: config.excludeExistingKeywords ?? true,
    }
  }

  /**
   * 日次記事プランを作成する
   *
   * @param params.existingArticles 既存記事の情報（改善対象の判定に使用）
   * @param params.trendData トレンドデータ（キーワードのトレンドスコア）
   * @param params.customKeywords カスタムキーワードリスト（省略時は KEYWORD_TARGETS を使用）
   * @returns 日次記事プラン
   */
  async planDailyArticles(params: {
    existingArticles?: ExistingArticleInfo[]
    trendData?: TrendDataInput[]
    customKeywords?: KeywordTarget[]
  } = {}): Promise<DailyArticlePlan> {
    const {
      existingArticles = [],
      trendData = [],
      customKeywords,
    } = params

    const now = new Date().toISOString()

    // 新規記事の選定
    const newArticles = this.selectNewArticles(
      customKeywords ?? KEYWORD_TARGETS,
      existingArticles,
      trendData
    )

    // 改善記事の選定
    const improvementArticles = this.selectImprovementArticles(existingArticles)

    // プランサマリーを生成
    const summary = this.generatePlanSummary(newArticles, improvementArticles)

    return {
      newArticles,
      improvementArticles,
      plannedAt: now,
      summary,
    }
  }

  /**
   * 新規記事の候補を選定する
   */
  private selectNewArticles(
    keywords: KeywordTarget[],
    existingArticles: ExistingArticleInfo[],
    trendData: TrendDataInput[]
  ): PlannedNewArticle[] {
    // 既存記事のキーワードセットを構築
    const existingKeywords = new Set(
      existingArticles.map((a) => a.keyword.toLowerCase())
    )

    // トレンドデータをMapに変換
    const trendMap = new Map(
      trendData.map((t) => [t.keyword.toLowerCase(), t])
    )

    // 最大検索ボリュームを算出（正規化用）
    const maxSearchVolume = Math.max(...keywords.map((k) => k.searchVolume), 1)

    // 候補をスコアリング
    const candidates = keywords
      .filter((kw) => {
        // 既存キーワードを除外（設定による）
        if (this.config.excludeExistingKeywords) {
          return !existingKeywords.has(kw.keyword.toLowerCase())
        }
        return true
      })
      .map((kw) => {
        // トレンドスコアを取得（データがない場合はデフォルト50）
        const trend = trendMap.get(kw.keyword.toLowerCase())
        const trendScore = trend?.trendScore ?? 50

        const priorityScore = calculatePriorityScore(kw, trendScore, maxSearchVolume)

        // 選定理由を構築
        const reasons: string[] = []
        if (trend?.isRising) {
          reasons.push(`トレンド上昇中 (スコア: ${trendScore})`)
        }
        if (kw.priority === 'high') {
          reasons.push('高優先度キーワード')
        }
        if (kw.searchVolume >= 5000) {
          reasons.push(`検索ボリューム: ${kw.searchVolume.toLocaleString()}`)
        }
        const revPotential = getCategoryRevenuePotential(kw.category)
        if (revPotential >= 70) {
          reasons.push(`高収益カテゴリ (${kw.category})`)
        }

        return {
          keyword: kw,
          priorityScore,
          reason: reasons.length > 0
            ? reasons.join(' / ')
            : `総合優先度スコア: ${priorityScore}`,
        }
      })
      // スコア降順でソート
      .sort((a, b) => b.priorityScore - a.priorityScore)

    // 上限まで選出
    return candidates.slice(0, this.config.maxNewArticles)
  }

  /**
   * 改善対象記事を選定する
   * ヘルススコアが閾値以下の記事をスコア昇順で選定
   */
  private selectImprovementArticles(
    existingArticles: ExistingArticleInfo[]
  ): PlannedImprovementArticle[] {
    if (existingArticles.length === 0) return []

    // ヘルススコアを計算し、閾値以下をフィルタ
    const candidates = existingArticles
      .map((article) => {
        const healthScore = calculateHealthScore(article.healthScoreInput)
        return { article, healthScore }
      })
      .filter(({ healthScore }) => healthScore.total < this.config.improvementThreshold)
      // スコアが低い順（改善の緊急度が高い順）
      .sort((a, b) => a.healthScore.total - b.healthScore.total)

    // 上限まで選出し、改善プランを構築
    return candidates
      .slice(0, this.config.maxImprovementArticles)
      .map(({ article, healthScore }) => {
        // 改善理由の構築
        const reasons: string[] = []
        if (healthScore.seoScore < 15) {
          reasons.push('SEOスコアが低い')
        }
        if (healthScore.uxScore < 10) {
          reasons.push('UX指標が低い')
        }
        if (healthScore.revenueScore < 10) {
          reasons.push('収益パフォーマンスが低い')
        }
        if (healthScore.status === 'critical') {
          reasons.push('総合スコアがクリティカル')
        }

        return {
          articleId: article.articleId,
          title: article.title,
          reason: reasons.join(' / ') || `ヘルススコア ${healthScore.total} (閾値: ${this.config.improvementThreshold})`,
          healthScore,
          recommendedActions: healthScore.recommendations,
        }
      })
  }

  /**
   * プランサマリーを生成する
   */
  private generatePlanSummary(
    newArticles: PlannedNewArticle[],
    improvementArticles: PlannedImprovementArticle[]
  ): string {
    const parts: string[] = []

    parts.push(`新規記事: ${newArticles.length}件`)

    if (newArticles.length > 0) {
      // カテゴリ別の内訳
      const categoryCount = new Map<string, number>()
      for (const article of newArticles) {
        const cat = article.keyword.category
        categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1)
      }
      const categoryBreakdown = Array.from(categoryCount.entries())
        .map(([cat, count]) => `${cat}: ${count}件`)
        .join(', ')
      parts.push(`  カテゴリ内訳: ${categoryBreakdown}`)

      // 最高スコアのキーワード
      const topKeyword = newArticles[0]
      parts.push(`  最高優先度: 「${topKeyword.keyword.keyword}」(スコア: ${topKeyword.priorityScore})`)
    }

    parts.push(`改善記事: ${improvementArticles.length}件`)

    if (improvementArticles.length > 0) {
      const criticalCount = improvementArticles.filter(
        (a) => a.healthScore.status === 'critical'
      ).length
      if (criticalCount > 0) {
        parts.push(`  うちクリティカル: ${criticalCount}件`)
      }
    }

    return parts.join('\n')
  }

  /**
   * カテゴリバランスを考慮した記事プランを作成する
   * 特定カテゴリに偏らないよう、各カテゴリから最低1件ずつ選出する
   */
  async planBalancedArticles(params: {
    existingArticles?: ExistingArticleInfo[]
    trendData?: TrendDataInput[]
  } = {}): Promise<DailyArticlePlan> {
    const {
      existingArticles = [],
      trendData = [],
    } = params

    const categories: ContentCategory[] = ['aga', 'hair-removal', 'skincare', 'ed']
    const existingKeywords = new Set(
      existingArticles.map((a) => a.keyword.toLowerCase())
    )
    const trendMap = new Map(
      trendData.map((t) => [t.keyword.toLowerCase(), t])
    )
    const maxSearchVolume = Math.max(...KEYWORD_TARGETS.map((k) => k.searchVolume), 1)

    const selectedNewArticles: PlannedNewArticle[] = []

    // 各カテゴリから最低1件選出
    for (const category of categories) {
      if (selectedNewArticles.length >= this.config.maxNewArticles) break

      const categoryKeywords = KEYWORD_TARGETS
        .filter((kw) => kw.category === category)
        .filter((kw) => !this.config.excludeExistingKeywords || !existingKeywords.has(kw.keyword.toLowerCase()))

      if (categoryKeywords.length === 0) continue

      // カテゴリ内で最もスコアが高いものを選出
      const best = categoryKeywords
        .map((kw) => {
          const trend = trendMap.get(kw.keyword.toLowerCase())
          const trendScore = trend?.trendScore ?? 50
          return {
            keyword: kw,
            priorityScore: calculatePriorityScore(kw, trendScore, maxSearchVolume),
            reason: `カテゴリバランス選出 (${category})`,
          }
        })
        .sort((a, b) => b.priorityScore - a.priorityScore)[0]

      if (best) {
        selectedNewArticles.push(best)
        existingKeywords.add(best.keyword.keyword.toLowerCase()) // 重複防止
      }
    }

    // 残りの枠をスコア順で埋める
    if (selectedNewArticles.length < this.config.maxNewArticles) {
      const remainingCount = this.config.maxNewArticles - selectedNewArticles.length
      const selectedIds = new Set(selectedNewArticles.map((a) => a.keyword.id))

      const remaining = KEYWORD_TARGETS
        .filter((kw) => !selectedIds.has(kw.id))
        .filter((kw) => !this.config.excludeExistingKeywords || !existingKeywords.has(kw.keyword.toLowerCase()))
        .map((kw) => {
          const trend = trendMap.get(kw.keyword.toLowerCase())
          const trendScore = trend?.trendScore ?? 50
          return {
            keyword: kw,
            priorityScore: calculatePriorityScore(kw, trendScore, maxSearchVolume),
            reason: `スコア順選出 (優先度: ${kw.priority})`,
          }
        })
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, remainingCount)

      selectedNewArticles.push(...remaining)
    }

    // 改善記事の選定
    const improvementArticles = this.selectImprovementArticles(existingArticles)

    return {
      newArticles: selectedNewArticles,
      improvementArticles,
      plannedAt: new Date().toISOString(),
      summary: this.generatePlanSummary(selectedNewArticles, improvementArticles),
    }
  }
}
