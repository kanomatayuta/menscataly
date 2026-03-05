/**
 * 既存 microCMS 記事へのASPアフィリエイトリンク再注入スクリプト
 *
 * microCMS から全記事を取得し、Supabase に登録された ASP プログラムから
 * アフィリエイトリンクを注入（テキストリンク + 末尾セクション）して PATCH する。
 *
 * Usage:
 *   npx tsx scripts/re-inject-affiliate-links.ts
 *   npx tsx scripts/re-inject-affiliate-links.ts --dry-run
 *
 * 環境変数:
 *   MICROCMS_SERVICE_DOMAIN       — microCMS サービスドメイン
 *   MICROCMS_API_KEY              — microCMS API キー
 *   NEXT_PUBLIC_SUPABASE_URL      — Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY     — Supabase サービスロールキー
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

// ============================================================
// パス解決 & 環境変数ロード
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnvLocal() {
  const envPath = resolve(PROJECT_ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.warn('[re-inject] .env.local not found. Using environment variables as-is.')
    return
  }
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvLocal()

// ============================================================
// インポート (環境変数ロード後)
// ============================================================

import { injectAffiliateLinksByCategory, generateAffiliateSection } from '../src/lib/asp/link-injector'
import type { ContentCategory } from '../src/types/content'

// ============================================================
// 定数
// ============================================================

const VALID_CATEGORIES: ContentCategory[] = ['aga', 'hair-removal', 'skincare', 'ed', 'column']
const DRY_RUN = process.argv.includes('--dry-run')
const MAX_LINKS_PER_ARTICLE = 3

// ============================================================
// microCMS API ヘルパー
// ============================================================

interface MicroCMSArticle {
  id: string
  title: string
  slug?: string
  content: string
  category?: { id: string; name: string; slug: string }
}

interface MicroCMSListResponse {
  contents: MicroCMSArticle[]
  totalCount: number
  offset: number
  limit: number
}

function getMicroCMSApiBase(): string {
  const domain = process.env.MICROCMS_SERVICE_DOMAIN
  if (!domain) throw new Error('MICROCMS_SERVICE_DOMAIN is not set')
  return `https://${domain}.microcms.io/api/v1`
}

function getApiKey(): string {
  const key = process.env.MICROCMS_API_KEY
  if (!key) throw new Error('MICROCMS_API_KEY is not set')
  return key
}

/** microCMS から全記事を取得 (ページネーション対応) */
async function fetchAllArticles(): Promise<MicroCMSArticle[]> {
  const apiBase = getMicroCMSApiBase()
  const apiKey = getApiKey()
  const allArticles: MicroCMSArticle[] = []
  let offset = 0
  const limit = 50

  while (true) {
    const url = `${apiBase}/articles?limit=${limit}&offset=${offset}&fields=id,title,slug,content,category&depth=1`
    const res = await fetch(url, {
      headers: { 'X-MICROCMS-API-KEY': apiKey },
    })

    if (!res.ok) {
      throw new Error(`microCMS API error: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as MicroCMSListResponse
    allArticles.push(...data.contents)

    if (allArticles.length >= data.totalCount) break
    offset += limit
  }

  return allArticles
}

/** microCMS 記事の content フィールドを PATCH で更新 */
async function patchArticleContent(
  contentId: string,
  newContent: string
): Promise<void> {
  const apiBase = getMicroCMSApiBase()
  const apiKey = getApiKey()

  const res = await fetch(`${apiBase}/articles/${contentId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-MICROCMS-API-KEY': apiKey,
    },
    body: JSON.stringify({ content: newContent }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`microCMS PATCH error: ${res.status} ${res.statusText}\n${errorText}`)
  }
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.info('============================================================')
  console.info('[re-inject] ASPアフィリエイトリンク再注入スクリプト')
  console.info(`[re-inject] モード: ${DRY_RUN ? 'DRY RUN (変更なし)' : '本番実行'}`)
  console.info('============================================================\n')

  // 環境変数チェック
  if (!process.env.MICROCMS_SERVICE_DOMAIN || !process.env.MICROCMS_API_KEY) {
    console.error('[re-inject] ERROR: MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY が未設定です')
    process.exit(1)
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[re-inject] WARNING: Supabase環境変数が未設定です。静的ASPデータにフォールバックします。')
  }

  // 1. microCMS から全記事取得
  console.info('[re-inject] microCMS から記事を取得中...')
  const articles = await fetchAllArticles()
  console.info(`[re-inject] ${articles.length} 件の記事を取得しました\n`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const article of articles) {
    const categorySlug = article.category?.slug
    const title = article.title
    const contentId = article.id

    // カテゴリ判定
    if (!categorySlug || !VALID_CATEGORIES.includes(categorySlug as ContentCategory)) {
      console.info(`[skip] "${title}" — カテゴリ不明 (${categorySlug ?? 'なし'})`)
      skipCount++
      continue
    }

    const category = categorySlug as ContentCategory

    try {
      let content = article.content

      // 既存のアフィリエイトリンクがあるか確認
      const existingLinkCount = (content.match(/rel="sponsored/g) || []).length
      const hasAffiliateSection = content.includes('class="affiliate-section"')

      // 2. テキストリンク注入
      const injectedContent = await injectAffiliateLinksByCategory(
        content,
        category,
        MAX_LINKS_PER_ARTICLE
      )

      // 3. 末尾にアフィリエイトセクション追加（未追加の場合のみ）
      let finalContent = injectedContent
      if (!hasAffiliateSection) {
        const affiliateSection = await generateAffiliateSection(category, MAX_LINKS_PER_ARTICLE)
        if (affiliateSection) {
          finalContent = injectedContent + '\n' + affiliateSection
        }
      }

      // 変更があるかチェック
      const newLinkCount = (finalContent.match(/rel="sponsored/g) || []).length
      const linksAdded = newLinkCount - existingLinkCount

      if (finalContent === article.content) {
        console.info(`[unchanged] "${title}" — 変更なし (既存リンク: ${existingLinkCount}件)`)
        skipCount++
        continue
      }

      console.info(
        `[inject] "${title}" (${category}) — +${linksAdded}リンク (合計: ${newLinkCount}件)`
      )

      // 4. microCMS に PATCH
      if (!DRY_RUN) {
        await patchArticleContent(contentId, finalContent)
        console.info(`  → microCMS 更新完了`)
        // API レート制限対策
        await new Promise((r) => setTimeout(r, 500))
      } else {
        console.info(`  → DRY RUN: 更新スキップ`)
      }

      successCount++
    } catch (err) {
      console.error(`[error] "${title}":`, err)
      errorCount++
    }
  }

  // サマリー
  console.info('\n============================================================')
  console.info('[re-inject] 完了サマリー')
  console.info('============================================================')
  console.info(`  記事総数:     ${articles.length}`)
  console.info(`  注入成功:     ${successCount}`)
  console.info(`  スキップ:     ${skipCount}`)
  console.info(`  エラー:       ${errorCount}`)
  console.info(`  モード:       ${DRY_RUN ? 'DRY RUN' : '本番実行'}`)
  console.info('============================================================')
}

main().catch((err) => {
  console.error('[re-inject] Fatal error:', err)
  process.exit(1)
})
