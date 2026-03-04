/**
 * 内部リンク戦略モジュール
 * 記事間の内部リンク生成・関連記事提案・アンカーテキスト最適化
 *
 * SEO効果の最大化とユーザー回遊率の向上を目的とする。
 * カテゴリ間のクロスリンクにより、サイト全体のトピカルオーソリティを強化。
 */

import type { ContentCategory } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** 記事メタデータ（内部リンク計算用） */
export interface ArticleMeta {
  /** 記事ID */
  id: string
  /** 記事タイトル */
  title: string
  /** URLスラッグ */
  slug: string
  /** カテゴリ */
  category: ContentCategory
  /** メインキーワード */
  keyword: string
  /** サブキーワード */
  subKeywords: string[]
  /** タグ */
  tags: string[]
  /** 公開日（ISO 8601） */
  publishedAt: string
}

/** 内部リンク提案 */
export interface InternalLink {
  /** リンク先記事ID */
  targetArticleId: string
  /** リンク先記事タイトル */
  targetTitle: string
  /** リンク先URL */
  targetUrl: string
  /** 推奨アンカーテキスト */
  anchorText: string
  /** 関連度スコア（0-100） */
  relevanceScore: number
  /** リンクタイプ */
  linkType: 'same-category' | 'cross-category' | 'pillar-cluster' | 'related-topic'
  /** 配置推奨セクション */
  suggestedPlacement: string
}

/** 関連記事提案 */
export interface RelatedArticleSuggestion {
  /** 記事メタデータ */
  article: ArticleMeta
  /** 関連度スコア（0-100） */
  relevanceScore: number
  /** 関連の理由 */
  reason: string
}

/** アンカーテキスト最適化結果 */
export interface OptimizedAnchorText {
  /** 元のアンカーテキスト */
  original: string
  /** 最適化後のアンカーテキスト */
  optimized: string
  /** 最適化の理由 */
  reason: string
}

/** カテゴリ間リンク関係定義 */
interface CategoryLinkRelation {
  /** 関連カテゴリ */
  relatedCategory: ContentCategory
  /** 関連度（0-1） */
  weight: number
  /** リンクコンテキスト（どういう文脈でリンクするか） */
  context: string
}

// ============================================================
// カテゴリ間関係マップ
// ============================================================

/**
 * カテゴリ間のリンク関係を定義
 * 各カテゴリから他カテゴリへのリンク適性と文脈を管理
 */
const CATEGORY_LINK_MAP: Record<ContentCategory, CategoryLinkRelation[]> = {
  aga: [
    {
      relatedCategory: 'skincare',
      weight: 0.6,
      context: '頭皮ケア・スカルプケアの文脈でスキンケア記事へリンク',
    },
    {
      relatedCategory: 'ed',
      weight: 0.3,
      context: 'AGA治療薬（フィナステリド）の副作用文脈でED関連記事へリンク',
    },
    {
      relatedCategory: 'hair-removal',
      weight: 0.2,
      context: 'メンズ美容全般の文脈で脱毛記事へリンク',
    },
    {
      relatedCategory: 'column',
      weight: 0.4,
      context: 'メンズ美容の入門・総合ガイド文脈でコラム記事へリンク',
    },
  ],
  ed: [
    {
      relatedCategory: 'aga',
      weight: 0.3,
      context: 'メンズヘルス・オンライン診療の文脈でAGA記事へリンク',
    },
    {
      relatedCategory: 'skincare',
      weight: 0.2,
      context: 'メンズ美容全般の文脈でスキンケア記事へリンク',
    },
    {
      relatedCategory: 'column',
      weight: 0.4,
      context: 'メンズヘルスの総合情報としてコラム記事へリンク',
    },
    {
      relatedCategory: 'hair-removal',
      weight: 0.1,
      context: 'メンズ美容全般の文脈で脱毛記事へリンク',
    },
  ],
  'hair-removal': [
    {
      relatedCategory: 'skincare',
      weight: 0.7,
      context: '脱毛後のスキンケア・肌ケアの文脈でスキンケア記事へリンク',
    },
    {
      relatedCategory: 'aga',
      weight: 0.2,
      context: 'メンズ美容全般の文脈でAGA記事へリンク',
    },
    {
      relatedCategory: 'column',
      weight: 0.4,
      context: 'メンズ美容の入門・ガイド文脈でコラム記事へリンク',
    },
    {
      relatedCategory: 'ed',
      weight: 0.1,
      context: 'メンズ美容全般の文脈でED記事へリンク',
    },
  ],
  skincare: [
    {
      relatedCategory: 'hair-removal',
      weight: 0.5,
      context: '肌ケアの延長として脱毛記事へリンク',
    },
    {
      relatedCategory: 'aga',
      weight: 0.4,
      context: '頭皮ケア・スカルプシャンプーの文脈でAGA記事へリンク',
    },
    {
      relatedCategory: 'column',
      weight: 0.5,
      context: 'メンズ美容入門としてコラム記事へリンク',
    },
    {
      relatedCategory: 'ed',
      weight: 0.1,
      context: 'メンズヘルス全般の文脈でED記事へリンク',
    },
  ],
  column: [
    {
      relatedCategory: 'aga',
      weight: 0.7,
      context: '専門的な治療情報としてAGA記事へリンク',
    },
    {
      relatedCategory: 'skincare',
      weight: 0.7,
      context: '具体的なケア方法としてスキンケア記事へリンク',
    },
    {
      relatedCategory: 'hair-removal',
      weight: 0.6,
      context: '具体的な施術情報として脱毛記事へリンク',
    },
    {
      relatedCategory: 'ed',
      weight: 0.5,
      context: '専門的な治療情報としてED記事へリンク',
    },
  ],
}

// ============================================================
// アンカーテキスト NG パターン
// ============================================================

/** SEO上避けるべきアンカーテキストパターン */
const ANCHOR_TEXT_NG_PATTERNS: Array<{
  pattern: RegExp
  reason: string
  suggestion: string
}> = [
  {
    pattern: /^こちら$/,
    reason: 'アンカーテキスト「こちら」はSEO上非推奨。リンク先の内容を示すテキストに変更',
    suggestion: 'リンク先のキーワードを含むテキストに置換してください',
  },
  {
    pattern: /^ここをクリック$/,
    reason: 'アンカーテキスト「ここをクリック」はSEO上非推奨',
    suggestion: 'リンク先の内容を示す具体的なテキストに変更してください',
  },
  {
    pattern: /^詳細はこちら$/,
    reason: 'アンカーテキスト「詳細はこちら」はSEO上非推奨',
    suggestion: '「〇〇の詳細を見る」等、リンク先の内容を含むテキストに変更してください',
  },
  {
    pattern: /^リンク$/,
    reason: 'アンカーテキスト「リンク」はSEO上非推奨',
    suggestion: 'リンク先の記事タイトルやキーワードを含むテキストに変更してください',
  },
  {
    pattern: /^https?:\/\//,
    reason: 'URL直書きのアンカーテキストはSEO上非推奨',
    suggestion: 'リンク先の内容を示すテキストに変更してください',
  },
]

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * キーワードの重複度を計算する
 * @param keywords1 キーワードリスト1
 * @param keywords2 キーワードリスト2
 * @returns 0-1の重複度スコア
 */
function calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0

  const set1 = new Set(keywords1.map((k) => k.toLowerCase()))
  const set2 = new Set(keywords2.map((k) => k.toLowerCase()))

  let overlapCount = 0
  for (const keyword of set1) {
    if (set2.has(keyword)) {
      overlapCount++
    } else {
      // 部分一致もチェック
      for (const k2 of set2) {
        if (keyword.includes(k2) || k2.includes(keyword)) {
          overlapCount += 0.5
          break
        }
      }
    }
  }

  const maxSize = Math.max(set1.size, set2.size)
  return Math.min(1, overlapCount / maxSize)
}

/**
 * タグの重複度を計算する
 */
function calculateTagOverlap(tags1: string[], tags2: string[]): number {
  if (tags1.length === 0 || tags2.length === 0) return 0

  const set1 = new Set(tags1)
  const set2 = new Set(tags2)
  let overlap = 0
  for (const tag of set1) {
    if (set2.has(tag)) overlap++
  }
  return overlap / Math.max(set1.size, set2.size)
}

/**
 * 2つの記事間の関連度スコアを計算する
 */
function calculateRelevanceScore(
  source: ArticleMeta,
  target: ArticleMeta
): number {
  let score = 0

  // 1. 同一カテゴリボーナス（最大30点）
  if (source.category === target.category) {
    score += 30
  } else {
    // カテゴリ間の関連度を参照
    const relations = CATEGORY_LINK_MAP[source.category] ?? []
    const relation = relations.find((r) => r.relatedCategory === target.category)
    if (relation) {
      score += Math.round(relation.weight * 20)
    }
  }

  // 2. キーワード重複度（最大40点）
  const allSourceKeywords = [source.keyword, ...source.subKeywords]
  const allTargetKeywords = [target.keyword, ...target.subKeywords]
  const keywordOverlap = calculateKeywordOverlap(allSourceKeywords, allTargetKeywords)
  score += Math.round(keywordOverlap * 40)

  // 3. タグ重複度（最大20点）
  const tagOverlap = calculateTagOverlap(source.tags, target.tags)
  score += Math.round(tagOverlap * 20)

  // 4. 新しい記事へのボーナス（最大10点）
  const daysDiff = Math.abs(
    (new Date(source.publishedAt).getTime() - new Date(target.publishedAt).getTime()) /
      (1000 * 60 * 60 * 24)
  )
  if (daysDiff < 30) {
    score += 10
  } else if (daysDiff < 90) {
    score += 5
  }

  return Math.min(100, Math.max(0, score))
}

/**
 * リンクタイプを判定する
 */
function determineLinkType(
  source: ArticleMeta,
  target: ArticleMeta
): InternalLink['linkType'] {
  if (source.category === target.category) {
    return 'same-category'
  }

  // column カテゴリはピラー（まとめ）記事として扱う
  if (source.category === 'column' || target.category === 'column') {
    return 'pillar-cluster'
  }

  const relations = CATEGORY_LINK_MAP[source.category] ?? []
  const relation = relations.find((r) => r.relatedCategory === target.category)
  if (relation && relation.weight >= 0.5) {
    return 'related-topic'
  }

  return 'cross-category'
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 記事に対する内部リンク提案を生成する
 *
 * @param sourceArticle リンク元の記事
 * @param allArticles 全記事のリスト
 * @param maxLinks 最大リンク数（デフォルト: 5）
 * @returns 内部リンク提案のリスト（関連度スコア降順）
 *
 * @example
 * ```ts
 * const links = generateInternalLinks(currentArticle, allArticles, 5);
 * links.forEach(link => {
 *   console.log(`${link.anchorText} → ${link.targetUrl} (score: ${link.relevanceScore})`);
 * });
 * ```
 */
export function generateInternalLinks(
  sourceArticle: ArticleMeta,
  allArticles: ArticleMeta[],
  maxLinks = 5
): InternalLink[] {
  const candidates: InternalLink[] = []

  for (const target of allArticles) {
    // 自分自身へのリンクは除外
    if (target.id === sourceArticle.id) continue

    const relevanceScore = calculateRelevanceScore(sourceArticle, target)
    const linkType = determineLinkType(sourceArticle, target)

    // 関連度が一定以上のもののみ候補に
    if (relevanceScore < 15) continue

    // カテゴリ間リンクのコンテキストを取得
    const relations = CATEGORY_LINK_MAP[sourceArticle.category] ?? []
    const relation = relations.find((r) => r.relatedCategory === target.category)
    const suggestedPlacement = relation?.context ?? '関連情報セクション'

    // アンカーテキストを生成
    const anchorText = generateAnchorText(sourceArticle, target)

    candidates.push({
      targetArticleId: target.id,
      targetTitle: target.title,
      targetUrl: `/${target.category}/${target.slug}`,
      anchorText,
      relevanceScore,
      linkType,
      suggestedPlacement,
    })
  }

  // 関連度スコア降順でソートし、上位を返す
  return candidates
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxLinks)
}

/**
 * 関連記事を提案する
 *
 * @param sourceArticle 基準となる記事
 * @param allArticles 全記事のリスト
 * @param maxSuggestions 最大提案数（デフォルト: 3）
 * @returns 関連記事提案のリスト（関連度スコア降順）
 *
 * @example
 * ```ts
 * const related = suggestRelatedArticles(currentArticle, allArticles, 3);
 * related.forEach(r => {
 *   console.log(`関連: ${r.article.title} (score: ${r.relevanceScore}) - ${r.reason}`);
 * });
 * ```
 */
export function suggestRelatedArticles(
  sourceArticle: ArticleMeta,
  allArticles: ArticleMeta[],
  maxSuggestions = 3
): RelatedArticleSuggestion[] {
  const suggestions: RelatedArticleSuggestion[] = []

  for (const target of allArticles) {
    if (target.id === sourceArticle.id) continue

    const relevanceScore = calculateRelevanceScore(sourceArticle, target)
    if (relevanceScore < 20) continue

    // 関連理由を生成
    let reason: string
    if (sourceArticle.category === target.category) {
      reason = `同じカテゴリ「${target.category}」の関連記事`
    } else {
      const relations = CATEGORY_LINK_MAP[sourceArticle.category] ?? []
      const relation = relations.find((r) => r.relatedCategory === target.category)
      reason = relation?.context ?? `「${target.category}」カテゴリの関連コンテンツ`
    }

    // キーワード共通性があればそれも理由に追加
    const allSourceKw = [sourceArticle.keyword, ...sourceArticle.subKeywords]
    const allTargetKw = [target.keyword, ...target.subKeywords]
    const commonKeywords = allSourceKw.filter((kw) =>
      allTargetKw.some(
        (tk) => tk.toLowerCase().includes(kw.toLowerCase()) || kw.toLowerCase().includes(tk.toLowerCase())
      )
    )
    if (commonKeywords.length > 0) {
      reason += `（共通キーワード: ${commonKeywords.slice(0, 3).join('、')}）`
    }

    suggestions.push({
      article: target,
      relevanceScore,
      reason,
    })
  }

  return suggestions
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxSuggestions)
}

/**
 * アンカーテキストを最適化する
 *
 * SEOに不適切なアンカーテキストを検出し、改善案を提案する。
 *
 * @param anchorText 現在のアンカーテキスト
 * @param targetArticle リンク先記事のメタデータ（オプション）
 * @returns 最適化結果
 *
 * @example
 * ```ts
 * const result = optimizeAnchorText('こちら', targetArticleMeta);
 * console.log(result.optimized); // "AGA治療の費用相場"
 * console.log(result.reason);    // "アンカーテキスト「こちら」はSEO上非推奨..."
 * ```
 */
export function optimizeAnchorText(
  anchorText: string,
  targetArticle?: ArticleMeta
): OptimizedAnchorText {
  // NGパターンチェック
  for (const ngPattern of ANCHOR_TEXT_NG_PATTERNS) {
    if (ngPattern.pattern.test(anchorText)) {
      // リンク先記事情報があれば最適なテキストを生成
      const optimized = targetArticle
        ? generateOptimalAnchorText(targetArticle)
        : ngPattern.suggestion

      return {
        original: anchorText,
        optimized,
        reason: ngPattern.reason,
      }
    }
  }

  // テキストが長すぎる場合（50文字超）
  if (anchorText.length > 50) {
    const optimized = targetArticle
      ? generateOptimalAnchorText(targetArticle)
      : anchorText.slice(0, 40) + '...'

    return {
      original: anchorText,
      optimized,
      reason: 'アンカーテキストが長すぎます（50文字以内推奨）。簡潔なテキストに変更してください',
    }
  }

  // テキストが短すぎる場合（3文字未満）
  if (anchorText.length < 3) {
    const optimized = targetArticle
      ? generateOptimalAnchorText(targetArticle)
      : anchorText

    return {
      original: anchorText,
      optimized,
      reason: 'アンカーテキストが短すぎます。リンク先の内容を示す具体的なテキストに変更してください',
    }
  }

  // 問題なし
  return {
    original: anchorText,
    optimized: anchorText,
    reason: 'OK',
  }
}

// ============================================================
// 内部ヘルパー
// ============================================================

/**
 * 2つの記事間で最適なアンカーテキストを生成する
 */
function generateAnchorText(source: ArticleMeta, target: ArticleMeta): string {
  // 共通キーワードがあればそれを含むアンカーテキストを生成
  const allSourceKw = [source.keyword, ...source.subKeywords]
  const allTargetKw = [target.keyword, ...target.subKeywords]

  for (const sourceKw of allSourceKw) {
    for (const targetKw of allTargetKw) {
      if (
        sourceKw.toLowerCase().includes(targetKw.toLowerCase()) ||
        targetKw.toLowerCase().includes(sourceKw.toLowerCase())
      ) {
        return `${targetKw}について詳しく見る`
      }
    }
  }

  // 共通キーワードがない場合はターゲットのメインキーワードを使用
  return `${target.keyword}の詳細はこちら`
}

/**
 * ターゲット記事に最適なアンカーテキストを生成する
 */
function generateOptimalAnchorText(target: ArticleMeta): string {
  // タイトルが30文字以内ならそのまま使用
  if (target.title.length <= 30) {
    return target.title
  }

  // メインキーワードを使用
  return target.keyword
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * カテゴリ間のリンク関係を取得する
 * テンプレート設計や記事企画時に使用
 */
export function getCategoryLinkRelations(
  category: ContentCategory
): CategoryLinkRelation[] {
  return CATEGORY_LINK_MAP[category] ?? []
}

/**
 * 記事のリンク密度を分析する
 * @param articleContent 記事本文（HTML or Markdown）
 * @param wordCount 記事の文字数
 * @returns リンク密度のスコアと改善提案
 */
export function analyzeLinkDensity(
  articleContent: string,
  wordCount: number
): {
  internalLinkCount: number
  externalLinkCount: number
  linkDensity: number
  recommendation: string
} {
  // マークダウンリンクを検出
  const mdLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g
  const links = [...articleContent.matchAll(mdLinkPattern)]

  let internalLinkCount = 0
  let externalLinkCount = 0

  for (const link of links) {
    const url = link[2]
    if (url.startsWith('/') || url.startsWith('#')) {
      internalLinkCount++
    } else {
      externalLinkCount++
    }
  }

  // HTMLリンクも検出
  const htmlLinkPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/g
  const htmlLinks = [...articleContent.matchAll(htmlLinkPattern)]

  for (const link of htmlLinks) {
    const url = link[1]
    if (url.startsWith('/') || url.startsWith('#')) {
      internalLinkCount++
    } else {
      externalLinkCount++
    }
  }

  const totalLinks = internalLinkCount + externalLinkCount
  const linkDensity = wordCount > 0 ? totalLinks / (wordCount / 1000) : 0

  let recommendation: string
  if (internalLinkCount < 2) {
    recommendation = '内部リンクが少なすぎます。2〜5本の関連記事へのリンクを追加してください'
  } else if (internalLinkCount > 10) {
    recommendation = '内部リンクが多すぎます。最も関連度の高い5〜8本に絞ることを推奨します'
  } else if (linkDensity > 10) {
    recommendation = 'リンク密度が高すぎます。読者の利便性を考慮してリンク数を削減してください'
  } else {
    recommendation = '内部リンクの数は適切です'
  }

  return {
    internalLinkCount,
    externalLinkCount,
    linkDensity: Math.round(linkDensity * 100) / 100,
    recommendation,
  }
}
