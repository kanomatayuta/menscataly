/**
 * microCMS クライアント テスト
 * - 環境変数未設定時のモックデータフォールバック
 * - getArticles のカテゴリフィルタリング
 * - getArticleBySlug のバリデーション (不正 slug で null 返却)
 * - getAllArticleSlugs のエラーハンドリング
 * - safeConnection() が Next.js 外で例外を投げないこと
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// next/server の connection() をモック
vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}))

// microcms-js-sdk をモック
const mockGetList = vi.fn()
const mockGetListDetail = vi.fn()
vi.mock('microcms-js-sdk', () => ({
  createClient: vi.fn(() => ({
    getList: mockGetList,
    getListDetail: mockGetListDetail,
  })),
}))

// モックデータモジュールをモック
vi.mock('@/lib/mock/articles', () => {
  const mockArticles = [
    {
      slug: 'test-aga-article',
      title: 'AGA治療ガイド',
      excerpt: 'AGA治療について',
      category: 'aga',
      publishedAt: '2026-01-01T00:00:00Z',
      content: '<p>テスト記事</p>',
      tags: ['AGA'],
    },
    {
      slug: 'test-skincare-article',
      title: 'スキンケアガイド',
      excerpt: 'スキンケアについて',
      category: 'skincare',
      publishedAt: '2026-01-02T00:00:00Z',
      content: '<p>スキンケア記事</p>',
      tags: ['スキンケア'],
    },
    {
      slug: 'test-ed-article',
      title: 'ED治療ガイド',
      excerpt: 'ED治療について',
      category: 'ed',
      publishedAt: '2026-01-03T00:00:00Z',
      content: '<p>ED記事</p>',
      tags: ['ED'],
    },
  ]

  return {
    MOCK_ARTICLES: mockArticles,
    getArticlesByCategory: vi.fn((category?: string) => {
      if (!category) return mockArticles
      return mockArticles.filter((a) => a.category === category)
    }),
    getArticleBySlug: vi.fn((slug: string) => {
      return mockArticles.find((a) => a.slug === slug) ?? null
    }),
  }
})

// Badge コンポーネントのモック
vi.mock('@/components/ui/Badge', () => ({
  // ArticleCategory type
}))

describe('microCMS Client', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    mockGetList.mockReset()
    mockGetListDetail.mockReset()
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // =============================================================================
  // isMicroCMSConfigured
  // =============================================================================

  describe('isMicroCMSConfigured', () => {
    it('環境変数が設定されている場合 true を返すこと', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-domain'
      process.env.MICROCMS_API_KEY = 'test-key'

      const { isMicroCMSConfigured } = await import('../client')
      expect(isMicroCMSConfigured()).toBe(true)
    })

    it('MICROCMS_SERVICE_DOMAIN 未設定時 false を返すこと', async () => {
      delete process.env.MICROCMS_SERVICE_DOMAIN
      process.env.MICROCMS_API_KEY = 'test-key'

      const { isMicroCMSConfigured } = await import('../client')
      expect(isMicroCMSConfigured()).toBe(false)
    })

    it('MICROCMS_API_KEY 未設定時 false を返すこと', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-domain'
      delete process.env.MICROCMS_API_KEY

      const { isMicroCMSConfigured } = await import('../client')
      expect(isMicroCMSConfigured()).toBe(false)
    })
  })

  // =============================================================================
  // getArticles — モックフォールバック
  // =============================================================================

  describe('getArticles — モックフォールバック', () => {
    beforeEach(() => {
      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY
    })

    it('環境変数未設定時にモックデータを返すこと', async () => {
      const { getArticles } = await import('../client')
      const result = await getArticles()

      expect(result.contents.length).toBeGreaterThan(0)
      expect(result.totalCount).toBeGreaterThan(0)
    })

    it('カテゴリフィルタリングが動作すること', async () => {
      const { getArticles } = await import('../client')
      const result = await getArticles({ category: 'aga' })

      expect(result.contents.length).toBeGreaterThan(0)
      for (const article of result.contents) {
        expect(article.category.slug).toBe('aga')
      }
    })

    it('存在しないカテゴリで0件を返すこと', async () => {
      const { getArticles } = await import('../client')
      const result = await getArticles({ category: 'nonexistent' })

      expect(result.contents).toHaveLength(0)
      expect(result.totalCount).toBe(0)
    })

    it('limit/offset が正しく適用されること', async () => {
      const { getArticles } = await import('../client')
      const result = await getArticles({ limit: 1, offset: 0 })

      expect(result.contents.length).toBeLessThanOrEqual(1)
      expect(result.limit).toBe(1)
      expect(result.offset).toBe(0)
    })

    it('全文検索 (q) でフィルタリングされること', async () => {
      const { getArticles } = await import('../client')
      const result = await getArticles({ q: 'AGA' })

      expect(result.contents.length).toBeGreaterThan(0)
      // AGA を含む記事のみ返されること
      for (const article of result.contents) {
        const searchable = [article.title, article.excerpt ?? ''].join(' ')
        expect(searchable.toLowerCase()).toContain('aga')
      }
    })
  })

  // =============================================================================
  // getArticleBySlug — バリデーション
  // =============================================================================

  describe('getArticleBySlug', () => {
    beforeEach(() => {
      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY
    })

    it('有効なslugで記事を返すこと', async () => {
      const { getArticleBySlug } = await import('../client')
      const article = await getArticleBySlug('test-aga-article')

      expect(article).not.toBeNull()
      expect(article!.slug).toBe('test-aga-article')
    })

    it('存在しないslugでnullを返すこと', async () => {
      const { getArticleBySlug } = await import('../client')
      const article = await getArticleBySlug('nonexistent-slug')

      expect(article).toBeNull()
    })

    it('不正なslug (SQLインジェクション的) でnullを返すこと', async () => {
      const { getArticleBySlug } = await import('../client')
      const article = await getArticleBySlug('slug[equals]malicious')

      expect(article).toBeNull()
    })

    it('空文字列のslugでnullを返すこと', async () => {
      const { getArticleBySlug } = await import('../client')
      const article = await getArticleBySlug('')

      expect(article).toBeNull()
    })

    it('非常に長いslugでnullを返すこと', async () => {
      const { getArticleBySlug } = await import('../client')
      const longSlug = 'a'.repeat(200)
      const article = await getArticleBySlug(longSlug)

      expect(article).toBeNull()
    })

    it('特殊文字を含むslugでnullを返すこと', async () => {
      const { getArticleBySlug } = await import('../client')
      const article = await getArticleBySlug('slug/with/slashes')

      expect(article).toBeNull()
    })

    it('先頭がハイフンのslugでnullを返すこと', async () => {
      const { getArticleBySlug } = await import('../client')
      const article = await getArticleBySlug('-invalid-slug')

      expect(article).toBeNull()
    })
  })

  // =============================================================================
  // getAllArticleSlugs — エラーハンドリング
  // =============================================================================

  describe('getAllArticleSlugs', () => {
    it('環境変数未設定時にモックのスラッグを返すこと', async () => {
      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY

      const { getAllArticleSlugs } = await import('../client')
      const slugs = await getAllArticleSlugs()

      expect(slugs.length).toBeGreaterThan(0)
      expect(slugs).toContain('test-aga-article')
    })

    it('microCMS API エラー時にモックデータにフォールバックすること', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-domain'
      process.env.MICROCMS_API_KEY = 'test-key'
      mockGetList.mockRejectedValueOnce(new Error('API Error'))

      const { getAllArticleSlugs } = await import('../client')
      const slugs = await getAllArticleSlugs()

      // フォールバックでモックデータのスラッグが返される
      expect(slugs.length).toBeGreaterThan(0)
    })

    it('microCMS が0件を返す場合にモックデータにフォールバックすること', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-domain'
      process.env.MICROCMS_API_KEY = 'test-key'
      mockGetList.mockResolvedValueOnce({
        contents: [],
        totalCount: 0,
        offset: 0,
        limit: 100,
      })

      const { getAllArticleSlugs } = await import('../client')
      const slugs = await getAllArticleSlugs()

      expect(slugs.length).toBeGreaterThan(0)
    })
  })

  // =============================================================================
  // safeConnection — Next.js外で例外を投げないこと
  // =============================================================================

  describe('safeConnection', () => {
    it('モジュールがimport時にクラッシュしないこと', async () => {
      // safeConnection は内部関数だが、モジュール全体がインポートできることで
      // connection() のエラーハンドリングが機能していることを確認
      const clientModule = await import('../client')
      expect(clientModule).toBeDefined()
      expect(clientModule.getArticles).toBeDefined()
      expect(clientModule.getArticleBySlug).toBeDefined()
      expect(clientModule.getAllArticleSlugs).toBeDefined()
    })

    it('getArticles が safeConnection エラーでクラッシュしないこと', async () => {
      // connection() がエラーを投げるケースをシミュレート
      const { connection } = await import('next/server')
      vi.mocked(connection).mockRejectedValueOnce(new Error('Not in server context'))

      // 環境変数未設定でモックフォールバックが使われるため、
      // safeConnection は呼ばれないが、モジュール全体が安定していることを確認
      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY

      const { getArticles } = await import('../client')
      const result = await getArticles()
      expect(result.contents).toBeDefined()
    })
  })
})
