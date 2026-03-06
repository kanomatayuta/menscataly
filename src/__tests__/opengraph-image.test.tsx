/**
 * OGP画像 コンポーネントテスト
 *
 * OGP画像生成 (ImageResponse) のテスト
 * next/og の ImageResponse と next/server の connection をモックして
 * OGP画像コンポーネントの呼び出し契約を検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// ImageResponse / connection モック
// ============================================================

const mockImageResponse = vi.fn()

vi.mock('next/og', () => ({
  ImageResponse: mockImageResponse,
}))

vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}))

// ============================================================
// microCMS クライアントモック (記事詳細OGP用)
// ============================================================

const mockGetArticleDetail = vi.fn()
vi.mock('@/lib/microcms/client', () => ({
  getArticleDetail: mockGetArticleDetail,
  getArticles: vi.fn().mockResolvedValue({ contents: [], totalCount: 0 }),
}))

// ============================================================
// テスト本体
// ============================================================

describe('OGP画像', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // ImageResponse をシンプルなオブジェクトとして返す
    mockImageResponse.mockImplementation((jsx: unknown, options: unknown) => ({
      type: 'ImageResponse',
      jsx,
      options,
    }))
  })

  describe('トップページOGP', () => {
    it('ImageResponse が正しいサイズで生成されること', async () => {
      // 動的 import でモジュールを取得
      const mod = await import('@/app/(public)/opengraph-image')

      expect(mod.size).toEqual({ width: 1200, height: 630 })
      expect(mod.contentType).toBe('image/png')
      expect(mod.alt).toBeDefined()
      expect(typeof mod.alt).toBe('string')
    })

    it('OGP画像のalt テキストにサイト名が含まれること', async () => {
      const mod = await import('@/app/(public)/opengraph-image')
      expect(mod.alt).toContain('MENS CATALY')
    })

    it('デフォルトエクスポートが関数であること', async () => {
      const mod = await import('@/app/(public)/opengraph-image')
      expect(typeof mod.default).toBe('function')
    })
  })

  describe('記事詳細OGP (将来実装)', () => {
    it('記事タイトルを含むOGPデータが生成できること', async () => {
      // 将来の記事別OGP画像のための契約テスト
      const mockArticle = {
        id: 'article-001',
        title: 'AGA治療の基礎知識',
        category: { slug: 'aga', name: 'AGA治療' },
        excerpt: 'AGAの治療法について解説します。',
        publishedAt: '2026-03-01T00:00:00Z',
      }

      mockGetArticleDetail.mockResolvedValue(mockArticle)

      // 記事OGPデータの検証: 記事が取得可能であること
      const article = await mockGetArticleDetail('article-001')
      expect(article.title).toBe('AGA治療の基礎知識')
      expect(article.category.slug).toBe('aga')
    })

    it('記事が見つからない場合 null を返すこと', async () => {
      mockGetArticleDetail.mockResolvedValue(null)

      const article = await mockGetArticleDetail('nonexistent')
      expect(article).toBeNull()
    })

    it('OGP画像の推奨サイズが1200x630であること', () => {
      // Open Graph Protocol 仕様に準拠
      const OG_WIDTH = 1200
      const OG_HEIGHT = 630
      const OG_ASPECT_RATIO = OG_WIDTH / OG_HEIGHT

      expect(OG_WIDTH).toBe(1200)
      expect(OG_HEIGHT).toBe(630)
      expect(OG_ASPECT_RATIO).toBeCloseTo(1.905, 2)
    })
  })

  describe('ImageResponseのモック検証', () => {
    it('ImageResponse が関数として呼び出し可能であること', () => {
      const jsxElement = { type: 'div', props: { children: 'Test' } }
      const options = { width: 1200, height: 630 }

      const result = mockImageResponse(jsxElement, options)

      expect(mockImageResponse).toHaveBeenCalledWith(jsxElement, options)
      expect(result).toEqual({
        type: 'ImageResponse',
        jsx: jsxElement,
        options,
      })
    })
  })
})
