// 動的サイトマップ生成
// /sitemap.xml に自動マッピング (Next.js App Router)
//
// microCMS の全記事からサイトマップを生成する
// 環境変数未設定時はモックデータからフォールバック

import type { MetadataRoute } from 'next'
import { getArticles, getCategories } from '@/lib/microcms/client'

const BASE_URL = 'https://menscataly.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── カテゴリページ & 記事ページ (動的データ取得) ──────────────
  let categoryPages: MetadataRoute.Sitemap = []
  let articlePages: MetadataRoute.Sitemap = []
  let lastModified: Date

  try {
    const categoriesResult = await getCategories()
    categoryPages = categoriesResult.contents.map((cat) => ({
      url: `${BASE_URL}/articles?category=${cat.slug}`,
      lastModified: new Date(cat.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
  } catch (err) {
    console.error('[sitemap] Failed to fetch categories:', err)
  }

  try {
    // 全記事を取得 (最大200件; 超える場合はページングが必要)
    const firstPage = await getArticles({ limit: 100, offset: 0 })
    const allArticles = [...firstPage.contents]

    // totalCount が limit を超える場合は追加フェッチ
    if (firstPage.totalCount > 100) {
      const additionalFetches = Array.from(
        { length: Math.ceil((firstPage.totalCount - 100) / 100) },
        (_, i) => getArticles({ limit: 100, offset: 100 + i * 100 })
      )
      const additionalPages = await Promise.all(additionalFetches)
      allArticles.push(...additionalPages.flatMap((p) => p.contents))
    }

    articlePages = allArticles.map((article) => {
      const slug = article.slug ?? article.id
      return {
        url: `${BASE_URL}/articles/${slug}`,
        lastModified: new Date(article.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }
    })
  } catch (err) {
    console.error('[sitemap] Failed to fetch articles:', err)
  }

  // データ取得後は new Date() を使用可能
  lastModified = new Date()

  // ── 静的ページ ─────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/articles`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  return [...staticPages, ...categoryPages, ...articlePages]
}
