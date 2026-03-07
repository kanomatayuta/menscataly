/**
 * /api/admin/internal-links
 * POST: 記事を解析して内部リンクを自動挿入
 * GET:  指定記事IDに対する内部リンク提案を取得
 *
 * 内部リンク戦略モジュール (src/lib/content/internal-linking.ts) を活用し、
 * 記事間の関連度スコアに基づいたリンク提案・自動挿入を提供する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { withRateLimit } from '@/lib/admin/rate-limit'
import {
  generateInternalLinks,
  suggestRelatedArticles,
  analyzeLinkDensity,
  optimizeAnchorText,
  type ArticleMeta,
  type InternalLink,
  type RelatedArticleSuggestion,
} from '@/lib/content/internal-linking'
import type { ContentCategory } from '@/types/content'

// ============================================================
// モックデータ（Supabase/microCMS 未接続時のフォールバック）
// ============================================================

function getMockArticles(): ArticleMeta[] {
  return [
    {
      id: 'article-001',
      title: 'AGA治療の費用相場と選び方ガイド',
      slug: 'aga-treatment-cost-guide',
      category: 'aga',
      keyword: 'AGA治療 費用',
      subKeywords: ['AGA 料金', '薄毛治療 費用相場', 'AGA クリニック 選び方'],
      tags: ['AGA', '費用', 'クリニック比較'],
      publishedAt: '2026-01-15T09:00:00Z',
    },
    {
      id: 'article-002',
      title: 'フィナステリドとデュタステリドの違い',
      slug: 'finasteride-vs-dutasteride',
      category: 'aga',
      keyword: 'フィナステリド デュタステリド 違い',
      subKeywords: ['プロペシア ザガーロ', 'AGA 内服薬 比較', 'AGA 治療薬 選び方'],
      tags: ['AGA', '治療薬', '比較'],
      publishedAt: '2026-01-20T09:00:00Z',
    },
    {
      id: 'article-003',
      title: 'メンズ医療脱毛おすすめクリニック比較',
      slug: 'mens-hair-removal-comparison',
      category: 'hair-removal',
      keyword: 'メンズ 医療脱毛 おすすめ',
      subKeywords: ['メンズ脱毛 クリニック', 'ヒゲ脱毛 比較', '医療脱毛 メンズ'],
      tags: ['脱毛', 'クリニック比較', 'メンズ美容'],
      publishedAt: '2026-02-01T09:00:00Z',
    },
    {
      id: 'article-004',
      title: 'メンズスキンケアの基本と正しい手順',
      slug: 'mens-skincare-basics',
      category: 'skincare',
      keyword: 'メンズ スキンケア 基本',
      subKeywords: ['メンズ 洗顔 方法', '男性 化粧水', 'メンズ 保湿'],
      tags: ['スキンケア', '基本', 'メンズ美容'],
      publishedAt: '2026-02-10T09:00:00Z',
    },
    {
      id: 'article-005',
      title: 'ED治療薬の種類と選び方',
      slug: 'ed-treatment-types',
      category: 'ed',
      keyword: 'ED治療薬 種類',
      subKeywords: ['バイアグラ シアリス', 'ED薬 比較', 'ED オンライン処方'],
      tags: ['ED', '治療薬', '比較'],
      publishedAt: '2026-02-15T09:00:00Z',
    },
    {
      id: 'article-006',
      title: 'AGA治療をやめたらどうなる？中断リスクと判断基準',
      slug: 'aga-treatment-stop-risk',
      category: 'aga',
      keyword: 'AGA治療 やめたら',
      subKeywords: ['AGA 治療 中断', 'フィナステリド やめたら', 'AGA 治療 一生'],
      tags: ['AGA', '治療継続', 'リスク'],
      publishedAt: '2026-03-01T09:00:00Z',
    },
  ]
}

// ============================================================
// GET: 内部リンク提案を取得
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const articleId = searchParams.get('articleId')
  const maxLinks = parseInt(searchParams.get('maxLinks') ?? '5', 10)
  const maxRelated = parseInt(searchParams.get('maxRelated') ?? '3', 10)
  const includeAnalysis = searchParams.get('includeAnalysis') === 'true'

  if (!articleId) {
    return NextResponse.json(
      { error: 'articleId query parameter is required' },
      { status: 400 }
    )
  }

  try {
    // microCMS / Supabase から記事データを取得（フォールバック: モック）
    const allArticles = await fetchAllArticleMeta()
    const sourceArticle = allArticles.find((a) => a.id === articleId)

    if (!sourceArticle) {
      return NextResponse.json(
        { error: `Article not found: ${articleId}` },
        { status: 404 }
      )
    }

    // 内部リンク提案を生成
    const internalLinks: InternalLink[] = generateInternalLinks(
      sourceArticle,
      allArticles,
      maxLinks
    )

    // 関連記事提案を生成
    const relatedArticles: RelatedArticleSuggestion[] = suggestRelatedArticles(
      sourceArticle,
      allArticles,
      maxRelated
    )

    const response: {
      articleId: string
      articleTitle: string
      internalLinks: InternalLink[]
      relatedArticles: RelatedArticleSuggestion[]
      linkAnalysis?: ReturnType<typeof analyzeLinkDensity>
    } = {
      articleId: sourceArticle.id,
      articleTitle: sourceArticle.title,
      internalLinks,
      relatedArticles,
    }

    // オプション: 既存リンク密度分析
    if (includeAnalysis) {
      const articleContent = await fetchArticleContent(articleId)
      if (articleContent) {
        response.linkAnalysis = analyzeLinkDensity(
          articleContent.content,
          articleContent.wordCount
        )
      }
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[admin/internal-links] GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: 記事に内部リンクを自動挿入
// ============================================================

interface InsertLinksRequest {
  /** 対象記事ID */
  articleId: string
  /** 挿入する内部リンク（指定しない場合は自動生成） */
  links?: InternalLink[]
  /** 自動生成時の最大リンク数 */
  maxLinks?: number
  /** ドライラン（挿入せずプレビューのみ） */
  dryRun?: boolean
  /** 記事本文（外部から渡す場合）*/
  articleContent?: string
}

interface InsertLinksResponse {
  articleId: string
  insertedLinks: InternalLink[]
  optimizedAnchors: Array<{
    original: string
    optimized: string
    reason: string
  }>
  modifiedContent?: string
  linkAnalysis: ReturnType<typeof analyzeLinkDensity>
  dryRun: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rateLimited = await withRateLimit(request, 'admin:internal-links:post')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  let body: InsertLinksRequest
  try {
    body = (await request.json()) as InsertLinksRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.articleId) {
    return NextResponse.json(
      { error: 'articleId is required' },
      { status: 400 }
    )
  }

  const dryRun = body.dryRun ?? true
  const maxLinks = body.maxLinks ?? 5

  try {
    // 全記事メタデータを取得
    const allArticles = await fetchAllArticleMeta()
    const sourceArticle = allArticles.find((a) => a.id === body.articleId)

    if (!sourceArticle) {
      return NextResponse.json(
        { error: `Article not found: ${body.articleId}` },
        { status: 404 }
      )
    }

    // 内部リンクを生成または指定されたものを使用
    const links: InternalLink[] = body.links
      ? body.links
      : generateInternalLinks(sourceArticle, allArticles, maxLinks)

    // アンカーテキストを最適化
    const optimizedAnchors = links.map((link) => {
      const targetArticle = allArticles.find((a) => a.id === link.targetArticleId)
      const result = optimizeAnchorText(link.anchorText, targetArticle)
      return {
        original: result.original,
        optimized: result.optimized,
        reason: result.reason,
      }
    })

    // 記事本文を取得
    const articleContent = body.articleContent
      ?? (await fetchArticleContent(body.articleId))?.content
      ?? ''

    // リンク挿入後のコンテンツを生成
    const modifiedContent = insertLinksIntoContent(articleContent, links, optimizedAnchors)

    // リンク密度分析
    const wordCount = modifiedContent.length
    const linkAnalysis = analyzeLinkDensity(modifiedContent, wordCount)

    // dryRun でない場合は保存処理（将来実装: microCMS/Supabase への書き込み）
    if (!dryRun) {
      console.log(
        `[admin/internal-links] Would save modified content for article ${body.articleId} (save not yet implemented)`
      )
    }

    const response: InsertLinksResponse = {
      articleId: body.articleId,
      insertedLinks: links,
      optimizedAnchors,
      modifiedContent: dryRun ? modifiedContent : undefined,
      linkAnalysis,
      dryRun,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[admin/internal-links] POST error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 全記事のメタデータを取得する
 * microCMS が設定されていればそちらから取得、なければモックデータを使用
 */
async function fetchAllArticleMeta(): Promise<ArticleMeta[]> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain || !apiKey) {
    return getMockArticles()
  }

  try {
    const { getArticles } = await import('@/lib/microcms/client')
    const result = await getArticles({ limit: 100, offset: 0 })

    return result.contents.map((article): ArticleMeta => ({
      id: article.id,
      title: article.title,
      slug: article.slug ?? article.id,
      category: (article.category?.slug ?? 'column') as ContentCategory,
      keyword: article.target_keyword ?? '',
      subKeywords: [],
      tags: article.tags?.map((t) => t.name) ?? [],
      publishedAt: article.publishedAt,
    }))
  } catch (err) {
    console.error('[internal-links] Failed to fetch articles from microCMS:', err)
    return getMockArticles()
  }
}

/**
 * 記事本文を取得する
 */
async function fetchArticleContent(
  articleId: string
): Promise<{ content: string; wordCount: number } | null> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain || !apiKey) {
    // モックデータの場合はダミーコンテンツを返す
    return {
      content: `<p>モック記事 ${articleId} のコンテンツです。</p>`,
      wordCount: 3000,
    }
  }

  try {
    const { getArticleBySlug } = await import('@/lib/microcms/client')
    const article = await getArticleBySlug(articleId)
    if (!article) return null

    return {
      content: article.content,
      wordCount: article.content.replace(/<[^>]*>/g, '').length,
    }
  } catch {
    return null
  }
}

/**
 * 記事コンテンツにリンクを挿入する
 */
function insertLinksIntoContent(
  content: string,
  links: InternalLink[],
  optimizedAnchors: Array<{ original: string; optimized: string }>
): string {
  if (!content || links.length === 0) return content

  // 関連記事セクションをコンテンツ末尾に追加
  const relatedSection = generateRelatedSection(links, optimizedAnchors)
  return `${content}\n\n${relatedSection}`
}

/**
 * 関連記事セクションのHTMLを生成する
 */
function generateRelatedSection(
  links: InternalLink[],
  optimizedAnchors: Array<{ original: string; optimized: string }>
): string {
  const listItems = links
    .map((link, index) => {
      const anchorText = optimizedAnchors[index]?.optimized ?? link.anchorText
      return `<li><a href="${link.targetUrl}" rel="noopener">${anchorText}</a>（関連度: ${link.relevanceScore}）</li>`
    })
    .join('\n    ')

  return `<section class="related-articles">
  <h2>関連記事</h2>
  <ul>
    ${listItems}
  </ul>
</section>`
}
