/**
 * パイロット5記事 microCMS 投稿スクリプト
 *
 * scripts/pilot-results/pilot-*.json の生成済み記事を読み込み、
 * アフィリエイトリンクを注入した上で microCMS に投稿する。
 *
 * Usage:
 *   npx tsx scripts/pilot-publish.ts
 *   npx tsx scripts/pilot-publish.ts --dry-run
 *
 * 環境変数:
 *   MICROCMS_SERVICE_DOMAIN — microCMS サービスドメイン
 *   MICROCMS_API_KEY        — microCMS API キー
 *   PUBLISH_IMMEDIATELY=true — true の場合ドラフトではなく即時公開
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'

// ============================================================
// パス解決
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')
const RESULTS_DIR = resolve(__dirname, 'pilot-results')

// .env.local を手動で読み込む
function loadEnvLocal() {
  const envPath = resolve(PROJECT_ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.warn('[pilot-publish] .env.local not found. Using environment variables as-is.')
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
// 型定義
// ============================================================

interface PilotResultFile {
  target: {
    id: string
    category: string
    keyword: string
  }
  success: boolean
  isDryRun: boolean
  fullArticle?: {
    title: string
    slug: string
    lead: string
    content: string
    sections: unknown[]
    category: string
    seo: {
      title: string
      description: string
      keywords: string[]
    }
    author: {
      name: string
      credentials: string
      bio: string
    }
    supervisor?: {
      name: string
      credentials: string
      bio: string
    }
    references: unknown[]
    publishedAt: string
    updatedAt: string
    readingTime?: number
    tags?: string[]
    hasPRDisclosure: boolean
    isCompliant: boolean
    complianceScore?: number
  }
}

interface PublishResultEntry {
  articleId: string
  title: string
  category: string
  slug: string
  status: 'draft' | 'published'
  contentId: string
  url: string
  isDryRun: boolean
  publishedAt: string
  error?: string
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log('='.repeat(60))
  console.log('MENS CATALY - Pilot Article Publish to microCMS')
  console.log('='.repeat(60))

  const isDryRun = process.argv.includes('--dry-run')
  const publishImmediately = process.env.PUBLISH_IMMEDIATELY === 'true'
  const publishStatus = publishImmediately ? 'published' : 'draft'

  console.log(`\n[MODE] ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`[STATUS] Articles will be published as: ${publishStatus}`)

  if (!isDryRun) {
    const hasMicroCMS =
      !!process.env.MICROCMS_SERVICE_DOMAIN && !!process.env.MICROCMS_API_KEY
    if (!hasMicroCMS) {
      console.log('[INFO] microCMS credentials not set. Running in publisher dry-run mode.')
    }
  }

  // パイロット結果ファイルを読み込む
  const pilotFiles = readdirSync(RESULTS_DIR)
    .filter((f) => f.startsWith('pilot-') && f.endsWith('.json'))
    .sort()

  if (pilotFiles.length === 0) {
    console.error('\n[ERROR] No pilot result files found in scripts/pilot-results/')
    console.error('Run `npx tsx scripts/pilot-generate.ts` first.')
    process.exit(1)
  }

  console.log(`\n[FILES] Found ${pilotFiles.length} pilot result files\n`)

  // ArticlePublisher と link-injector を動的インポート
  const { ArticlePublisher } = await import('../src/lib/content/publisher')
  const { injectAffiliateLinksByCategory } = await import('../src/lib/asp/link-injector')
  const { insertPRDisclosure } = await import('../src/lib/compliance/templates/pr-disclosure')

  const publisher = new ArticlePublisher()
  const results: PublishResultEntry[] = []

  for (let i = 0; i < pilotFiles.length; i++) {
    const filename = pilotFiles[i]
    const num = i + 1

    console.log(`${'─'.repeat(50)}`)
    console.log(`[${num}/${pilotFiles.length}] Processing: ${filename}`)
    console.log(`${'─'.repeat(50)}`)

    try {
      // JSONファイル読み込み
      const filePath = resolve(RESULTS_DIR, filename)
      const raw = readFileSync(filePath, 'utf-8')
      const data: PilotResultFile = JSON.parse(raw)

      if (!data.fullArticle) {
        console.warn(`  SKIP: No fullArticle in ${filename}`)
        results.push({
          articleId: data.target.id,
          title: '(no article)',
          category: data.target.category,
          slug: '',
          status: publishStatus as 'draft' | 'published',
          contentId: '',
          url: '',
          isDryRun,
          publishedAt: new Date().toISOString(),
          error: 'No fullArticle found in result file',
        })
        continue
      }

      const article = data.fullArticle

      // カテゴリを ContentCategory に変換（supplement → column）
      const category =
        article.category === 'supplement' ? 'column' : article.category
      const articleForPublish = { ...article, category } as import('../src/types/content').Article

      // アフィリエイトリンク注入
      console.log(`  Category: ${category}`)
      console.log(`  Title: ${article.title}`)

      if (!isDryRun) {
        const validCategories = ['aga', 'hair-removal', 'skincare', 'ed', 'column']
        if (validCategories.includes(category)) {
          articleForPublish.content = injectAffiliateLinksByCategory(
            articleForPublish.content,
            category as import('../src/types/content').ContentCategory
          )
          console.log('  Affiliate links: injected')
        }

        // PR表記が未挿入の場合は追加
        if (!articleForPublish.hasPRDisclosure) {
          articleForPublish.content = insertPRDisclosure(
            articleForPublish.content,
            'affiliate_standard'
          )
          articleForPublish.hasPRDisclosure = true
          console.log('  PR disclosure: inserted')
        }
      } else {
        console.log('  Affiliate links: skipped (dry-run)')
        console.log('  PR disclosure: skipped (dry-run)')
      }

      // microCMS に投稿
      console.log(`  Publishing as: ${publishStatus}...`)

      const publishResult = await publisher.publishToMicroCMS(
        articleForPublish,
        { status: publishStatus as 'draft' | 'published' }
      )

      console.log(`  Content ID: ${publishResult.contentId}`)
      console.log(`  URL: ${publishResult.url}`)
      console.log(`  Dry Run: ${publishResult.isDryRun}`)
      console.log('  Status: SUCCESS')

      results.push({
        articleId: data.target.id,
        title: article.title,
        category,
        slug: article.slug,
        status: publishResult.status,
        contentId: publishResult.contentId,
        url: publishResult.url,
        isDryRun: publishResult.isDryRun,
        publishedAt: publishResult.publishedAt,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`  ERROR: ${errorMessage}`)

      results.push({
        articleId: pilotFiles[i].replace('.json', ''),
        title: '(error)',
        category: '',
        slug: '',
        status: publishStatus as 'draft' | 'published',
        contentId: '',
        url: '',
        isDryRun,
        publishedAt: new Date().toISOString(),
        error: errorMessage,
      })
    }

    // microCMS レート制限対策: 記事間で2秒待機（最後の記事以外）
    if (i < pilotFiles.length - 1) {
      console.log('  Waiting 2s for microCMS rate limit...')
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  // 結果をJSONファイルに保存
  const publishResultsPath = resolve(RESULTS_DIR, 'publish-results.json')
  const publishSummary = {
    executedAt: new Date().toISOString(),
    isDryRun,
    publishStatus,
    totalArticles: pilotFiles.length,
    successCount: results.filter((r) => !r.error).length,
    failedCount: results.filter((r) => !!r.error).length,
    results,
  }

  writeFileSync(publishResultsPath, JSON.stringify(publishSummary, null, 2), 'utf-8')

  // 最終レポート
  console.log('\n' + '='.repeat(60))
  console.log('PUBLISH COMPLETE')
  console.log('='.repeat(60))
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Publish Status: ${publishStatus}`)
  console.log(`  Total Articles: ${pilotFiles.length}`)
  console.log(`  Successes: ${publishSummary.successCount}`)
  console.log(`  Failures: ${publishSummary.failedCount}`)
  console.log(`  Results saved to: scripts/pilot-results/publish-results.json`)
  console.log('='.repeat(60))

  if (publishSummary.failedCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err)
  process.exit(1)
})
