// microCMS クライアント
// 依存: microcms-js-sdk v3
//
// 環境変数:
//   MICROCMS_SERVICE_DOMAIN  — microCMS サービスドメイン (e.g. 'your-service')
//   MICROCMS_API_KEY         — microCMS APIキー

import {
  createClient as createMicroCMSClient,
  type MicroCMSQueries,
  type MicroCMSListResponse,
} from 'microcms-js-sdk'
import type { MicroCMSArticle, MicroCMSCategory, MicroCMSTag, MicroCMSArticleQueries } from '@/types/microcms'
import {
  MOCK_ARTICLES,
  getArticlesByCategory as getMockArticlesByCategory,
  getArticleBySlug as getMockArticleBySlug,
} from '@/lib/mock/articles'
import type { ArticleCategory } from '@/components/ui/Badge'

// ============================================================
// 環境変数チェック
// ============================================================

export function isMicroCMSConfigured(): boolean {
  return !!(process.env.MICROCMS_SERVICE_DOMAIN && process.env.MICROCMS_API_KEY)
}

// ============================================================
// モックデータ → MicroCMSArticle 変換ヘルパー
// ============================================================

function mockToMicroCMSArticle(mock: ReturnType<typeof getMockArticleBySlug>): MicroCMSArticle | null {
  if (!mock) return null

  // Next.js 16 cacheComponents では new Date() がプリレンダリング時に禁止されるため
  // mock の publishedAt をフォールバック日時として使用する
  const fallbackDate = mock.publishedAt
  const makeCat = (id: string, name: string) => ({
    id, name, slug: id, createdAt: fallbackDate, updatedAt: fallbackDate,
    publishedAt: fallbackDate, revisedAt: fallbackDate,
  })

  const categoryMap: Record<string, ReturnType<typeof makeCat>> = {
    aga: makeCat('aga', 'AGA・薄毛'),
    'hair-removal': makeCat('hair-removal', 'メンズ脱毛'),
    skincare: makeCat('skincare', 'スキンケア'),
    ed: makeCat('ed', 'ED治療'),
    column: makeCat('column', 'コラム'),
  }

  return {
    id: mock.slug,
    createdAt: mock.publishedAt,
    updatedAt: mock.updatedAt ?? mock.publishedAt,
    publishedAt: mock.publishedAt,
    revisedAt: mock.updatedAt ?? mock.publishedAt,
    title: mock.title,
    slug: mock.slug,
    content: mock.content,
    excerpt: mock.excerpt,
    category: categoryMap[mock.category] ?? { id: mock.category, name: mock.category, slug: mock.category, createdAt: fallbackDate, updatedAt: fallbackDate, publishedAt: fallbackDate, revisedAt: fallbackDate },
    thumbnail: mock.eyecatch ? { url: mock.eyecatch.url, height: mock.eyecatch.height, width: mock.eyecatch.width } : undefined,
    thumbnail_url: mock.eyecatch?.url,
    author_name: mock.supervisor?.name,
    tags: mock.tags?.map((t) => ({
      id: t, name: t, slug: t,
      createdAt: fallbackDate, updatedAt: fallbackDate, publishedAt: fallbackDate, revisedAt: fallbackDate,
    })),
  }
}

// ============================================================
// クライアント初期化
// ============================================================

function getMicroCMSClient() {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain) {
    throw new Error('MICROCMS_SERVICE_DOMAIN is not defined')
  }
  if (!apiKey) {
    throw new Error('MICROCMS_API_KEY is not defined')
  }

  return createMicroCMSClient({ serviceDomain, apiKey })
}

// ============================================================
// API エンドポイント名
// ============================================================

const ENDPOINTS = {
  articles: 'articles',
  categories: 'categories',
  tags: 'tags',
} as const

// ============================================================
// 記事 API
// ============================================================

/**
 * 記事一覧を取得する
 * @param params - クエリパラメータ (limit, offset, filters, orders, category 等)
 */
/**
 * カテゴリスラッグ → microCMS カテゴリID マッピングキャッシュ
 * リレーション型フィールドは ID でフィルタする必要がある
 */
let categorySlugToIdCache: Record<string, string> | null = null

async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  // キャッシュがあればそこから返す
  if (categorySlugToIdCache && categorySlugToIdCache[slug]) {
    return categorySlugToIdCache[slug]
  }

  try {
    const client = getMicroCMSClient()
    const response = await client.getList<MicroCMSCategory>({
      endpoint: ENDPOINTS.categories,
      queries: { filters: `slug[equals]${slug}`, limit: 1 },
    })

    if (response.contents.length > 0) {
      // 全カテゴリをキャッシュに入れるため、全件取得
      if (!categorySlugToIdCache) {
        const allCategories = await client.getList<MicroCMSCategory>({
          endpoint: ENDPOINTS.categories,
          queries: { limit: 100 },
        })
        categorySlugToIdCache = {}
        for (const cat of allCategories.contents) {
          if (cat.slug) {
            categorySlugToIdCache[cat.slug] = cat.id
          }
        }
      }
      return categorySlugToIdCache[slug] ?? response.contents[0].id
    }
  } catch (err) {
    console.error(`[microCMS] Failed to resolve category slug "${slug}":`, err)
  }

  return null
}

export async function getArticles(
  params: MicroCMSArticleQueries = {}
): Promise<MicroCMSListResponse<MicroCMSArticle>> {
  // 環境変数未設定時はモックデータにフォールバック
  if (!isMicroCMSConfigured()) {
    const mocks = getMockArticlesByCategory(params.category as ArticleCategory | undefined)
    const limit = params.limit ?? 10
    const offset = params.offset ?? 0
    const sliced = mocks.slice(offset, offset + limit)
    const contents = sliced.map((m) => mockToMicroCMSArticle(m)).filter((a): a is MicroCMSArticle => a !== null)
    return { contents, totalCount: mocks.length, offset, limit }
  }

  const client = getMicroCMSClient()

  // category クエリを microCMS filters 形式に変換
  // リレーション型フィールドは カテゴリID でフィルタする必要がある
  const { category, depth: _depth, ...rest } = params
  const queries: MicroCMSQueries = { ...rest }

  if (category) {
    // カテゴリスラッグからIDを解決
    const categoryId = await getCategoryIdBySlug(category)
    if (categoryId) {
      const categoryFilter = `category[equals]${categoryId}`
      queries.filters = queries.filters
        ? `${queries.filters}[and]${categoryFilter}`
        : categoryFilter
    } else {
      // IDが見つからない場合はスラッグをそのまま使用（フォールバック）
      const categoryFilter = `category[equals]${category}`
      queries.filters = queries.filters
        ? `${queries.filters}[and]${categoryFilter}`
        : categoryFilter
    }
  }

  // デフォルト値
  if (queries.limit === undefined) {
    queries.limit = 10
  }
  if (queries.orders === undefined) {
    queries.orders = '-publishedAt'
  }

  const response = await client.getList<MicroCMSArticle>({
    endpoint: ENDPOINTS.articles,
    queries,
  })

  return response
}

/**
 * スラッグで記事を1件取得する
 * microCMS では slug フィールドでフィルタして先頭1件を返す
 * @param slug - 記事スラッグ
 */
/** slug バリデーション — microCMS filters インジェクション防止 */
function isValidSlug(slug: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,128}$/.test(slug)
}

export async function getArticleBySlug(slug: string, draftKey?: string): Promise<MicroCMSArticle | null> {
  // slug バリデーション (filters クエリインジェクション防止)
  if (!isValidSlug(slug)) return null

  // 環境変数未設定時はモックデータにフォールバック
  if (!isMicroCMSConfigured()) {
    const mock = getMockArticleBySlug(slug)
    return mock ? mockToMicroCMSArticle(mock) : null
  }

  const client = getMicroCMSClient()

  const queries: MicroCMSQueries = {
    filters: `slug[equals]${slug}`,
    limit: 1,
  }
  if (draftKey) {
    queries.draftKey = draftKey
  }

  const response = await client.getList<MicroCMSArticle>({
    endpoint: ENDPOINTS.articles,
    queries,
  })

  const article = response.contents[0] ?? null
  // microCMS に記事が見つからない場合はモックデータにフォールバック
  if (!article) {
    const mock = getMockArticleBySlug(slug)
    return mock ? mockToMicroCMSArticle(mock) : null
  }
  return article
}

/**
 * microCMS コンテンツIDで記事を1件取得する
 * @param id - microCMS コンテンツID
 * @param draftKey - 下書きプレビュー用キー (省略可)
 */
export async function getArticleById(
  id: string,
  draftKey?: string
): Promise<MicroCMSArticle> {
  const client = getMicroCMSClient()

  const article = await client.getListDetail<MicroCMSArticle>({
    endpoint: ENDPOINTS.articles,
    contentId: id,
    queries: draftKey ? { draftKey } : undefined,
  })

  return article
}

/**
 * 全記事のスラッグ一覧を取得する (generateStaticParams 用)
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  if (!isMicroCMSConfigured()) {
    return MOCK_ARTICLES.map((a) => a.slug)
  }
  const client = getMicroCMSClient()
  const response = await client.getList<MicroCMSArticle>({
    endpoint: ENDPOINTS.articles,
    queries: { fields: 'id,slug', limit: 100, orders: '-publishedAt' },
  })
  const slugs = response.contents.map((a) => a.slug ?? a.id)
  // microCMS に記事が0件の場合はモックデータにフォールバック (ビルドエラー回避)
  if (slugs.length === 0) {
    return MOCK_ARTICLES.map((a) => a.slug)
  }
  return slugs
}

// ============================================================
// カテゴリ API
// ============================================================

export async function getCategories(
  params: MicroCMSQueries = {}
): Promise<MicroCMSListResponse<MicroCMSCategory>> {
  if (!isMicroCMSConfigured()) {
    const ts = '2024-01-01T00:00:00.000Z'  // 静的フォールバック（new Date() はプリレンダリング時禁止）
    const fallback: MicroCMSCategory[] = [
      { id: 'aga', name: 'AGA・薄毛', slug: 'aga', display_order: 1, createdAt: ts, updatedAt: ts, publishedAt: ts, revisedAt: ts },
      { id: 'hair-removal', name: 'メンズ脱毛', slug: 'hair-removal', display_order: 2, createdAt: ts, updatedAt: ts, publishedAt: ts, revisedAt: ts },
      { id: 'skincare', name: 'スキンケア', slug: 'skincare', display_order: 3, createdAt: ts, updatedAt: ts, publishedAt: ts, revisedAt: ts },
      { id: 'ed', name: 'ED治療', slug: 'ed', display_order: 4, createdAt: ts, updatedAt: ts, publishedAt: ts, revisedAt: ts },
      { id: 'column', name: 'コラム', slug: 'column', display_order: 5, createdAt: ts, updatedAt: ts, publishedAt: ts, revisedAt: ts },
    ]
    return { contents: fallback, totalCount: fallback.length, offset: 0, limit: 100 }
  }
  const client = getMicroCMSClient()
  const queries: MicroCMSQueries = { limit: 100, orders: 'display_order', ...params }
  return await client.getList<MicroCMSCategory>({ endpoint: ENDPOINTS.categories, queries })
}

export async function getCategoryBySlug(slug: string): Promise<MicroCMSCategory | null> {
  if (!isMicroCMSConfigured()) {
    const categories = await getCategories()
    return categories.contents.find((c) => c.slug === slug) ?? null
  }
  const client = getMicroCMSClient()
  const response = await client.getList<MicroCMSCategory>({
    endpoint: ENDPOINTS.categories,
    queries: { filters: `slug[equals]${slug}`, limit: 1 },
  })
  return response.contents[0] ?? null
}

// ============================================================
// タグ API
// ============================================================

export async function getTags(
  params: MicroCMSQueries = {}
): Promise<MicroCMSListResponse<MicroCMSTag>> {
  if (!isMicroCMSConfigured()) {
    return { contents: [], totalCount: 0, offset: 0, limit: 100 }
  }
  const client = getMicroCMSClient()
  const queries: MicroCMSQueries = { limit: 100, ...params }
  return await client.getList<MicroCMSTag>({ endpoint: ENDPOINTS.tags, queries })
}
