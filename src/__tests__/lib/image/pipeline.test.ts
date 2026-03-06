/**
 * ImagePipeline ユニットテスト
 *
 * 画像処理パイプライン (Ideogram → Cloudinary → マルチサイズ URL) を検証する。
 * 外部 API (Ideogram, Cloudinary) は全てモックする。
 *
 * - API 未設定時のプレースホルダーフォールバック
 * - Cloudinary URL 生成
 * - バッチ並列処理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImagePipeline } from '@/lib/image/pipeline'
import { IMAGE_SIZES } from '@/lib/image/cloudinary'
import type { IdeogramClient } from '@/lib/image/ideogram'
import type { CloudinaryClient } from '@/lib/image/cloudinary'
import type { ArticleImageRequest, ThumbnailResult, CloudinaryResult } from '@/lib/image/types'

// ==============================================================
// モックファクトリ
// ==============================================================

function createMockIdeogram(overrides: Partial<{ generateThumbnail: ReturnType<typeof vi.fn> }> = {}): IdeogramClient {
  return {
    generateThumbnail: overrides.generateThumbnail ?? vi.fn().mockResolvedValue({
      url: 'https://via.placeholder.com/1280x720',
      width: 1280,
      height: 720,
      prompt: 'Generated prompt',
      isPlaceholder: true,
    } satisfies ThumbnailResult),
    generatePrompt: vi.fn().mockReturnValue('mock prompt'),
  } as unknown as IdeogramClient
}

function createMockCloudinary(overrides: Partial<{
  upload: ReturnType<typeof vi.fn>
  getUrlForSize: ReturnType<typeof vi.fn>
  getOptimizedUrl: ReturnType<typeof vi.fn>
}> = {}): CloudinaryClient {
  return {
    upload: overrides.upload ?? vi.fn().mockResolvedValue({
      publicId: 'menscataly/aga/test-slug',
      secureUrl: 'https://via.placeholder.com/1280x720',
      width: 1280,
      height: 720,
      format: 'webp',
      bytes: 0,
      isPlaceholder: true,
    } satisfies CloudinaryResult),
    getUrlForSize: overrides.getUrlForSize ?? vi.fn().mockImplementation((publicId: string, sizeName: string) => {
      const size = IMAGE_SIZES[sizeName as keyof typeof IMAGE_SIZES]
      return `https://res.cloudinary.com/test/image/upload/w_${size.width},h_${size.height}/${publicId}`
    }),
    getOptimizedUrl: overrides.getOptimizedUrl ?? vi.fn().mockReturnValue('https://res.cloudinary.com/test/image/upload/mock'),
  } as unknown as CloudinaryClient
}

function createMockArticleRequest(overrides: Partial<ArticleImageRequest> = {}): ArticleImageRequest {
  return {
    title: 'AGA治療の費用相場ガイド',
    category: 'aga',
    slug: 'aga-cost-guide',
    ...overrides,
  }
}

// ==============================================================
// ImagePipeline テスト
// ==============================================================

describe('ImagePipeline', () => {
  let mockIdeogram: ReturnType<typeof createMockIdeogram>
  let mockCloudinary: ReturnType<typeof createMockCloudinary>
  let pipeline: ImagePipeline

  beforeEach(() => {
    vi.clearAllMocks()
    mockIdeogram = createMockIdeogram()
    mockCloudinary = createMockCloudinary()
    pipeline = new ImagePipeline(mockIdeogram, mockCloudinary)
  })

  // ==============================================================
  // プレースホルダーフォールバック
  // ==============================================================

  describe('API 未設定時のプレースホルダーフォールバック', () => {
    it('Ideogram がプレースホルダーを返す場合、プレースホルダー画像セットが返ること', async () => {
      const request = createMockArticleRequest()
      const result = await pipeline.processArticleImage(request)

      expect(result).toBeDefined()
      expect(result.thumbnail).toBeDefined()
      expect(result.card).toBeDefined()
      expect(result.og).toBeDefined()
      expect(result.publicId).toBeDefined()
    })

    it('プレースホルダー画像の URL にカテゴリ名が含まれること', async () => {
      const request = createMockArticleRequest({ category: 'skincare' })
      const result = await pipeline.processArticleImage(request)

      // プレースホルダー URL にはカテゴリが含まれる
      expect(result.thumbnail.url).toContain('SKINCARE')
    })

    it('プレースホルダー画像のサイズが正しいこと', async () => {
      const request = createMockArticleRequest()
      const result = await pipeline.processArticleImage(request)

      expect(result.thumbnail.width).toBe(IMAGE_SIZES.thumbnail.width)
      expect(result.thumbnail.height).toBe(IMAGE_SIZES.thumbnail.height)
      expect(result.card.width).toBe(IMAGE_SIZES.card.width)
      expect(result.card.height).toBe(IMAGE_SIZES.card.height)
      expect(result.og.width).toBe(IMAGE_SIZES.og.width)
      expect(result.og.height).toBe(IMAGE_SIZES.og.height)
    })
  })

  // ==============================================================
  // Cloudinary URL 生成 (API 設定済み)
  // ==============================================================

  describe('Cloudinary URL 生成', () => {
    it('Cloudinary 設定済みの場合、3 サイズの URL が返ること', async () => {
      // Ideogram が実際の画像を返すケース
      const mockIdeogramConfigured = createMockIdeogram({
        generateThumbnail: vi.fn().mockResolvedValue({
          url: 'https://ideogram.ai/image/12345.png',
          width: 1280,
          height: 720,
          prompt: 'Real prompt',
          isPlaceholder: false,
        }),
      })

      // Cloudinary が実際の結果を返すケース
      const mockCloudinaryConfigured = createMockCloudinary({
        upload: vi.fn().mockResolvedValue({
          publicId: 'menscataly/aga/aga-cost-guide',
          secureUrl: 'https://res.cloudinary.com/test/image/upload/menscataly/aga/aga-cost-guide.webp',
          width: 1280,
          height: 720,
          format: 'webp',
          bytes: 150000,
          isPlaceholder: false,
        }),
      })

      // fetch をモック
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      })
      vi.stubGlobal('fetch', mockFetch)

      const configuredPipeline = new ImagePipeline(mockIdeogramConfigured, mockCloudinaryConfigured)
      const request = createMockArticleRequest()
      const result = await configuredPipeline.processArticleImage(request)

      expect(result.thumbnail.url).toContain('menscataly/aga/aga-cost-guide')
      expect(result.card.url).toContain('menscataly/aga/aga-cost-guide')
      expect(result.og.url).toContain('menscataly/aga/aga-cost-guide')

      vi.unstubAllGlobals()
    })

    it('Ideogram 成功 + Cloudinary アップロード失敗時、フォールバックが返ること', async () => {
      const mockIdeogramConfigured = createMockIdeogram({
        generateThumbnail: vi.fn().mockResolvedValue({
          url: 'https://ideogram.ai/image/12345.png',
          width: 1280,
          height: 720,
          prompt: 'Real prompt',
          isPlaceholder: false,
        }),
      })

      // fetch が失敗するケース
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
      vi.stubGlobal('fetch', mockFetch)

      const failPipeline = new ImagePipeline(mockIdeogramConfigured, mockCloudinary)
      const request = createMockArticleRequest()
      const result = await failPipeline.processArticleImage(request)

      // Cloudinary もプレースホルダーなのでプレースホルダー画像セットが返る
      expect(result).toBeDefined()
      expect(result.thumbnail).toBeDefined()
      expect(result.publicId).toBeDefined()

      vi.unstubAllGlobals()
    })
  })

  // ==============================================================
  // processArticleImage 基本動作
  // ==============================================================

  describe('processArticleImage 基本動作', () => {
    it('Ideogram の generateThumbnail が呼ばれること', async () => {
      const request = createMockArticleRequest()
      await pipeline.processArticleImage(request)

      expect(mockIdeogram.generateThumbnail).toHaveBeenCalledTimes(1)
      expect(mockIdeogram.generateThumbnail).toHaveBeenCalledWith({
        title: request.title,
        category: request.category,
        aspectRatio: '16:9',
      })
    })

    it('Cloudinary の upload が呼ばれること', async () => {
      const request = createMockArticleRequest()
      await pipeline.processArticleImage(request)

      expect(mockCloudinary.upload).toHaveBeenCalledTimes(1)
    })

    it('publicId が正しい形式であること', async () => {
      const request = createMockArticleRequest({ category: 'hair-removal', slug: 'mens-laser' })
      const result = await pipeline.processArticleImage(request)

      // プレースホルダー時は buildPlaceholderImages で生成される publicId
      expect(result.publicId).toContain('menscataly/hair-removal/mens-laser')
    })

    it('prompt が返ること', async () => {
      const request = createMockArticleRequest()
      const result = await pipeline.processArticleImage(request)

      expect(result.prompt).toBeDefined()
    })
  })

  // ==============================================================
  // processBatch 並列処理
  // ==============================================================

  describe('processBatch 並列処理', () => {
    it('複数記事の画像を処理できること', async () => {
      const articles: ArticleImageRequest[] = [
        createMockArticleRequest({ slug: 'article-1' }),
        createMockArticleRequest({ slug: 'article-2' }),
        createMockArticleRequest({ slug: 'article-3' }),
      ]

      const results = await pipeline.processBatch(articles)

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.thumbnail).toBeDefined()
        expect(result.card).toBeDefined()
        expect(result.og).toBeDefined()
      })
    })

    it('concurrency オプションが Ideogram 呼び出し回数に影響しないこと (全件処理)', async () => {
      const articles: ArticleImageRequest[] = [
        createMockArticleRequest({ slug: 'a1' }),
        createMockArticleRequest({ slug: 'a2' }),
        createMockArticleRequest({ slug: 'a3' }),
        createMockArticleRequest({ slug: 'a4' }),
        createMockArticleRequest({ slug: 'a5' }),
      ]

      const results = await pipeline.processBatch(articles, { concurrency: 2 })

      expect(results).toHaveLength(5)
      expect(mockIdeogram.generateThumbnail).toHaveBeenCalledTimes(5)
    })

    it('空の配列を渡すと空の結果が返ること', async () => {
      const results = await pipeline.processBatch([])

      expect(results).toHaveLength(0)
    })

    it('各カテゴリの画像が正しく処理されること', async () => {
      const articles: ArticleImageRequest[] = [
        createMockArticleRequest({ category: 'aga', slug: 'aga-article' }),
        createMockArticleRequest({ category: 'skincare', slug: 'skincare-article' }),
        createMockArticleRequest({ category: 'ed', slug: 'ed-article' }),
      ]

      const results = await pipeline.processBatch(articles)

      expect(results).toHaveLength(3)
      // 各結果のpublicIdにカテゴリが含まれるか確認
      expect(results[0].publicId).toContain('aga')
      expect(results[1].publicId).toContain('skincare')
      expect(results[2].publicId).toContain('ed')
    })
  })

  // ==============================================================
  // 各カテゴリのプレースホルダー
  // ==============================================================

  describe('カテゴリ別プレースホルダー', () => {
    const categories = ['aga', 'hair-removal', 'skincare', 'ed', 'column'] as const

    for (const category of categories) {
      it(`${category} カテゴリのプレースホルダーが生成されること`, async () => {
        const request = createMockArticleRequest({ category, slug: `${category}-test` })
        const result = await pipeline.processArticleImage(request)

        expect(result.thumbnail.url).toContain(category.toUpperCase().replace('-', '-'))
        expect(result.thumbnail.width).toBe(IMAGE_SIZES.thumbnail.width)
        expect(result.thumbnail.height).toBe(IMAGE_SIZES.thumbnail.height)
      })
    }
  })
})
