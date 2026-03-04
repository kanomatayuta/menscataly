/**
 * Q5: 構造化データ API テスト
 * Phase 3 SEO強化 — /api/admin/structured-data
 *
 * - GET: 構造化データプレビュー生成
 * - POST: 構造化データ検証
 * - 認証チェック
 * - バリデーションチェック
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数をクリアしてモックモードに
vi.stubEnv('MICROCMS_SERVICE_DOMAIN', '')
vi.stubEnv('MICROCMS_API_KEY', '')

// 認証モック
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(() => ({ authorized: true })),
}))

import { validateAdminAuth } from '@/lib/admin/auth'

describe('構造化データ API', () => {
  let GET: typeof import('@/app/api/admin/structured-data/route').GET
  let POST: typeof import('@/app/api/admin/structured-data/route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true })

    const route = await import('@/app/api/admin/structured-data/route')
    GET = route.GET
    POST = route.POST
  })

  // ==============================================================
  // GET: 構造化データプレビュー
  // ==============================================================
  describe('GET /api/admin/structured-data', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(401)
    })

    it('articleId パラメータがない場合400を返すこと', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toContain('articleId')
    })

    it('存在しないarticleIdの場合404を返すこと', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=nonexistent'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(404)
    })

    it('レスポンスに preview が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.preview).toBeDefined()
      expect(body.preview.articleId).toBe('article-001')
      expect(body.preview.articleTitle).toBeDefined()
      expect(body.preview.jsonLd).toBeDefined()
      expect(Array.isArray(body.preview.appliedTypes)).toBe(true)
      expect(body.preview.category).toBeDefined()
    })

    it('JSON-LD に @context が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.preview.jsonLd['@context']).toBe('https://schema.org')
    })

    it('JSON-LD に @graph が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(Array.isArray(body.preview.jsonLd['@graph'])).toBe(true)
      expect(body.preview.jsonLd['@graph'].length).toBeGreaterThan(0)
    })

    it('AGAカテゴリの記事に MedicalWebPage スキーマが適用されること', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.preview.appliedTypes).toContain('MedicalWebPage')
    })

    it('validate=true で validation が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001&validate=true'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.validation).toBeDefined()
      expect(typeof body.validation.valid).toBe('boolean')
      expect(typeof body.validation.score).toBe('number')
      expect(Array.isArray(body.validation.errors)).toBe(true)
      expect(Array.isArray(body.validation.checkedTypes)).toBe(true)
      expect(Array.isArray(body.validation.recommendedTypes)).toBe(true)
    })

    it('validate=true でない場合 validation が含まれないこと', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.validation).toBeUndefined()
    })

    it('@graph に BreadcrumbList が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      const graph = body.preview.jsonLd['@graph'] as Array<{ '@type': string }>
      const hasBreadcrumb = graph.some((g) => g['@type'] === 'BreadcrumbList')
      expect(hasBreadcrumb).toBe(true)
    })

    it('監修者情報がある記事に reviewedBy が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/structured-data?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      const graph = body.preview.jsonLd['@graph'] as Array<Record<string, unknown>>
      const mainSchema = graph.find(
        (g) => g['@type'] === 'MedicalWebPage' || g['@type'] === 'Article'
      )
      expect(mainSchema).toBeDefined()
      if (mainSchema && mainSchema['reviewedBy']) {
        const reviewer = mainSchema['reviewedBy'] as Record<string, unknown>
        expect(reviewer['@type']).toBe('Person')
        expect(reviewer['name']).toBeDefined()
      }
    })
  })

  // ==============================================================
  // POST: 構造化データ検証
  // ==============================================================
  describe('POST /api/admin/structured-data', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(401)
    })

    it('不正なJSONボディで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('articleId も jsonLd もない場合400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toContain('articleId')
    })

    it('存在しないarticleIdの場合404を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'nonexistent' }),
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(404)
    })

    it('articleId で検証した結果に validation が含まれること', async () => {
      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(body.validation).toBeDefined()
      expect(typeof body.validation.valid).toBe('boolean')
      expect(typeof body.validation.score).toBe('number')
      expect(body.validation.score).toBeGreaterThanOrEqual(0)
      expect(body.validation.score).toBeLessThanOrEqual(100)
      expect(Array.isArray(body.validation.errors)).toBe(true)
      expect(Array.isArray(body.validation.checkedTypes)).toBe(true)
      expect(Array.isArray(body.validation.recommendedTypes)).toBe(true)
    })

    it('jsonLd を直接渡して検証できること', async () => {
      const validJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Article',
            headline: 'テスト記事',
            datePublished: '2026-01-15T09:00:00Z',
            dateModified: '2026-03-01T09:00:00Z',
            author: { '@type': 'Organization', name: 'テスト' },
            publisher: { '@type': 'Organization', name: 'テスト' },
            description: 'テストの記事です',
            mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://example.com/test' },
          },
        ],
      }

      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonLd: validJsonLd, category: 'column' }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.validation).toBeDefined()
      expect(body.category).toBe('column')
    })

    it('不正な jsonLd の場合にエラーが検出されること', async () => {
      const invalidJsonLd = {
        '@context': 'https://example.com', // 不正
        '@graph': [
          {
            '@type': 'Article',
            // headline, datePublished 等の必須フィールドが欠落
          },
        ],
      }

      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonLd: invalidJsonLd }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.validation.valid).toBe(false)
      expect(body.validation.errors.length).toBeGreaterThan(0)
      expect(body.validation.score).toBeLessThan(100)
    })

    it('@graph がない jsonLd の場合にスコアが0であること', async () => {
      const noGraphJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article', // @graph 形式ではない
      }

      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonLd: noGraphJsonLd }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.validation.valid).toBe(false)
      expect(body.validation.score).toBe(0)
    })

    it('medical カテゴリで reviewedBy がない場合にエラーが検出されること', async () => {
      const medicalJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'MedicalWebPage',
            headline: 'AGA治療ガイド',
            datePublished: '2026-01-15T09:00:00Z',
            dateModified: '2026-03-01T09:00:00Z',
            author: { '@type': 'Organization', name: 'テスト' },
            publisher: { '@type': 'Organization', name: 'テスト' },
            description: 'テスト記事',
            mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://example.com' },
            about: { '@type': 'MedicalCondition', name: 'AGA' },
            lastReviewed: '2026-03-01T09:00:00Z',
            // reviewedBy が欠落
          },
        ],
      }

      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonLd: medicalJsonLd, category: 'aga' }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      const reviewedByError = body.validation.errors.find(
        (e: Record<string, unknown>) => e.field === 'reviewedBy'
      )
      expect(reviewedByError).toBeDefined()
    })

    it('検証結果にカテゴリ推奨スキーマタイプが含まれること', async () => {
      const req = new Request('http://localhost/api/admin/structured-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      // AGAカテゴリの推奨タイプ
      expect(body.validation.recommendedTypes).toContain('MedicalWebPage')
      expect(body.validation.recommendedTypes).toContain('Article')
      expect(body.validation.recommendedTypes).toContain('BreadcrumbList')
    })
  })
})
