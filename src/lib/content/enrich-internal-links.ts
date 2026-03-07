/**
 * 内部リンクHTML注入モジュール
 *
 * 記事レンダリング時に内部リンクをHTMLコンテンツに注入する。
 * internal-linking.ts のリンク生成アルゴリズムを使い、
 * detectAndRemoveLoops() で循環参照を防止する。
 *
 * 最大3〜5本のリンクを自然な位置に挿入し、SEO内部リンク強化を図る。
 */

import type { MicroCMSArticle } from '@/types/microcms'
import type { ContentCategory } from '@/types/content'
import {
  generateInternalLinks,
  detectAndRemoveLoops,
  type ArticleMeta,
  type InternalLink,
} from './internal-linking'

// ============================================================
// 定数
// ============================================================

/** 1記事あたりの最大内部リンク数 */
const MAX_INTERNAL_LINKS = 5

/** 内部リンクの最小関連度スコア（これ以上のリンクのみ注入） */
const MIN_RELEVANCE_SCORE = 20

// ============================================================
// 型定義
// ============================================================

/** 禁止タグ範囲 */
interface ForbiddenRange {
  start: number
  end: number
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * microCMS記事をArticleMeta形式に変換する
 */
function toArticleMeta(article: MicroCMSArticle): ArticleMeta {
  const category = (article.category?.slug ?? 'column') as ContentCategory
  const slug = article.slug ?? article.id

  return {
    id: article.id,
    title: article.title,
    slug,
    category,
    keyword: article.target_keyword ?? article.title,
    subKeywords: article.tags?.map((t) => t.name) ?? [],
    tags: article.tags?.map((t) => t.name) ?? [],
    publishedAt: article.publishedAt,
  }
}

/**
 * 禁止タグ範囲（既存リンク、見出し、script）を事前計算する
 */
function computeForbiddenRanges(content: string): ForbiddenRange[] {
  const ranges: ForbiddenRange[] = []
  const pattern = /<(a|h1|h2|h3|h4|script)\b[^>]*>[\s\S]*?<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length })
  }
  return ranges
}

/**
 * 指定位置が禁止範囲内かチェックする
 */
function isInForbiddenRange(
  ranges: ForbiddenRange[],
  index: number,
  length: number
): boolean {
  return ranges.some(
    (r) => index < r.end && index + length > r.start
  )
}

/**
 * HTMLエスケープ（属性値用）
 */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * アンカーテキストの出現箇所を探し、内部リンクHTMLに置換する
 *
 * 既にリンク化されている箇所・見出し内・script内はスキップする。
 * リンクは <a href="/articles/{slug}"> 形式で、rel属性なし（内部リンク）。
 */
function injectSingleInternalLink(
  content: string,
  link: InternalLink,
  articleSlug: string,
  forbiddenRanges: ForbiddenRange[]
): string | null {
  // アンカーテキストの候補（記事タイトルの一部やキーワード）
  const anchorCandidates = [link.anchorText]

  // タイトルが30文字以内ならタイトルも候補に追加
  if (link.targetTitle.length <= 30 && link.targetTitle !== link.anchorText) {
    anchorCandidates.push(link.targetTitle)
  }

  for (const anchor of anchorCandidates) {
    // 既にリンク化済みかチェック
    const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const alreadyLinked = new RegExp(
      `<a\\s[^>]*>[\\s\\S]*?${escapedAnchor}[\\s\\S]*?</a>`,
      'i'
    )
    if (alreadyLinked.test(content)) continue

    // コンテンツ内でアンカーテキストを検索
    const index = content.indexOf(anchor)
    if (index === -1) continue

    // 禁止範囲内ならスキップ
    if (isInForbiddenRange(forbiddenRanges, index, anchor.length)) continue

    // 内部リンクHTML生成（/articles/{slug} パス）
    const href = `/articles/${escapeHtmlAttr(articleSlug)}`
    const linkHtml = `<a href="${href}" title="${escapeHtmlAttr(link.targetTitle)}">${anchor}</a>`

    const before = content.slice(0, index)
    const after = content.slice(index + anchor.length)

    return before + linkHtml + after
  }

  return null
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 記事HTMLコンテンツに内部リンクを注入する
 *
 * 1. 現在の記事と関連記事からArticleMetaを生成
 * 2. generateInternalLinks() でリンク候補を計算
 * 3. detectAndRemoveLoops() で循環参照を除外
 * 4. 上位リンクをHTMLに注入
 *
 * @param htmlContent 記事HTML
 * @param currentArticle 現在の記事
 * @param relatedArticles 同カテゴリ・関連の公開済み記事群
 * @param maxLinks 最大リンク数（デフォルト: MAX_INTERNAL_LINKS）
 * @returns 内部リンク注入済みHTML
 */
export function enrichContentWithInternalLinks(
  htmlContent: string,
  currentArticle: MicroCMSArticle,
  relatedArticles: MicroCMSArticle[],
  maxLinks: number = MAX_INTERNAL_LINKS
): string {
  // 1. ArticleMeta に変換
  const sourceMeta = toArticleMeta(currentArticle)
  const allMetas = relatedArticles.map(toArticleMeta)

  // 自分自身は allMetas に含めない（generateInternalLinks 内でも除外するが念のため）
  const filteredMetas = allMetas.filter((m) => m.id !== sourceMeta.id)

  if (filteredMetas.length === 0) {
    return htmlContent
  }

  // 2. 内部リンク候補を生成
  const links = generateInternalLinks(sourceMeta, filteredMetas, maxLinks)

  if (links.length === 0) {
    return htmlContent
  }

  // 3. 循環参照チェック
  const linkMap = new Map<string, InternalLink[]>()
  linkMap.set(sourceMeta.id, links)

  // 関連記事側からのリンクも追加（既にリンクされているもの検出用）
  for (const meta of filteredMetas) {
    const reverseLinks = generateInternalLinks(meta, [sourceMeta], 1)
    if (reverseLinks.length > 0) {
      linkMap.set(meta.id, reverseLinks)
    }
  }

  const { cleanedLinkMap } = detectAndRemoveLoops(linkMap)
  const cleanedLinks = cleanedLinkMap.get(sourceMeta.id) ?? []

  // 4. 最小関連度スコアでフィルタ
  const qualifiedLinks = cleanedLinks
    .filter((l) => l.relevanceScore >= MIN_RELEVANCE_SCORE)
    .slice(0, maxLinks)

  if (qualifiedLinks.length === 0) {
    return htmlContent
  }

  // 5. HTMLに注入（後ろのリンクから挿入して位置ずれを防ぐ必要はないが、
  //    各リンクは1つのアンカーのみマッチするため順に処理）
  let enrichedContent = htmlContent
  let injectedCount = 0

  for (const link of qualifiedLinks) {
    if (injectedCount >= maxLinks) break

    // targetUrl は /{category}/{slug} 形式だが、実際のURLは /articles/{slug}
    // targetArticleId からスラッグを解決
    const targetMeta = filteredMetas.find((m) => m.id === link.targetArticleId)
    if (!targetMeta) continue

    // 禁止範囲を毎回再計算（前のリンク注入でHTMLが変わるため）
    const forbiddenRanges = computeForbiddenRanges(enrichedContent)

    const result = injectSingleInternalLink(
      enrichedContent,
      link,
      targetMeta.slug,
      forbiddenRanges
    )

    if (result !== null) {
      enrichedContent = result
      injectedCount++
    }
  }

  return enrichedContent
}
