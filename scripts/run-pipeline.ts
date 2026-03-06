/**
 * パイプライン実行CLIスクリプト
 *
 * GitHub Actions や手動実行から日次/PDCAパイプラインを実行する。
 * Vercelの関数タイムアウト制限を回避し、直接Node.jsで実行する。
 *
 * Usage:
 *   npx tsx scripts/run-pipeline.ts daily
 *   npx tsx scripts/run-pipeline.ts pdca
 *   npx tsx scripts/run-pipeline.ts daily --dry-run
 *
 * 環境変数:
 *   ANTHROPIC_API_KEY — Claude API キー（未設定時はドライランモード）
 *   MICROCMS_SERVICE_DOMAIN — microCMS サービスドメイン
 *   MICROCMS_API_KEY — microCMS APIキー
 *   NEXT_PUBLIC_SUPABASE_URL — Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase サービスロールキー
 *   GA4_PROPERTY_ID — GA4 プロパティID
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — GCP サービスアカウント
 *   GOOGLE_PRIVATE_KEY — GCP 秘密鍵
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync } from 'fs'

// ============================================================
// パス解決（tsx + ESM 環境対応）
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

// ============================================================
// .env.local を手動で読み込む（ローカル実行時用）
// ============================================================

function loadEnvLocal(): void {
  const envPath = resolve(PROJECT_ROOT, '.env.local')
  if (!existsSync(envPath)) {
    console.log('[pipeline] .env.local not found. Using environment variables as-is.')
    return
  }
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
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
  console.log('[pipeline] .env.local loaded')
}

// ============================================================
// メイン実行
// ============================================================

async function main(): Promise<void> {
  loadEnvLocal()

  const args = process.argv.slice(2)
  const pipelineType = args[0] as 'daily' | 'pdca' | undefined
  const isDryRun = args.includes('--dry-run') || process.env.DRY_RUN === 'true'

  if (!pipelineType || !['daily', 'pdca'].includes(pipelineType)) {
    console.error('Usage: npx tsx scripts/run-pipeline.ts <daily|pdca> [--dry-run]')
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log(`[pipeline] MENS CATALY パイプライン実行`)
  console.log(`[pipeline] タイプ: ${pipelineType}`)
  console.log(`[pipeline] ドライラン: ${isDryRun}`)
  console.log(`[pipeline] 開始時刻: ${new Date().toISOString()}`)
  console.log('='.repeat(60))

  // 環境変数チェック
  const requiredVars = ['MICROCMS_SERVICE_DOMAIN', 'MICROCMS_API_KEY']
  const missingVars = requiredVars.filter(v => !process.env[v])
  if (missingVars.length > 0 && !isDryRun) {
    console.warn(`[pipeline] 警告: 環境変数未設定: ${missingVars.join(', ')}`)
    console.warn('[pipeline] ドライランモードで実行します')
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[pipeline] 警告: ANTHROPIC_API_KEY 未設定 — 記事生成はモックモードで実行')
  }

  try {
    // パスエイリアス(@/)を解決するため、tsx で直接インポート
    // tsconfig の paths は tsx が自動解決する
    const { PipelineExecutor, getDailyPipelineSteps, getPDCAPipelineSteps } =
      await import('../src/lib/pipeline/executor.js')
    const { getPipelineConfig } = await import('../src/lib/pipeline/scheduler.js')

    const config = getPipelineConfig(pipelineType)
    if (isDryRun) {
      config.dryRun = true
    }

    console.log(`[pipeline] タイムアウト: ${config.timeoutMs / 1000}秒`)
    console.log(`[pipeline] リトライ間隔: ${config.retryDelayMs / 1000}秒`)

    const executor = new PipelineExecutor(config)

    const steps = pipelineType === 'daily'
      ? await getDailyPipelineSteps()
      : await getPDCAPipelineSteps()

    console.log(`[pipeline] ステップ数: ${steps.length}`)
    console.log(`[pipeline] ステップ: ${steps.map(s => s.name).join(' → ')}`)
    console.log('-'.repeat(60))

    const result = await executor.run(steps)

    console.log('-'.repeat(60))
    console.log(`[pipeline] 完了: ${result.status}`)
    console.log(`[pipeline] 所要時間: ${Math.round(result.durationMs / 1000)}秒`)

    if (result.stepLogs) {
      console.log('\n[pipeline] ステップ結果:')
      for (const log of result.stepLogs) {
        const icon = log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : '⏭️'
        console.log(`  ${icon} ${log.stepName}: ${log.status} (${Math.round(log.durationMs / 1000)}s)`)
        if (log.error) {
          console.log(`     エラー: ${log.error}`)
        }
      }
    }

    console.log('='.repeat(60))

    if (result.status === 'failed') {
      console.error('[pipeline] パイプラインが失敗しました')
      process.exit(1)
    }

    console.log('[pipeline] パイプラインが正常に完了しました')
  } catch (error) {
    console.error('[pipeline] 致命的エラー:', error)
    process.exit(1)
  }
}

main()
