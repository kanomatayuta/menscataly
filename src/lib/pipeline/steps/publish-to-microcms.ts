/**
 * microCMS 記事保存ステップ（下書き保存）
 *
 * パイプラインで生成した記事を microCMS に「下書き」として保存する。
 * microCMS 管理画面でレビュー → 公開 のワークフローを想定。
 *
 * - slug をキーにして既存記事があれば PATCH、なければ POST
 * - リトライ時の重複記事防止（upsert方式）
 * - review_status: "in_review" で保存し、microCMS上でステータス管理
 * - compliance_score をカスタムフィールドに保存
 */

import type { GeneratedArticleData, PipelineContext, PipelineStep, PublishedArticleData } from '../types'
import type { ComplianceGateOutput } from './compliance-gate'

// ============================================================
// microCMS Write API レスポンス型
// ============================================================

export interface MicroCMSWriteResponse {
  id: string
  createdAt?: string
  updatedAt?: string
  publishedAt?: string
  revisedAt?: string
  [key: string]: unknown
}

export interface ArticlePayload {
  title: string
  slug: string
  content: string
  excerpt?: string
  category?: string
  seo_title?: string
  seo_description?: string
  author_name?: string
  tags?: string[]
  is_pr?: boolean
  review_status?: string[]
  compliance_score?: number
}

// ============================================================
// microCMS Write API クライアント
// ============================================================

class MicroCMSWriteClient {
  private apiKey: string
  private baseUrl: string

  constructor(serviceDomain: string, apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = `https://${serviceDomain}.microcms.io/api/v1`
  }

  /**
   * slug で既存記事を検索する
   */
  async findBySlug(endpoint: string, slug: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${endpoint}?filters=slug[equals]${encodeURIComponent(slug)}&fields=id&limit=1`,
        {
          method: 'GET',
          headers: { 'X-MICROCMS-API-KEY': this.apiKey },
        }
      )
      if (!response.ok) return null
      const data = await response.json() as { contents: Array<{ id: string }> }
      return data.contents?.[0]?.id ?? null
    } catch (err) {
      console.warn(`[publish-to-microcms] findBySlug error for slug=${slug}:`, err)
      return null
    }
  }

  /**
   * 記事を下書きとして作成する (POST ?status=draft)
   */
  async createDraft(
    endpoint: string,
    payload: ArticlePayload
  ): Promise<MicroCMSWriteResponse> {
    const response = await fetch(`${this.baseUrl}/${endpoint}?status=draft`, {
      method: 'POST',
      headers: {
        'X-MICROCMS-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`microCMS create failed: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<MicroCMSWriteResponse>
  }

  /**
   * 既存記事を更新する (PATCH) — 下書きのまま更新
   */
  async updateDraft(
    endpoint: string,
    contentId: string,
    payload: ArticlePayload
  ): Promise<MicroCMSWriteResponse> {
    const response = await fetch(`${this.baseUrl}/${endpoint}/${contentId}`, {
      method: 'PATCH',
      headers: {
        'X-MICROCMS-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`microCMS update failed: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<MicroCMSWriteResponse>
  }

  /**
   * カテゴリスラッグから microCMS カテゴリIDを解決する
   */
  async findCategoryIdBySlug(slug: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/categories?filters=slug[equals]${encodeURIComponent(slug)}&fields=id&limit=1`,
        {
          method: 'GET',
          headers: { 'X-MICROCMS-API-KEY': this.apiKey },
        }
      )
      if (!response.ok) return null
      const data = await response.json() as { contents: Array<{ id: string }> }
      return data.contents?.[0]?.id ?? null
    } catch {
      return null
    }
  }

  /**
   * 記事をべき等に下書き保存する (upsert)
   * slug で検索して既存記事があれば PATCH、なければ POST
   * 自動公開はしない — microCMS管理画面で手動公開する
   */
  async upsertDraft(
    endpoint: string,
    payload: ArticlePayload
  ): Promise<MicroCMSWriteResponse & { wasUpdated: boolean }> {
    const existingId = await this.findBySlug(endpoint, payload.slug)

    if (existingId) {
      console.log(`[publish-to-microcms] Existing article found (id: ${existingId}), updating draft`)
      const response = await this.updateDraft(endpoint, existingId, payload)
      return { ...response, id: existingId, wasUpdated: true }
    }

    console.log(`[publish-to-microcms] Creating new draft for slug="${payload.slug}"`)
    const response = await this.createDraft(endpoint, payload)
    if (!response.id) {
      throw new Error('microCMS: content ID not returned after create')
    }
    return { ...response, wasUpdated: false }
  }
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * 生成記事データを microCMS 投稿ペイロードに変換する
 * review_status と compliance_score を含める
 */
function toArticlePayload(article: GeneratedArticleData): ArticlePayload {
  return {
    title: article.title,
    slug: article.slug,
    content: article.content,
    excerpt: article.excerpt,
    seo_title: article.seoTitle,
    seo_description: article.seoDescription,
    author_name: article.authorName,
    tags: article.tags,
    is_pr: article.isPr,
    review_status: ['in_review'],
    compliance_score: article.complianceScore,
  }
}

/**
 * 入力の正規化
 */
function normalizeInput(input: ComplianceGateOutput | GeneratedArticleData[]): GeneratedArticleData[] {
  if (Array.isArray(input)) {
    return input
  }
  if ('articles' in input && Array.isArray(input.articles)) {
    return input.articles
  }
  return []
}

/**
 * microCMS 記事保存ステップ（下書き保存）
 *
 * 記事を microCMS に下書き (review_status: "in_review") として保存する。
 * microCMS 管理画面でレビュー・編集 → 手動公開するワークフロー。
 */
export const publishToMicroCMSStep: PipelineStep<ComplianceGateOutput | GeneratedArticleData[], PublishedArticleData[]> = {
  name: 'publish-to-microcms',
  description: 'microCMS に記事を下書き保存する（レビュー待ち）',
  maxRetries: 3,

  async execute(
    input: ComplianceGateOutput | GeneratedArticleData[],
    context: PipelineContext
  ): Promise<PublishedArticleData[]> {
    const articles = normalizeInput(input)
    console.log(`[publish-to-microcms] Starting draft save (run: ${context.runId}, articles: ${articles.length})`)

    const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
    const apiKey = process.env.MICROCMS_API_KEY

    if (!serviceDomain || !apiKey) {
      console.warn('[publish-to-microcms] microCMS env vars not set — skipping')
      const mockResult = articles.map(article => ({
        microcmsId: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        supabaseId: '',
        slug: article.slug,
        title: article.title,
        publishedAt: new Date().toISOString(),
      }))
      context.sharedData['publishedArticles'] = mockResult
      return mockResult
    }

    if (context.config.dryRun) {
      console.log('[publish-to-microcms] Dry run mode — skipping actual save')
      const dryRunResult = articles.map(article => ({
        microcmsId: `dryrun-${article.slug}`,
        supabaseId: '',
        slug: article.slug,
        title: article.title,
        publishedAt: new Date().toISOString(),
      }))
      context.sharedData['publishedArticles'] = dryRunResult
      return dryRunResult
    }

    const client = new MicroCMSWriteClient(serviceDomain, apiKey)
    const savedArticles: PublishedArticleData[] = []

    for (const article of articles) {
      console.log(`[publish-to-microcms] Saving draft: ${article.title}`)

      try {
        const payload = toArticlePayload(article)

        // カテゴリスラッグ → microCMS カテゴリID
        if (article.category) {
          const categoryId = await client.findCategoryIdBySlug(article.category)
          if (categoryId) {
            payload.category = categoryId
            console.log(`[publish-to-microcms] Category resolved: ${article.category} → ${categoryId}`)
          }
        }

        // 下書き保存（自動公開しない）
        const response = await client.upsertDraft('articles', payload)

        savedArticles.push({
          microcmsId: response.id,
          supabaseId: '',
          slug: article.slug,
          title: article.title,
          publishedAt: new Date().toISOString(),
        })

        const mode = response.wasUpdated ? 'Updated' : 'Created'
        console.log(`[publish-to-microcms] ${mode} draft: ${article.title} (id: ${response.id}, score: ${article.complianceScore})`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[publish-to-microcms] Failed to save ${article.slug}: ${errorMsg}`)
        if (err instanceof Error && err.stack) {
          console.error(`[publish-to-microcms] Stack: ${err.stack}`)
        }
      }
    }

    if (savedArticles.length === 0 && articles.length > 0) {
      throw new Error(`All ${articles.length} articles failed to save to microCMS`)
    }

    console.log(`[publish-to-microcms] Saved ${savedArticles.length}/${articles.length} articles as drafts`)
    context.sharedData['publishedArticles'] = savedArticles

    return savedArticles
  },
}
