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
import type { MicroCMSArticle, MicroCMSCategory, MicroCMSArticleQueries } from '@/types/microcms'

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
} as const

// ============================================================
// 記事 API
// ============================================================

/**
 * 記事一覧を取得する
 * @param params - クエリパラメータ (limit, offset, filters, orders, category 等)
 */
export async function getArticles(
  params: MicroCMSArticleQueries = {}
): Promise<MicroCMSListResponse<MicroCMSArticle>> {
  const client = getMicroCMSClient()

  // category クエリを microCMS filters 形式に変換
  const { category, depth: _depth, ...rest } = params
  const queries: MicroCMSQueries = { ...rest }

  if (category) {
    const categoryFilter = `category[equals]${category}`
    queries.filters = queries.filters
      ? `${queries.filters}[and]${categoryFilter}`
      : categoryFilter
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
export async function getArticleBySlug(slug: string): Promise<MicroCMSArticle | null> {
  const client = getMicroCMSClient()

  const response = await client.getList<MicroCMSArticle>({
    endpoint: ENDPOINTS.articles,
    queries: {
      filters: `slug[equals]${slug}`,
      limit: 1,
    },
  })

  return response.contents[0] ?? null
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

// ============================================================
// カテゴリ API
// ============================================================

/**
 * カテゴリ一覧を取得する
 * @param params - クエリパラメータ
 */
export async function getCategories(
  params: MicroCMSQueries = {}
): Promise<MicroCMSListResponse<MicroCMSCategory>> {
  const client = getMicroCMSClient()

  const queries: MicroCMSQueries = {
    limit: 100,
    orders: 'display_order',
    ...params,
  }

  const response = await client.getList<MicroCMSCategory>({
    endpoint: ENDPOINTS.categories,
    queries,
  })

  return response
}

/**
 * スラッグでカテゴリを1件取得する
 * @param slug - カテゴリスラッグ
 */
export async function getCategoryBySlug(slug: string): Promise<MicroCMSCategory | null> {
  const client = getMicroCMSClient()

  const response = await client.getList<MicroCMSCategory>({
    endpoint: ENDPOINTS.categories,
    queries: {
      filters: `slug[equals]${slug}`,
      limit: 1,
    },
  })

  return response.contents[0] ?? null
}
