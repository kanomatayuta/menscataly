/**
 * アフィリエイトリンク注入ユーティリティ
 * カテゴリに基づいて最適なASPプログラムを選定し、記事コンテンツにリンクを注入する
 */

import type { Article, AffiliateLink, ContentCategory } from '@/types/content'
import { selectBestPrograms, toAffiliateLinks } from './selector'

/**
 * カテゴリに基づいてアフィリエイトリンクを記事コンテンツに注入する
 *
 * 1. selectBestPrograms() でカテゴリ上位3件のASPプログラムを取得
 * 2. toAffiliateLinks() でリンク情報に変換
 * 3. 記事コンテンツ中のアンカーテキストを検出し、rel="sponsored" 付きリンクに置換
 *
 * @param article 対象記事
 * @returns アフィリエイトリンク注入済み記事
 */
export function injectAffiliateLinksByCategory(article: Article): Article {
  const programs = selectBestPrograms(article.category, { maxResults: 3 })
  const links = toAffiliateLinks(programs)

  if (links.length === 0) {
    return article
  }

  let content = article.content

  for (const link of links) {
    // アンカーテキストが既にコンテンツに含まれていれば、リンク化
    if (content.includes(link.anchorText)) {
      // rel="sponsored" 付きで置換（既にリンク化されていない場合のみ）
      const linkPattern = new RegExp(
        `(?<!\\[)${link.anchorText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\])`,
        'g'
      )
      content = content.replace(
        linkPattern,
        `[${link.anchorText}](${link.url}){rel="sponsored noopener"}`
      )
    }
  }

  return { ...article, content }
}

/**
 * カテゴリからアフィリエイトリンク候補を取得する（注入はしない）
 */
export function getAffiliateLinksByCategory(
  category: ContentCategory
): AffiliateLink[] {
  const programs = selectBestPrograms(category, { maxResults: 3 })
  return toAffiliateLinks(programs)
}
