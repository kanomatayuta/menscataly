/**
 * microCMS 記事公開ステップ
 * Phase 3b: upsert方式によるべき等性確保
 *
 * - slug をキーにして既存記事があれば PATCH、なければ POST
 * - リトライ時の重複記事防止
 * - ComplianceGateOutput を受け取り、articles フィールドを処理
 */

import type { GeneratedArticleData, PipelineContext, PipelineStep, PublishedArticleData } from '../types'
import type { ComplianceGateOutput } from './compliance-gate'
import { updateQueueEntryStatus } from './compliance-gate'

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
  category?: string  // microCMS コンテンツ参照ID
  thumbnail?: { url: string }
  seo_title?: string
  seo_description?: string
  author_name?: string
  tags?: string[]
  is_pr?: boolean
}

// ============================================================
// microCMS Write API クライアント (upsert対応)
// ============================================================

/**
 * microCMS の Write API を呼び出すクライアント
 * microcms-js-sdk は書き込みAPIをサポートしないため直接 fetch を使用する
 * Phase 3b: slug ベースの upsert (GET → PATCH or POST) をサポート
 */
class MicroCMSWriteClient {
  private apiKey: string
  private baseUrl: string

  constructor(serviceDomain: string, apiKey: string) {
    this.apiKey = apiKey
    this.baseUrl = `https://${serviceDomain}.microcms.io/api/v1`
  }

  /**
   * slug で既存記事を検索する
   * @returns 既存記事のコンテンツID（見つからない場合は null）
   */
  async findBySlug(endpoint: string, slug: string): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/${endpoint}?filters=slug[equals]${encodeURIComponent(slug)}&fields=id&limit=1`,
        {
          method: 'GET',
          headers: {
            'X-MICROCMS-API-KEY': this.apiKey,
          },
        }
      )

      if (!response.ok) {
        console.warn(`[publish-to-microcms] findBySlug failed: ${response.status}`)
        return null
      }

      const data = await response.json() as { contents: Array<{ id: string }> }
      return data.contents?.[0]?.id ?? null
    } catch (err) {
      console.warn(`[publish-to-microcms] findBySlug error for slug=${slug}:`, err)
      return null
    }
  }

  /**
   * 記事を下書きとして作成する (POST)
   * microCMS Write API は ?status=draft クエリパラメータで下書き作成
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
   * 既存記事を更新する (PATCH)
   */
  async updateContent(
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
   * 下書き記事を公開する
   * microCMS Write API: PATCH /endpoint/{contentId} に ?status=publish をつけてステータス変更
   */
  async publish(endpoint: string, contentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${endpoint}/${contentId}?status=publish`, {
      method: 'PATCH',
      headers: {
        'X-MICROCMS-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`microCMS publish failed: ${response.status} ${errorText}`)
    }
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
   * 記事をべき等に公開する (upsert)
   * slug で検索して既存記事があれば PATCH → 公開、なければ POST → 公開
   */
  async upsertAndPublish(
    endpoint: string,
    payload: ArticlePayload
  ): Promise<MicroCMSWriteResponse & { wasUpdated: boolean }> {
    // 1. slug で既存記事を検索
    const existingId = await this.findBySlug(endpoint, payload.slug)

    if (existingId) {
      // 2a. 既存記事があれば PATCH で更新
      console.log(`[publish-to-microcms] Existing article found (id: ${existingId}), updating via PATCH`)
      const response = await this.updateContent(endpoint, existingId, payload)
      // 公開ステータスに変更
      await this.publish(endpoint, existingId)
      return { ...response, id: existingId, wasUpdated: true }
    }

    // 2b. 新規記事の場合は POST → 公開
    console.log(`[publish-to-microcms] No existing article for slug="${payload.slug}", creating new`)
    const draftResponse = await this.createDraft(endpoint, payload)
    if (!draftResponse.id) {
      throw new Error('microCMS: content ID not returned after create')
    }
    await this.publish(endpoint, draftResponse.id)
    return { ...draftResponse, wasUpdated: false }
  }
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * 生成記事データを microCMS 投稿ペイロードに変換する
 */
function toArticlePayload(article: GeneratedArticleData): ArticlePayload {
  const payload: ArticlePayload = {
    title: article.title,
    slug: article.slug,
    content: article.content,
    excerpt: article.excerpt,
    seo_title: article.seoTitle,
    seo_description: article.seoDescription,
    author_name: article.authorName,
    tags: article.tags,
    is_pr: article.isPr,
  }

  return payload
}

/**
 * 入力の正規化: ComplianceGateOutput または GeneratedArticleData[] を受け取り、
 * GeneratedArticleData[] を返す
 */
function normalizeInput(input: ComplianceGateOutput | GeneratedArticleData[]): GeneratedArticleData[] {
  if (Array.isArray(input)) {
    return input
  }
  // ComplianceGateOutput の場合は articles フィールドを取得
  if ('articles' in input && Array.isArray(input.articles)) {
    return input.articles
  }
  return []
}

/**
 * microCMS 記事公開ステップ (upsert方式)
 * Phase 3b: slug ベースのべき等性確保、リトライ時の重複防止
 */
export const publishToMicroCMSStep: PipelineStep<ComplianceGateOutput | GeneratedArticleData[], PublishedArticleData[]> = {
  name: 'publish-to-microcms',
  description: 'microCMS APIへ記事をupsert（slug重複防止）・公開する',
  maxRetries: 3,

  async execute(
    input: ComplianceGateOutput | GeneratedArticleData[],
    context: PipelineContext
  ): Promise<PublishedArticleData[]> {
    const articles = normalizeInput(input)
    console.log(`[publish-to-microcms] Starting publish (run: ${context.runId}, articles: ${articles.length})`)

    const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
    const apiKey = process.env.MICROCMS_API_KEY

    if (!serviceDomain || !apiKey) {
      console.warn('[publish-to-microcms] microCMS env vars not set — skipping publish')
      // 環境変数未設定時はモックレスポンスを返す
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
      console.log('[publish-to-microcms] Dry run mode — skipping actual publish')
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
    const publishedArticles: PublishedArticleData[] = []

    for (const article of articles) {
      console.log(`[publish-to-microcms] Publishing article: ${article.title}`)

      try {
        const payload = toArticlePayload(article)

        // カテゴリスラッグからmicroCMSのカテゴリIDを解決
        if (article.category) {
          const categoryId = await client.findCategoryIdBySlug(article.category)
          if (categoryId) {
            payload.category = categoryId
            console.log(`[publish-to-microcms] Category resolved: ${article.category} → ${categoryId}`)
          } else {
            console.warn(`[publish-to-microcms] Category not found for slug: ${article.category}`)
          }
        }

        // upsert方式: slug で検索 → 既存なら PATCH、新規なら POST
        const response = await client.upsertAndPublish('articles', payload)

        const published: PublishedArticleData = {
          microcmsId: response.id,
          supabaseId: '',  // sync-to-supabase ステップで設定される
          slug: article.slug,
          title: article.title,
          publishedAt: response.publishedAt ?? new Date().toISOString(),
        }

        publishedArticles.push(published)

        // キューステータスを完了に更新
        await updateQueueEntryStatus(article.slug, 'completed')

        const mode = response.wasUpdated ? 'Updated' : 'Created'
        console.log(`[publish-to-microcms] ${mode}: ${article.title} (id: ${response.id})`)
      } catch (err) {
        // 個別記事の公開失敗時はキューステータスを failed に更新し、続行
        const errorMsg = err instanceof Error ? err.message : String(err)
        const errorStack = err instanceof Error ? err.stack : undefined
        console.error(`[publish-to-microcms] Failed to publish ${article.slug}: ${errorMsg}`)
        if (errorStack) {
          console.error(`[publish-to-microcms] Stack: ${errorStack}`)
        }

        await updateQueueEntryStatus(article.slug, 'failed')

        // 他の記事の処理は続行（部分的成功を許容）
        // ただし全記事が失敗した場合はパイプラインリトライのためにエラーを投げる
      }
    }

    if (publishedArticles.length === 0 && articles.length > 0) {
      throw new Error(`All ${articles.length} articles failed to publish`)
    }

    console.log(`[publish-to-microcms] Published ${publishedArticles.length}/${articles.length} articles`)

    // コンテキストの共有データに保存
    context.sharedData['publishedArticles'] = publishedArticles

    return publishedArticles
  },
}
