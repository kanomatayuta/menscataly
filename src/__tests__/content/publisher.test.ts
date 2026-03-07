/**
 * ArticlePublisher Unit Tests
 * microCMS 投稿 / ドライラン / ステータス更新 / 削除のテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// モック定義
// ============================================================

// ImagePipeline モック
vi.mock('@/lib/image/pipeline', () => ({
  ImagePipeline: class MockImagePipeline {
    processArticleImage = vi.fn().mockResolvedValue({
      thumbnail: { url: 'https://example.com/thumb.jpg', width: 320, height: 180 },
      card: { url: 'https://example.com/card.jpg', width: 640, height: 360 },
      og: { url: 'https://example.com/og.jpg', width: 1200, height: 630 },
      publicId: 'menscataly/aga/test-slug',
      prompt: 'test prompt',
    })
  },
}))

import { ArticlePublisher } from '@/lib/content/publisher'
import type { Article } from '@/types/content'

// ============================================================
// テスト用データ
// ============================================================

const createArticle = (overrides: Partial<Article> = {}): Article => ({
  title: 'AGA治療の費用ガイド',
  slug: 'aga-treatment-cost',
  lead: 'AGA治療にかかる費用について解説します。',
  content: '<h2>AGA治療の費用</h2><p>AGA治療の費用について詳しく解説します。AGA治療にはフィナステリドやミノキシジルなどの薬物療法があり、費用はクリニックによって異なります。一般的な月額費用は5,000円から30,000円程度です。</p>',
  sections: [
    {
      heading: 'AGA治療の費用',
      level: 'h2',
      content: 'AGA治療の費用について詳しく解説します。',
    },
  ],
  category: 'aga',
  seo: {
    title: 'AGA治療の費用ガイド',
    description: 'AGA治療にかかる費用について解説',
    keywords: ['AGA', '費用', '治療'],
  },
  author: {
    name: 'MENS CATALY 編集部',
    credentials: 'メディア編集スタッフ',
    bio: 'テスト用著者プロフィール',
  },
  supervisor: {
    name: '田中太郎',
    credentials: '皮膚科専門医',
    bio: '監修者プロフィール',
  },
  references: [
    { title: 'AGA診療ガイドライン', url: 'https://example.com/ref' },
  ],
  publishedAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  readingTime: 5,
  tags: ['AGA', '費用'],
  hasPRDisclosure: true,
  isCompliant: true,
  complianceScore: 100,
  ...overrides,
})

// ============================================================
// テスト
// ============================================================

describe('ArticlePublisher', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  // ============================================================
  // ドライランモード
  // ============================================================

  describe('publishToMicroCMS — ドライラン', () => {
    beforeEach(() => {
      // microCMS 未設定でドライランモードに
      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY
    })

    it('microCMS 未設定時にドライランで動作すること', async () => {
      const publisher = new ArticlePublisher()
      const article = createArticle()
      const result = await publisher.publishToMicroCMS(article)

      expect(result.isDryRun).toBe(true)
      expect(result.contentId).toContain('dry-run-')
      expect(result.url).toBe('https://menscataly.com/articles/aga-treatment-cost')
      expect(result.status).toBe('draft')
      expect(result.publishedAt).toBeDefined()
    })

    it('ドライラン時にステータスオプションが反映されること', async () => {
      const publisher = new ArticlePublisher()
      const article = createArticle()
      const result = await publisher.publishToMicroCMS(article, { status: 'published' })

      expect(result.isDryRun).toBe(true)
      expect(result.status).toBe('published')
    })
  })

  // ============================================================
  // microCMS API 連携
  // ============================================================

  describe('publishToMicroCMS — API連携', () => {
    beforeEach(() => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
      process.env.MICROCMS_API_KEY = 'test-api-key'
    })

    it('新規記事をPOSTで投稿すること', async () => {
      const mockFetch = vi.fn()
        // findCategoryId
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ contents: [{ id: 'cat-aga-001' }] }),
        } as unknown as Response)
        // resolveTagIds: tag search
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ contents: [{ id: 'tag-001' }] }),
        } as unknown as Response)
        // resolveTagIds: tag search
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ contents: [] }),
        } as unknown as Response)
        // resolveTagIds: tag create
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'tag-002' }),
        } as unknown as Response)
        // POST article
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'art-new-001' }),
        } as unknown as Response)

      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()
      const article = createArticle()
      const result = await publisher.publishToMicroCMS(article)

      expect(result.isDryRun).toBe(false)
      expect(result.contentId).toBe('art-new-001')
      expect(result.url).toBe('https://menscataly.com/articles/aga-treatment-cost')
      expect(result.status).toBe('draft')

      // POST を検証（最後のfetchコール）
      const postCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
      expect(postCall[0]).toContain('/api/v1/articles')
      expect(postCall[1].method).toBe('POST')
    })

    it('既存記事をPATCHで更新すること', async () => {
      const mockFetch = vi.fn()
        // findCategoryId
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ contents: [{ id: 'cat-aga-001' }] }),
        } as unknown as Response)
        // resolveTagIds (no tags)
        // POST/PATCH article
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'existing-art-001' }),
        } as unknown as Response)

      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()
      const article = createArticle({ id: 'existing-art-001', tags: [] })
      const result = await publisher.publishToMicroCMS(article)

      expect(result.contentId).toBe('existing-art-001')

      // PATCH を検証
      const patchCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
      expect(patchCall[0]).toContain('/articles/existing-art-001')
      expect(patchCall[1].method).toBe('PATCH')
    })

    it('microCMS API エラー時に例外がスローされること', async () => {
      const mockFetch = vi.fn()
        // findCategoryId
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ contents: [] }),
        } as unknown as Response)
        // POST article fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: () => Promise.resolve('Invalid API key'),
        } as unknown as Response)

      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()
      const article = createArticle({ tags: [] })

      await expect(publisher.publishToMicroCMS(article)).rejects.toThrow(
        'microCMS API error: 401 Unauthorized'
      )
    })
  })

  // ============================================================
  // updateStatus
  // ============================================================

  describe('updateStatus', () => {
    it('ドライラン時はAPIを呼ばないこと', async () => {
      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()
      await publisher.updateStatus('art-001', 'published')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('API設定時にPATCHリクエストを送信すること', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
      process.env.MICROCMS_API_KEY = 'test-api-key'

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as unknown as Response)
      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()
      await publisher.updateStatus('art-001', 'published')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/art-001'),
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    it('API エラー時に例外がスローされること', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
      process.env.MICROCMS_API_KEY = 'test-api-key'

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      } as unknown as Response)
      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()

      await expect(publisher.updateStatus('art-001', 'published')).rejects.toThrow(
        'Failed to update status'
      )
    })
  })

  // ============================================================
  // deleteArticle
  // ============================================================

  describe('deleteArticle', () => {
    it('ドライラン時はAPIを呼ばないこと', async () => {
      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()
      await publisher.deleteArticle('art-001')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('API設定時にDELETEリクエストを送信すること', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
      process.env.MICROCMS_API_KEY = 'test-api-key'

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
      } as unknown as Response)
      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()
      await publisher.deleteArticle('art-001')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/articles/art-001'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })

    it('DELETE失敗時に例外がスローされること', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
      process.env.MICROCMS_API_KEY = 'test-api-key'

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Article not found'),
      } as unknown as Response)
      vi.stubGlobal('fetch', mockFetch)

      const publisher = new ArticlePublisher()

      await expect(publisher.deleteArticle('nonexistent')).rejects.toThrow(
        'Failed to delete article'
      )
    })
  })

  // ============================================================
  // generateThumbnail
  // ============================================================

  describe('generateThumbnail', () => {
    it('画像パイプラインからOG画像URLを返すこと', async () => {
      const publisher = new ArticlePublisher()
      const article = createArticle()
      const url = await publisher.generateThumbnail(article)

      expect(url).toBe('https://example.com/og.jpg')
    })
  })
})
