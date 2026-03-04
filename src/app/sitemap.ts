// 動的サイトマップ生成
// /sitemap.xml に自動マッピング (Next.js App Router)
//
// microCMS の全記事・カテゴリからサイトマップを生成する
// 環境変数未設定時はモックデータからフォールバック
//
// Phase 3 拡張:
//   - カテゴリページ (priority: 0.7, changeFrequency: weekly)
//   - 監修者ページ (priority: 0.6, changeFrequency: monthly)
//   - aboutページ (priority: 0.5, changeFrequency: monthly)
//   - 記事ページ (priority: 0.8, changeFrequency: weekly)

import type { MetadataRoute } from 'next'
import { getArticles, getCategories } from '@/lib/microcms/client'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://menscataly.com'

// ============================================================
// 監修者スラッグ定義（カテゴリ別）
// ============================================================

const SUPERVISOR_SLUGS = [
  { slug: 'aga-dr-tanaka', name: 'AGA治療 監修医', category: 'aga' },
  { slug: 'ed-dr-suzuki', name: 'ED治療 監修医', category: 'ed' },
  { slug: 'hair-removal-dr-yamamoto', name: '医療脱毛 監修医', category: 'hair-removal' },
  { slug: 'skincare-dr-sato', name: 'スキンケア 監修医', category: 'skincare' },
  { slug: 'column-writer-kobayashi', name: 'サプリメント 監修専門家', category: 'column' },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── カテゴリページ (動的データ取得) ─────────────────────────
  let categoryPages: MetadataRoute.Sitemap = []
  let articlePages: MetadataRoute.Sitemap = []

  try {
    const categoriesResult = await getCategories()
    categoryPages = categoriesResult.contents.map((cat) => ({
      url: `${BASE_URL}/articles?category=${cat.slug}`,
      lastModified: new Date(cat.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch (err) {
    console.error('[sitemap] Failed to fetch categories:', err)
  }

  // ── 記事ページ (動的データ取得) ─────────────────────────────
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
        priority: 0.8,
      }
    })
  } catch (err) {
    console.error('[sitemap] Failed to fetch articles:', err)
  }

  // 静的ページの lastModified は固定日時を使用
  // cacheComponents 有効時、new Date() はビルド時刻に固定されるため
  // 静的ページでは明示的な固定日時を使用する
  const lastModified = new Date('2026-03-01T00:00:00.000Z')

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
    {
      url: `${BASE_URL}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/disclaimer`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/advertising-policy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // ── 監修者ページ (E-E-A-T 強化) ──────────────────────────
  const supervisorPages: MetadataRoute.Sitemap = SUPERVISOR_SLUGS.map(
    (supervisor) => ({
      url: `${BASE_URL}/supervisors/${supervisor.slug}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })
  )

  return [
    ...staticPages,
    ...categoryPages,
    ...supervisorPages,
    ...articlePages,
  ]
}
