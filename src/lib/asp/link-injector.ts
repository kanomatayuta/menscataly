/**
 * ASPアフィリエイトリンク注入モジュール
 * HTMLコンテンツ中のアンカーテキストをアフィリエイトリンクに変換する
 */

import type { ContentCategory } from '@/types/content'
import type { AspProgram } from '@/types/asp-config'
import { getProgramsByCategory } from './config'
import { selectBestPrograms } from './selector'

// ============================================================
// リンク注入
// ============================================================

/**
 * カテゴリに応じたアフィリエイトリンクをHTMLコンテンツに注入する
 *
 * - selectBestPrograms() で上位プログラムを選定
 * - 各プログラムの recommendedAnchors[] をコンテンツ内で検索
 * - 最初にヒットしたアンカーテキストのみリンク化（重複注入なし）
 *
 * @param htmlContent  対象HTMLコンテンツ
 * @param category     コンテンツカテゴリ
 * @param maxLinks     最大リンク数（デフォルト: 3）
 * @returns リンク注入済みHTMLコンテンツ
 */
export function injectAffiliateLinksByCategory(
  htmlContent: string,
  category: ContentCategory,
  maxLinks: number = 3
): string {
  const programs = selectBestPrograms(category, { maxResults: maxLinks })

  if (programs.length === 0) {
    return htmlContent
  }

  let content = htmlContent
  let injectedCount = 0

  for (const program of programs) {
    if (injectedCount >= maxLinks) break

    const injected = injectSingleLink(content, program)
    if (injected !== null) {
      content = injected
      injectedCount++
    }
  }

  return content
}

/**
 * 単一プログラムのアフィリエイトリンクをコンテンツに注入する
 * recommendedAnchors の中から最初にヒットしたテキストをリンク化する
 *
 * @returns リンク注入後のコンテンツ。注入できなかった場合は null
 */
function injectSingleLink(
  content: string,
  program: AspProgram
): string | null {
  for (const anchor of program.recommendedAnchors) {
    // 既にリンク化済み（<a> タグ内）でないかチェック
    // href="..." 内やタグ属性内に含まれるテキストは除外する
    const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const alreadyLinked = new RegExp(
      `<a\\s[^>]*>[^<]*${escapedAnchor}[^<]*</a>`,
      'i'
    )

    if (alreadyLinked.test(content)) {
      continue
    }

    // テキスト内で最初の出現箇所のみ置換
    const index = content.indexOf(anchor)
    if (index === -1) continue

    const linkHtml = `<a href="${program.affiliateUrl}" rel="sponsored noopener" target="_blank">${anchor}</a>`
    const before = content.slice(0, index)
    const after = content.slice(index + anchor.length)

    return before + linkHtml + after
  }

  return null
}

// ============================================================
// アフィリエイトセクション生成
// ============================================================

/**
 * アフィリエイトリンクのHTMLセクションを生成する（記事末尾追加用）
 *
 * @param category     コンテンツカテゴリ
 * @param maxPrograms  最大プログラム数（デフォルト: 3）
 * @returns HTMLセクション文字列
 */
export function generateAffiliateSection(
  category: ContentCategory,
  maxPrograms: number = 3
): string {
  const programs = selectBestPrograms(category, { maxResults: maxPrograms })

  if (programs.length === 0) {
    return ''
  }

  const listItems = programs
    .map(
      (p) =>
        `  <li><a href="${p.affiliateUrl}" rel="sponsored noopener" target="_blank">${p.recommendedAnchors[0] ?? p.programName}</a> - ${p.programName}</li>`
    )
    .join('\n')

  return `<div class="affiliate-section">
<h3>おすすめクリニック・サービス</h3>
<p>※以下のリンクはアフィリエイト広告を含みます</p>
<ul>
${listItems}
</ul>
</div>`
}
