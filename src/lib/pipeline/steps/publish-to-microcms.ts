/**
 * microCMS 記事公開ステップ
 * 下書き → 公開 の2段階で記事を投稿する
 * 画像URL、タグ、カテゴリを設定する
 */

import type { GeneratedArticleData, PipelineContext, PipelineStep, PublishedArticleData } from '../types'

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
  category?: { id: string }[]
  thumbnail?: { url: string }
  seo_title?: string
  seo_description?: string
  author_name?: string
  tags?: string[]
  is_pr?: boolean
}

// ============================================================
// microCMS Write API クライアント
// ============================================================

/**
 * microCMS の Write API を呼び出すクライアント
 * microcms-js-sdk は書き込みAPIをサポートしないため直接 fetch を使用する
 */
class MicroCMSWriteClient {
  private serviceDomain: string
  private apiKey: string
  private baseUrl: string

  constructor(serviceDomain: string, apiKey: string) {
    this.serviceDomain = serviceDomain
    this.apiKey = apiKey
    this.baseUrl = `https://${serviceDomain}.microcms.io/api/v1`
  }

  /**
   * 記事を下書きとして作成する
   */
  async createDraft(
    endpoint: string,
    payload: ArticlePayload
  ): Promise<MicroCMSWriteResponse> {
    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'X-MICROCMS-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        // draft ステータスで作成
        status: ['draft'],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`microCMS create failed: ${response.status} ${errorText}`)
    }

    return response.json() as Promise<MicroCMSWriteResponse>
  }

  /**
   * 下書き記事を公開する
   */
  async publish(endpoint: string, contentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${endpoint}/${contentId}/status`, {
      method: 'PATCH',
      headers: {
        'X-MICROCMS-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: ['publish'] }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`microCMS publish failed: ${response.status} ${errorText}`)
    }
  }

  /**
   * 記事を直接公開ステータスで作成する（本番環境用）
   */
  async createAndPublish(
    endpoint: string,
    payload: ArticlePayload
  ): Promise<MicroCMSWriteResponse> {
    const draftResponse = await this.createDraft(endpoint, payload)

    if (!draftResponse.id) {
      throw new Error('microCMS: content ID not returned after create')
    }

    // 下書き作成後に公開
    await this.publish(endpoint, draftResponse.id)

    return draftResponse
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
 * microCMS 記事公開ステップ
 */
export const publishToMicroCMSStep: PipelineStep<GeneratedArticleData[], PublishedArticleData[]> = {
  name: 'publish-to-microcms',
  description: 'microCMS APIへ記事を投稿・公開する（下書き→公開の2段階）',
  maxRetries: 3,

  async execute(
    input: GeneratedArticleData[],
    context: PipelineContext
  ): Promise<PublishedArticleData[]> {
    console.log(`[publish-to-microcms] Starting publish (run: ${context.runId})`)

    const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
    const apiKey = process.env.MICROCMS_API_KEY

    if (!serviceDomain || !apiKey) {
      console.warn('[publish-to-microcms] microCMS env vars not set — skipping publish')
      // 環境変数未設定時はモックレスポンスを返す
      return input.map(article => ({
        microcmsId: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        supabaseId: '',
        slug: article.slug,
        title: article.title,
        publishedAt: new Date().toISOString(),
      }))
    }

    if (context.config.dryRun) {
      console.log('[publish-to-microcms] Dry run mode — skipping actual publish')
      return input.map(article => ({
        microcmsId: `dryrun-${article.slug}`,
        supabaseId: '',
        slug: article.slug,
        title: article.title,
        publishedAt: new Date().toISOString(),
      }))
    }

    const client = new MicroCMSWriteClient(serviceDomain, apiKey)
    const publishedArticles: PublishedArticleData[] = []

    for (const article of input) {
      console.log(`[publish-to-microcms] Publishing article: ${article.title}`)

      const payload = toArticlePayload(article)

      // 2段階公開: 下書き作成 → 公開
      const response = await client.createAndPublish('articles', payload)

      const published: PublishedArticleData = {
        microcmsId: response.id,
        supabaseId: '',  // sync-to-supabase ステップで設定される
        slug: article.slug,
        title: article.title,
        publishedAt: response.publishedAt ?? new Date().toISOString(),
      }

      publishedArticles.push(published)
      console.log(`[publish-to-microcms] Published: ${article.title} (id: ${response.id})`)
    }

    console.log(`[publish-to-microcms] Published ${publishedArticles.length} articles`)

    // コンテキストの共有データに保存
    context.sharedData['publishedArticles'] = publishedArticles

    return publishedArticles
  },
}
