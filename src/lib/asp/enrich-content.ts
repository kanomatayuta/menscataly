/**
 * 記事コンテンツへのASPリンク動的注入
 *
 * サーバーサイドレンダリング時に呼び出され、最新のASPプログラムデータから
 * アフィリエイトリンクを動的に注入する。
 * これにより、ASP管理画面での登録・更新が即座に全記事に反映される。
 */

import type { ContentCategory } from '@/types/content'
import { injectAffiliateLinksByCategory, generateAffiliateSection, generateBannerSection, generateBannerHtml } from './link-injector'
import { selectBestPrograms } from './selector'

/** ASPアフィリエイトURLに含まれるドメインパターン */
const ASP_URL_DOMAINS = [
  'felmat.net',
  'accesstrade.net',
  'afi-b.com',
  'a8.net',
  'statics.a8.net',
  'valuecommerce.com',
  'moshimo.com',
  'af.moshimo.com',
]

/**
 * 既存のアフィリエイトコンテンツを除去する
 *
 * microCMS のリッチテキストエディタは HTML を正規化するため、
 * rel="sponsored" → rel="noopener noreferrer"、data-* 属性除去、
 * <div class="..."> ラッパー除去が発生する。
 * そのため複数のパターンでマッチする。
 */
export function stripAffiliateContent(html: string): string {
  let content = html

  // 1. オリジナル形式のアフィリエイトセクション除去
  content = content.replace(
    /<div class="affiliate-section">[\s\S]*?<\/div>/g,
    ''
  )
  content = content.replace(
    /<div class="affiliate-banner-section">[\s\S]*?<\/div>/g,
    ''
  )
  content = content.replace(
    /<div class="affiliate-inline-banner">[\s\S]*?<\/div>/g,
    ''
  )

  // 2. microCMS正規化後の形式: <h3>おすすめクリニック・サービス</h3> 以降のセクション除去
  content = content.replace(
    /<h3[^>]*>おすすめクリニック・サービス<\/h3>[\s\S]*?<\/ul>/g,
    ''
  )

  // 3. rel="sponsored" 付きリンクをテキストに戻す（オリジナル形式）
  content = content.replace(
    /<a\s[^>]*rel="sponsored[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
    '$1'
  )

  // 4. microCMS正規化後: ASPドメインのURLを持つリンクをテキストに戻す
  const aspDomainPattern = ASP_URL_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|')
  const aspLinkRegex = new RegExp(
    `<a\\s[^>]*href="[^"]*(?:${aspDomainPattern})[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`,
    'g'
  )
  content = content.replace(aspLinkRegex, '$1')

  // 連続する空行を整理
  content = content.replace(/\n{3,}/g, '\n\n')

  return content.trim()
}

/**
 * 記事本文中の h2 見出し前にバナー広告を挿入する
 *
 * 挿入位置:
 * - 2番目の h2 の前（h2 が3個以上ある場合）
 * - 記事中盤の h2 の前（h2 が6個以上ある場合）
 *
 * 同じバナーの重複挿入を避けるため、使用済みバナーを追跡する
 */
async function insertInlineBanners(
  content: string,
  category: ContentCategory,
  maxPrograms: number = 3
): Promise<string> {
  const programs = await selectBestPrograms(category, { maxResults: maxPrograms })

  // バナークリエイティブを収集
  const bannerHtmls: string[] = []
  for (const program of programs) {
    if (!program.adCreatives) continue
    const bannerCreatives = program.adCreatives.filter(
      (c) => c.type === 'banner' && c.isActive && c.useForBanner
    )
    for (const creative of bannerCreatives) {
      const html = generateBannerHtml(creative, program.aspName, program.programId, program.category)
      if (html) bannerHtmls.push(html)
    }
  }

  if (bannerHtmls.length === 0) return content

  // h2 タグの位置を全て取得
  const h2Positions: number[] = []
  const h2Regex = /<h2[\s>]/gi
  let match: RegExpExecArray | null
  while ((match = h2Regex.exec(content)) !== null) {
    h2Positions.push(match.index)
  }

  // h2 が2個以下なら挿入しない（短い記事）
  if (h2Positions.length < 3) return content

  // 挿入位置を決定: 2番目の h2 の前、h2 が6個以上なら中盤にも
  const insertPositions: number[] = [h2Positions[1]] // 2番目の h2 前
  if (h2Positions.length >= 6 && bannerHtmls.length >= 2) {
    const midIndex = Math.floor(h2Positions.length * 2 / 3)
    insertPositions.push(h2Positions[midIndex])
  }

  // 後ろから挿入（位置がずれないように）
  let result = content
  const sortedPositions = insertPositions.sort((a, b) => b - a)

  for (let i = 0; i < sortedPositions.length; i++) {
    const pos = sortedPositions[i]
    const bannerIdx = i % bannerHtmls.length
    const bannerBlock = `<div class="affiliate-inline-banner">\n${bannerHtmls[bannerIdx]}\n</div>\n`
    result = result.slice(0, pos) + bannerBlock + result.slice(pos)
  }

  return result
}

/**
 * 記事コンテンツにASPアフィリエイトリンクを動的注入する
 *
 * 1. 既存のアフィリエイトコンテンツを除去
 * 2. 最新のASPプログラムからテキストリンクを注入
 * 3. h2 見出し前にバナー広告を挿入
 * 4. 末尾にバナー広告セクションを追加
 * 5. 末尾に「おすすめクリニック・サービス」セクションを追加
 *
 * @param htmlContent microCMSから取得した記事HTML
 * @param category 記事カテゴリ
 * @param maxLinks 最大リンク数 (デフォルト: 3)
 */
export async function enrichContentWithAffiliateLinks(
  htmlContent: string,
  category: ContentCategory,
  maxLinks: number = 3
): Promise<string> {
  // 1. 既存のアフィリエイトコンテンツを除去（クリーンな状態にする）
  const cleanContent = stripAffiliateContent(htmlContent)

  // 2. テキストリンク注入
  const injectedContent = await injectAffiliateLinksByCategory(
    cleanContent,
    category,
    maxLinks
  )

  // 3. h2 見出し前にバナー広告を挿入
  const withInlineBanners = await insertInlineBanners(injectedContent, category, maxLinks)

  // 4. 末尾にバナー広告セクション追加
  const bannerSection = await generateBannerSection(category, maxLinks)

  // 5. 末尾にアフィリエイトセクション追加
  const affiliateSection = await generateAffiliateSection(category, maxLinks)

  let result = withInlineBanners
  if (bannerSection) {
    result += '\n' + bannerSection
  }
  if (affiliateSection) {
    result += '\n' + affiliateSection
  }

  return result
}
