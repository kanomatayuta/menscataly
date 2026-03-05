/**
 * microCMS 記事から焼き込みアフィリエイトリンクを除去するスクリプト
 *
 * 動的注入方式に移行したため、microCMS上のHTMLから
 * バッチ注入されたアフィリエイトリンクとセクションを除去する。
 *
 * Usage:
 *   npx tsx scripts/cleanup-baked-affiliate-links.ts --dry-run
 *   npx tsx scripts/cleanup-baked-affiliate-links.ts
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnvLocal() {
  const envPath = resolve(PROJECT_ROOT, '.env.local')
  if (!existsSync(envPath)) return
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const DRY_RUN = process.argv.includes('--dry-run')

interface MicroCMSArticle {
  id: string
  title: string
  content: string
}

function getMicroCMSApiBase(): string {
  return `https://${process.env.MICROCMS_SERVICE_DOMAIN}.microcms.io/api/v1`
}

const ASP_URL_DOMAINS = [
  'felmat.net', 'accesstrade.net', 'afi-b.com', 'a8.net',
  'statics.a8.net', 'valuecommerce.com', 'moshimo.com', 'af.moshimo.com',
]

function stripAffiliateContent(html: string): string {
  let content = html
  // オリジナル形式
  content = content.replace(/<div class="affiliate-section">[\s\S]*?<\/div>/g, '')
  content = content.replace(/<div class="affiliate-banner-section">[\s\S]*?<\/div>/g, '')
  content = content.replace(/<a\s[^>]*rel="sponsored[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1')
  // microCMS正規化後の形式
  content = content.replace(/<h3[^>]*>おすすめクリニック・サービス<\/h3>[\s\S]*?<\/ul>/g, '')
  // ASPドメインリンク除去
  const aspDomainPattern = ASP_URL_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|')
  const aspLinkRegex = new RegExp(
    `<a\\s[^>]*href="[^"]*(?:${aspDomainPattern})[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`,
    'g'
  )
  content = content.replace(aspLinkRegex, '$1')
  content = content.replace(/\n{3,}/g, '\n\n')
  return content.trim()
}

function hasAffiliateContent(html: string): boolean {
  if (/おすすめクリニック・サービス/.test(html)) return true
  const aspDomainPattern = ASP_URL_DOMAINS.map(d => d.replace(/\./g, '\\.')).join('|')
  return new RegExp(`href="[^"]*(?:${aspDomainPattern})`).test(html)
}

async function main() {
  console.info('============================================================')
  console.info('[cleanup] microCMS 焼き込みアフィリエイトリンク除去')
  console.info(`[cleanup] モード: ${DRY_RUN ? 'DRY RUN' : '本番実行'}`)
  console.info('============================================================\n')

  const apiBase = getMicroCMSApiBase()
  const apiKey = process.env.MICROCMS_API_KEY!

  // 全記事取得
  const allArticles: MicroCMSArticle[] = []
  let offset = 0
  while (true) {
    const res = await fetch(`${apiBase}/articles?limit=50&offset=${offset}&fields=id,title,content`, {
      headers: { 'X-MICROCMS-API-KEY': apiKey },
    })
    const data = await res.json() as { contents: MicroCMSArticle[]; totalCount: number }
    allArticles.push(...data.contents)
    if (allArticles.length >= data.totalCount) break
    offset += 50
  }

  console.info(`[cleanup] ${allArticles.length} 件取得\n`)

  let cleanedCount = 0
  let skipCount = 0

  for (const article of allArticles) {
    if (!hasAffiliateContent(article.content)) {
      skipCount++
      continue
    }

    const cleaned = stripAffiliateContent(article.content)

    const diff = article.content.length - cleaned.length
    console.info(`[clean] "${article.title}" — ${diff}文字除去`)

    if (!DRY_RUN) {
      const res = await fetch(`${apiBase}/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-MICROCMS-API-KEY': apiKey },
        body: JSON.stringify({ content: cleaned }),
      })
      if (!res.ok) {
        console.error(`  → PATCH failed: ${res.status}`)
        continue
      }
      console.info(`  → 更新完了`)
      await new Promise(r => setTimeout(r, 500))
    } else {
      console.info(`  → DRY RUN`)
    }
    cleanedCount++
  }

  console.info(`\n[cleanup] 完了: ${cleanedCount}件クリーン, ${skipCount}件スキップ`)
}

main().catch(err => { console.error(err); process.exit(1) })
