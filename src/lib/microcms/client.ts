// microCMS クライアント
// 依存: microcms-js-sdk
// インストール: npm install microcms-js-sdk

import { createClient } from 'microcms-js-sdk'
import type {
  Article,
  ArticleSummary,
  Author,
  Category,
  MicroCMSListResponse,
} from '@/types/microcms'

if (!process.env.MICROCMS_SERVICE_DOMAIN) {
  throw new Error('MICROCMS_SERVICE_DOMAIN is not defined')
}
if (!process.env.MICROCMS_API_KEY) {
  throw new Error('MICROCMS_API_KEY is not defined')
}

const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: process.env.MICROCMS_API_KEY,
})

// ============================================================
// articles API
// ============================================================

export interface GetArticlesOptions {
  limit?: number
  offset?: number
  fields?: (keyof ArticleSummary)[]
  filters?: string
  orders?: string
  q?: string
}

export async function getArticles(
  options: GetArticlesOptions = {}
): Promise<MicroCMSListResponse<ArticleSummary>> {
  return client.getList<ArticleSummary>({
    endpoint: 'articles',
    queries: {
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
      fields: options.fields?.join(','),
      filters: options.filters,
      orders: options.orders ?? '-updatedAt',
      q: options.q,
    },
  })
}

export async function getArticle(id: string): Promise<Article> {
  return client.getListDetail<Article>({
    endpoint: 'articles',
    contentId: id,
  })
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const res = await client.getList<Article>({
    endpoint: 'articles',
    queries: {
      filters: `slug[equals]${slug}`,
      limit: 1,
    },
  })
  return res.contents[0] ?? null
}

export async function getArticlesByCategory(
  categoryId: string,
  options: Pick<GetArticlesOptions, 'limit' | 'offset'> = {}
): Promise<MicroCMSListResponse<ArticleSummary>> {
  return getArticles({
    ...options,
    filters: `category[equals]${categoryId}`,
  })
}

// ============================================================
// categories API
// ============================================================

export async function getCategories(): Promise<MicroCMSListResponse<Category>> {
  return client.getList<Category>({
    endpoint: 'categories',
    queries: { limit: 100 },
  })
}

export async function getCategory(id: string): Promise<Category> {
  return client.getListDetail<Category>({
    endpoint: 'categories',
    contentId: id,
  })
}

// ============================================================
// authors API
// ============================================================

export async function getAuthors(): Promise<MicroCMSListResponse<Author>> {
  return client.getList<Author>({
    endpoint: 'authors',
    queries: { limit: 100 },
  })
}

export async function getAuthor(id: string): Promise<Author> {
  return client.getListDetail<Author>({
    endpoint: 'authors',
    contentId: id,
  })
}
