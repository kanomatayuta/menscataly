/**
 * キーワードリサーチ ユーティリティ
 * キーワードデータ構造、リサーチ関数、フィルタリング
 */

import type { ContentCategory } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** キーワード難易度レベル */
export type KeywordDifficulty = 'easy' | 'medium' | 'hard'

/** キーワード意図タイプ */
export type SearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational'

/** キーワードリサーチエントリ */
export interface KeywordEntry {
  id: string
  keyword: string
  category: ContentCategory
  searchVolume: number
  difficulty: number
  difficultyLevel: KeywordDifficulty
  trendScore: number
  searchIntent: SearchIntent
  cpc?: number
  competition?: number
  relatedKeywords: string[]
  longTailVariations: string[]
  seasonality?: 'evergreen' | 'seasonal'
  notes?: string
  trackedAt: string
  createdAt: string
  updatedAt: string
}

/** キーワードフィルタ */
export interface KeywordFilter {
  category?: ContentCategory
  difficultyLevel?: KeywordDifficulty
  searchIntent?: SearchIntent
  minVolume?: number
  maxVolume?: number
  minDifficulty?: number
  maxDifficulty?: number
  minTrendScore?: number
  query?: string
  sortBy?: 'volume' | 'difficulty' | 'trend' | 'created'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/** キーワードリサーチ結果 */
export interface KeywordResearchResult {
  keywords: KeywordEntry[]
  total: number
  filters: KeywordFilter
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 難易度スコアからレベルを算出する
 */
export function getDifficultyLevel(difficulty: number): KeywordDifficulty {
  if (difficulty <= 30) return 'easy'
  if (difficulty <= 60) return 'medium'
  return 'hard'
}

/**
 * キーワードに推定検索意図を付与する
 */
export function estimateSearchIntent(keyword: string): SearchIntent {
  const lowerKeyword = keyword.toLowerCase()

  // トランザクション意図: 購入・申込系
  const transactionalPatterns = [
    '購入', '申込', '契約', '予約', '始める', '申し込み', '買う',
    '最安', '割引', 'クーポン', 'キャンペーン', '無料体験',
  ]
  if (transactionalPatterns.some((p) => lowerKeyword.includes(p))) {
    return 'transactional'
  }

  // コマーシャル意図: 比較・ランキング系
  const commercialPatterns = [
    '比較', 'ランキング', 'おすすめ', '口コミ', '評判', 'レビュー',
    'vs', '違い', 'どっち', '選び方', '人気',
  ]
  if (commercialPatterns.some((p) => lowerKeyword.includes(p))) {
    return 'commercial'
  }

  // ナビゲーション意図: ブランド名・クリニック名
  const navigationPatterns = [
    'クリニック', '公式', 'ログイン', 'マイページ', 'アクセス',
  ]
  if (navigationPatterns.some((p) => lowerKeyword.includes(p))) {
    return 'navigational'
  }

  // デフォルト: 情報収集意図
  return 'informational'
}

/**
 * キーワードエントリのバリデーション
 */
export function validateKeywordEntry(
  entry: Partial<KeywordEntry>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!entry.keyword || entry.keyword.trim().length === 0) {
    errors.push('keyword is required')
  }
  if (!entry.category) {
    errors.push('category is required')
  }
  if (entry.searchVolume !== undefined && entry.searchVolume < 0) {
    errors.push('searchVolume must be non-negative')
  }
  if (entry.difficulty !== undefined && (entry.difficulty < 0 || entry.difficulty > 100)) {
    errors.push('difficulty must be between 0 and 100')
  }
  if (entry.trendScore !== undefined && (entry.trendScore < 0 || entry.trendScore > 100)) {
    errors.push('trendScore must be between 0 and 100')
  }

  const validCategories = ['aga', 'hair-removal', 'skincare', 'ed', 'column']
  if (entry.category && !validCategories.includes(entry.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * キーワードリストをフィルタリング・ソートする
 */
export function filterKeywords(
  keywords: KeywordEntry[],
  filter: KeywordFilter
): KeywordResearchResult {
  let result = [...keywords]

  // フィルタ適用
  if (filter.category) {
    result = result.filter((k) => k.category === filter.category)
  }
  if (filter.difficultyLevel) {
    result = result.filter((k) => k.difficultyLevel === filter.difficultyLevel)
  }
  if (filter.searchIntent) {
    result = result.filter((k) => k.searchIntent === filter.searchIntent)
  }
  if (filter.minVolume !== undefined) {
    result = result.filter((k) => k.searchVolume >= filter.minVolume!)
  }
  if (filter.maxVolume !== undefined) {
    result = result.filter((k) => k.searchVolume <= filter.maxVolume!)
  }
  if (filter.minDifficulty !== undefined) {
    result = result.filter((k) => k.difficulty >= filter.minDifficulty!)
  }
  if (filter.maxDifficulty !== undefined) {
    result = result.filter((k) => k.difficulty <= filter.maxDifficulty!)
  }
  if (filter.minTrendScore !== undefined) {
    result = result.filter((k) => k.trendScore >= filter.minTrendScore!)
  }
  if (filter.query) {
    const q = filter.query.toLowerCase()
    result = result.filter(
      (k) =>
        k.keyword.toLowerCase().includes(q) ||
        k.relatedKeywords.some((r) => r.toLowerCase().includes(q)) ||
        k.longTailVariations.some((l) => l.toLowerCase().includes(q))
    )
  }

  const total = result.length

  // ソート
  const sortBy = filter.sortBy ?? 'volume'
  const sortOrder = filter.sortOrder ?? 'desc'
  const multiplier = sortOrder === 'asc' ? 1 : -1

  result.sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return (a.searchVolume - b.searchVolume) * multiplier
      case 'difficulty':
        return (a.difficulty - b.difficulty) * multiplier
      case 'trend':
        return (a.trendScore - b.trendScore) * multiplier
      case 'created':
        return a.createdAt.localeCompare(b.createdAt) * multiplier
      default:
        return 0
    }
  })

  // ページネーション
  const offset = filter.offset ?? 0
  const limit = filter.limit ?? 50
  result = result.slice(offset, offset + limit)

  return { keywords: result, total, filters: filter }
}

/**
 * キーワードの新規エントリを生成する
 */
export function createKeywordEntry(
  input: {
    keyword: string
    category: ContentCategory
    searchVolume?: number
    difficulty?: number
    trendScore?: number
    relatedKeywords?: string[]
    longTailVariations?: string[]
    notes?: string
  }
): KeywordEntry {
  const now = new Date().toISOString()
  const difficulty = input.difficulty ?? 50
  const keyword = input.keyword.trim()

  return {
    id: `kw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    keyword,
    category: input.category,
    searchVolume: input.searchVolume ?? 0,
    difficulty,
    difficultyLevel: getDifficultyLevel(difficulty),
    trendScore: input.trendScore ?? 50,
    searchIntent: estimateSearchIntent(keyword),
    relatedKeywords: input.relatedKeywords ?? [],
    longTailVariations: input.longTailVariations ?? [],
    seasonality: 'evergreen',
    notes: input.notes,
    trackedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}
