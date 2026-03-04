/**
 * アフィリエイトリンク注入モジュール
 * コンテンツ内のアンカーテキストをアフィリエイトリンクに変換し、
 * カテゴリ別のアフィリエイトセクションHTMLを生成する
 */

import { getProgramsByCategory } from '@/lib/asp/config'
import { selectBestPrograms } from '@/lib/asp/selector'
import type { ContentCategory } from '@/types/content'
import type { AspProgram } from '@/types/asp-config'

// ============================================================
// リンク注入
// ============================================================

/**
 * コンテンツ内のアンカーテキストをアフィリエイトリンクに変換する
 *
 * - カテゴリに対応するASPプログラムを取得し、スコア順に選定
 * - 各プログラムの recommendedAnchors をコンテンツから検索
 * - 最初の一致箇所のみを `<a>` タグに置換（重複リンクを防止）
 * - rel="sponsored noopener" と target="_blank" を付与
 *
 * @param content - 記事コンテンツ (HTML/Markdown)
 * @param category - コンテンツカテゴリ
 * @param maxLinks - 最大リンク挿入数 (デフォルト: 3)
 * @returns リンク注入済みのコンテンツ
 */
export function injectAffiliateLinksByCategory(
  content: string,
  category: ContentCategory,
  maxLinks = 3
): string {
  if (!content) return content

  const programs = selectBestPrograms(category, { maxResults: maxLinks })

  if (programs.length === 0) return content

  let result = content
  const injectedAnchors = new Set<string>()
  let linkCount = 0

  for (const program of programs) {
    if (linkCount >= maxLinks) break

    for (const anchor of program.recommendedAnchors) {
      if (linkCount >= maxLinks) break
      if (injectedAnchors.has(anchor)) continue

      // アンカーテキストがコンテンツに存在するか確認
      // 既にリンク化されている場合はスキップ (<a> タグ内のテキストは除外)
      const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(
        `(?<!<a[^>]*>)(?<!<a[^>]*>[^<]*)${escapedAnchor}(?![^<]*<\\/a>)`,
        ''
      )

      if (pattern.test(result)) {
        const linkHtml = `<a href="${program.affiliateUrl}" rel="sponsored noopener" target="_blank">${anchor}</a>`
        result = result.replace(pattern, linkHtml)
        injectedAnchors.add(anchor)
        linkCount++
        break // 1プログラムにつき1リンクまで
      }
    }
  }

  return result
}

// ============================================================
// アフィリエイトセクション生成
// ============================================================

/**
 * カテゴリに対応するアフィリエイトリンクのHTMLセクションを生成する
 *
 * @param category - コンテンツカテゴリ
 * @param maxPrograms - 最大プログラム数 (デフォルト: 3)
 * @returns アフィリエイトセクションHTML (該当なしの場合は空文字列)
 */
export function generateAffiliateSection(
  category: ContentCategory,
  maxPrograms = 3
): string {
  const validCategories: ContentCategory[] = ['aga', 'hair-removal', 'skincare', 'ed', 'column']
  if (!validCategories.includes(category)) return ''

  const programs = selectBestPrograms(category, { maxResults: maxPrograms })

  if (programs.length === 0) return ''

  const listItems = programs
    .map(
      (program: AspProgram) =>
        `  <li><a href="${program.affiliateUrl}" rel="sponsored noopener" target="_blank">${program.programName}</a></li>`
    )
    .join('\n')

  return `<div class="affiliate-section">
<ul>
${listItems}
</ul>
</div>`
}
