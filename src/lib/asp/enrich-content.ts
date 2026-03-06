/**
 * 記事コンテンツへのASPリンク動的注入
 *
 * サーバーサイドレンダリング時に呼び出され、最新のASPプログラムデータから
 * アフィリエイトリンクを動的に注入する。
 * これにより、ASP管理画面での登録・更新が即座に全記事に反映される。
 */

import type { ContentCategory } from '@/types/content'
import { injectAffiliateLinksByCategory, generateAffiliateSection } from './link-injector'
import { insertBannerAds } from './banner-injector'

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
  // 新形式 (aside タグ) のインラインバナー除去
  content = content.replace(
    /<aside class="affiliate-inline-banner"[\s\S]*?<\/aside>/g,
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

// insertInlineBanners は banner-injector.ts の insertBannerAds に移行済み

/**
 * 記事コンテンツにASPアフィリエイトリンクを動的注入する
 *
 * 1. 既存のアフィリエイトコンテンツを除去
 * 2. 最新のASPプログラムからテキストリンクを注入
 * 3. バナー広告をサイズ別最適位置に自動挿入
 * 4. 末尾に「おすすめクリニック・サービス」セクションを追加
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

  // 3. バナー広告を最適位置に自動挿入 (サイズ別最適配置)
  const withInlineBanners = await insertBannerAds(injectedContent, category)

  // 4. 末尾にアフィリエイトセクション追加
  const affiliateSection = await generateAffiliateSection(category, maxLinks)

  let result = withInlineBanners
  if (affiliateSection) {
    result += '\n' + affiliateSection
  }

  return result
}
