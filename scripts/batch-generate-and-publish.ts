/**
 * 30記事バッチ生成・公開スクリプト
 *
 * 6カテゴリ x 5キーワード = 30記事を ArticleGenerator で生成し、
 * アフィリエイトリンクを注入したうえで microCMS に公開する。
 *
 * Usage:
 *   npx tsx scripts/batch-generate-and-publish.ts
 *   npx tsx scripts/batch-generate-and-publish.ts --dry-run
 *
 * 環境変数:
 *   ANTHROPIC_API_KEY — Claude API キー（未設定時はドライランモード）
 *   MICROCMS_SERVICE_DOMAIN — microCMS サービスドメイン
 *   MICROCMS_API_KEY — microCMS APIキー
 *   BATCH_SIZE — 1バッチあたりの記事数（デフォルト: 5）
 *   DRY_RUN=true — 強制的にモックレスポンスで実行
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'

// ============================================================
// パス解決（tsx + ESM 環境対応）
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')
const RESULTS_DIR = resolve(__dirname, 'batch-results')

// ============================================================
// .env.local を手動で読み込む
// ============================================================

function loadEnvLocal(): void {
  const envPath = resolve(PROJECT_ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.warn('[batch] .env.local not found. Using environment variables as-is.')
    return
  }
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvLocal()

// ============================================================
// 型定義
// ============================================================

type BatchCategory = 'aga' | 'hair-removal' | 'skincare' | 'ed' | 'supplement' | 'column'

interface KeywordEntry {
  keyword: string
  category: BatchCategory
}

interface ArticleResult {
  slug: string
  microCmsId: string
  category: string
  keyword: string
  complianceScore: number
  costUsd: number
  success: boolean
  error?: string
}

interface BatchManifest {
  generatedAt: string
  totalArticles: number
  succeeded: number
  failed: number
  articles: ArticleResult[]
  totalCostUsd: number
}

// ============================================================
// 30キーワード定義（6カテゴリ x 5）
// ============================================================

const KEYWORD_TARGETS: KeywordEntry[] = [
  // AGA治療 (5)
  { keyword: 'AGA治療 費用 相場', category: 'aga' },
  { keyword: 'AGA治療 効果 期間', category: 'aga' },
  { keyword: 'AGAクリニック 選び方', category: 'aga' },
  { keyword: 'AGA 初期脱毛 対策', category: 'aga' },
  { keyword: 'AGA治療 20代 早期', category: 'aga' },
  // メンズ脱毛 (5)
  { keyword: 'メンズ脱毛 医療 料金', category: 'hair-removal' },
  { keyword: 'ヒゲ脱毛 回数 期間', category: 'hair-removal' },
  { keyword: 'メンズVIO脱毛 痛み', category: 'hair-removal' },
  { keyword: '医療脱毛 エステ脱毛 違い', category: 'hair-removal' },
  { keyword: 'メンズ全身脱毛 おすすめ', category: 'hair-removal' },
  // スキンケア (5)
  { keyword: 'メンズ化粧水 おすすめ 30代', category: 'skincare' },
  { keyword: '男性 ニキビ跡 ケア', category: 'skincare' },
  { keyword: 'メンズ日焼け止め 選び方', category: 'skincare' },
  { keyword: '男性 毛穴 黒ずみ 対策', category: 'skincare' },
  { keyword: 'メンズ美容液 効果', category: 'skincare' },
  // ED治療 (5)
  { keyword: 'ED治療薬 種類 比較', category: 'ed' },
  { keyword: 'ED治療 オンライン診療 流れ', category: 'ed' },
  { keyword: 'ED 原因 20代 30代', category: 'ed' },
  { keyword: 'ED治療 保険適用 条件', category: 'ed' },
  { keyword: 'ED治療薬 副作用 対策', category: 'ed' },
  // サプリメント (5)
  { keyword: '男性 サプリ 筋トレ おすすめ', category: 'supplement' },
  { keyword: 'テストステロン サプリ 効果', category: 'supplement' },
  { keyword: '亜鉛 サプリ 男性 効果', category: 'supplement' },
  { keyword: '男性 マルチビタミン 選び方', category: 'supplement' },
  { keyword: '疲労回復 サプリ 即効性', category: 'supplement' },
  // コラム (5)
  { keyword: '男性美容 トレンド 2024', category: 'column' },
  { keyword: 'メンズ美容 初心者 始め方', category: 'column' },
  { keyword: '男性 アンチエイジング 基本', category: 'column' },
  { keyword: 'メンズ美容 コスパ 節約', category: 'column' },
  { keyword: '男性 見た目 印象 改善', category: 'column' },
]

// ============================================================
// カテゴリマッピングヘルパー
// ============================================================

/**
 * BatchCategory を ContentCategory に変換する
 * supplement は ContentCategory に存在しないため column にマップ
 */
function toContentCategory(cat: BatchCategory): 'aga' | 'hair-removal' | 'skincare' | 'ed' | 'column' {
  if (cat === 'supplement') return 'column'
  return cat
}

/**
 * ターゲットオーディエンスを決定する
 */
function getTargetAudience(cat: BatchCategory): string {
  const map: Record<BatchCategory, string> = {
    aga: 'AGA治療を検討中の20〜40代男性',
    'hair-removal': '医療脱毛を検討中の20〜30代男性',
    skincare: 'スキンケアに関心のある20〜40代男性',
    ed: 'ED治療を検討中の30〜50代男性',
    supplement: 'サプリメントに関心のある30〜50代男性',
    column: 'メンズ美容に関心のある20〜40代男性',
  }
  return map[cat]
}

// ============================================================
// ユーティリティ
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

// ============================================================
// メイン処理
// ============================================================

async function main(): Promise<void> {
  console.log('='.repeat(60))
  console.log('MENS CATALY - Batch Article Generation & Publish')
  console.log('='.repeat(60))

  // --dry-run フラグ検出
  const cliDryRun = process.argv.includes('--dry-run')
  const envDryRun = process.env.DRY_RUN === 'true'
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY
  const isDryRun = cliDryRun || envDryRun || !hasApiKey

  const batchSize = parseInt(process.env.BATCH_SIZE ?? '5', 10) || 5

  if (isDryRun) {
    console.log('\n[MODE] DRY RUN - Using mock responses')
    if (!hasApiKey) console.log('[REASON] ANTHROPIC_API_KEY is not set')
    if (cliDryRun) console.log('[REASON] --dry-run flag is set')
    if (envDryRun) console.log('[REASON] DRY_RUN=true is set')
  } else {
    console.log('\n[MODE] LIVE - Using Claude API')
    console.log('[WARNING] This will incur API costs for 30 articles')
  }

  // 強制ドライランの場合は環境変数を削除
  if ((cliDryRun || envDryRun) && hasApiKey) {
    delete process.env.ANTHROPIC_API_KEY
  }

  console.log(`[CONFIG] Batch size: ${batchSize}`)
  console.log(`[CONFIG] Total keywords: ${KEYWORD_TARGETS.length}`)
  console.log('')

  // 動的インポート
  const { ArticleGenerator } = await import('../src/lib/content/generator')
  const { ArticlePublisher } = await import('../src/lib/content/publisher')
  const { injectAffiliateLinksByCategory } = await import('../src/lib/asp/link-injector')

  const generator = new ArticleGenerator()
  const publisher = new ArticlePublisher()

  // 結果ディレクトリを確保
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true })
  }

  // 進捗追跡
  const articleResults: ArticleResult[] = []
  let totalCompleted = 0
  let totalFailed = 0
  let totalCostUsd = 0
  const overallStart = Date.now()

  // バッチ分割
  const batches = chunkArray(KEYWORD_TARGETS, batchSize)

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]
    const batchNum = batchIdx + 1

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`[BATCH ${batchNum}/${batches.length}] Processing ${batch.length} articles`)
    console.log(`${'─'.repeat(50)}`)

    for (let i = 0; i < batch.length; i++) {
      const entry = batch[i]
      const globalIdx = batchIdx * batchSize + i + 1
      const contentCategory = toContentCategory(entry.category)

      console.log(
        `\n  [${globalIdx}/${KEYWORD_TARGETS.length}] ${entry.category.toUpperCase()}: "${entry.keyword}"`
      )

      try {
        // 1. 記事生成
        const response = await generator.generate({
          category: contentCategory,
          keyword: entry.keyword,
          targetAudience: getTargetAudience(entry.category),
          tone: 'informative',
          targetLength: 3000,
        })

        const article = response.article
        const complianceScore = response.compliance.score

        console.log(`    Title: ${article.title}`)
        console.log(`    Compliance: ${complianceScore}/100`)
        console.log(`    Model: ${response.model}`)

        // 2. アフィリエイトリンク注入
        const articleWithLinks = injectAffiliateLinksByCategory(article)

        // 3. microCMS に公開
        const publishResult = await publisher.publishToMicroCMS(articleWithLinks, {
          status: 'draft',
        })

        console.log(`    Published: ${publishResult.contentId} (${publishResult.isDryRun ? 'dry-run' : 'live'})`)

        // コスト推定（ダミーの場合 0.05 USD、本番の場合はトークンベース推定）
        const costUsd = response.processingTimeMs ? 0.05 : 0
        totalCostUsd += costUsd

        articleResults.push({
          slug: article.slug,
          microCmsId: publishResult.contentId,
          category: entry.category,
          keyword: entry.keyword,
          complianceScore,
          costUsd,
          success: true,
        })

        totalCompleted++
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error(`    ERROR: ${errorMessage}`)

        articleResults.push({
          slug: '',
          microCmsId: '',
          category: entry.category,
          keyword: entry.keyword,
          complianceScore: 0,
          costUsd: 0,
          success: false,
          error: errorMessage,
        })

        totalFailed++
      }
    }

    // バッチ間のレート制限待機（最後のバッチは待機不要）
    if (batchIdx < batches.length - 1) {
      console.log(`\n  [WAIT] Waiting 30 seconds before next batch (API rate limiting)...`)
      await sleep(30_000)
    }
  }

  // ============================================================
  // マニフェスト書き出し
  // ============================================================

  const manifest: BatchManifest = {
    generatedAt: new Date().toISOString(),
    totalArticles: KEYWORD_TARGETS.length,
    succeeded: totalCompleted,
    failed: totalFailed,
    articles: articleResults,
    totalCostUsd,
  }

  const manifestPath = resolve(RESULTS_DIR, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  // ============================================================
  // 最終レポート
  // ============================================================

  const elapsed = Date.now() - overallStart

  console.log('\n' + '='.repeat(60))
  console.log('BATCH GENERATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`  Mode        : ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`  Total       : ${KEYWORD_TARGETS.length}`)
  console.log(`  Succeeded   : ${totalCompleted}`)
  console.log(`  Failed      : ${totalFailed}`)
  console.log(`  Total Cost  : $${totalCostUsd.toFixed(4)} USD`)
  console.log(`  Elapsed     : ${(elapsed / 1000).toFixed(1)}s`)
  console.log(`  Manifest    : scripts/batch-results/manifest.json`)
  console.log('='.repeat(60))

  // カテゴリ別サマリー
  const categories = [...new Set(KEYWORD_TARGETS.map((k) => k.category))]
  console.log('\n[CATEGORY SUMMARY]')
  for (const cat of categories) {
    const catResults = articleResults.filter((r) => r.category === cat)
    const catSuccess = catResults.filter((r) => r.success).length
    const catFail = catResults.filter((r) => !r.success).length
    const avgScore =
      catResults.filter((r) => r.success).reduce((sum, r) => sum + r.complianceScore, 0) /
        (catSuccess || 1)
    console.log(
      `  ${cat.padEnd(15)} : ${catSuccess} OK / ${catFail} NG  (avg compliance: ${avgScore.toFixed(0)})`
    )
  }

  // 失敗があった場合は exit code 1
  if (totalFailed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]', err)
  process.exit(1)
})
