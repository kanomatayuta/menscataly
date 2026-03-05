/**
 * Q5: 内部リンク API テスト
 * Phase 3 SEO強化 — /api/admin/internal-links
 *
 * - GET: 内部リンク提案を取得
 * - POST: 記事に内部リンクを自動挿入
 * - 認証チェック
 * - バリデーションチェック
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数をクリアしてモックモードに
vi.stubEnv('MICROCMS_SERVICE_DOMAIN', '')
vi.stubEnv('MICROCMS_API_KEY', '')

// 認証モック
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(async () => ({ authorized: true })),
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

import { validateAdminAuth } from '@/lib/admin/auth'

describe('内部リンク API', () => {
  let GET: typeof import('@/app/api/admin/internal-links/route').GET
  let POST: typeof import('@/app/api/admin/internal-links/route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ authorized: true })

    const route = await import('@/app/api/admin/internal-links/route')
    GET = route.GET
    POST = route.POST
  })

  // ==============================================================
  // GET: 内部リンク提案
  // ==============================================================
  describe('GET /api/admin/internal-links', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request(
        'http://localhost/api/admin/internal-links?articleId=article-001'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request(
        'http://localhost/api/admin/internal-links?articleId=article-001'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(401)
    })

    it('articleId パラメータがない場合400を返すこと', async () => {
      const req = new Request(
        'http://localhost/api/admin/internal-links'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toContain('articleId')
    })

    it('存在しないarticleIdの場合404を返すこと', async () => {
      const req = new Request(
        'http://localhost/api/admin/internal-links?articleId=nonexistent'
      ) as any
      const response = await GET(req)
      expect(response.status).toBe(404)
    })

    it('レスポンスに internalLinks が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/internal-links?articleId=article-001'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.articleId).toBe('article-001')
      expect(body.articleTitle).toBeDefined()
      expect(Array.isArray(body.internalLinks)).toBe(true)
      expect(Array.isArray(body.relatedArticles)).toBe(true)
    })

    it('maxLinks パラメータでリンク数を制限できること', async () => {
      const req = new Request(
        'http://localhost/api/admin/internal-links?articleId=article-001&maxLinks=2'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.internalLinks.length).toBeLessThanOrEqual(2)
    })

    it('maxRelated パラメータで関連記事数を制限できること', async () => {
      const req = new Request(
        'http://localhost/api/admin/internal-links?articleId=article-001&maxRelated=1'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.relatedArticles.length).toBeLessThanOrEqual(1)
    })

    it('includeAnalysis=true でリンク密度分析が含まれること', async () => {
      const req = new Request(
        'http://localhost/api/admin/internal-links?articleId=article-001&includeAnalysis=true'
      ) as any
      const response = await GET(req)
      const body = await response.json()

      expect(body.linkAnalysis).toBeDefined()
    })
  })

  // ==============================================================
  // POST: 内部リンク自動挿入
  // ==============================================================
  describe('POST /api/admin/internal-links', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(401)
    })

    it('不正なJSONボディで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('articleId がない場合400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/internal-links', {
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
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'nonexistent' }),
      }) as any
      const response = await POST(req)
      expect(response.status).toBe(404)
    })

    it('レスポンスに insertedLinks と optimizedAnchors が含まれること', async () => {
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(body.articleId).toBe('article-001')
      expect(Array.isArray(body.insertedLinks)).toBe(true)
      expect(Array.isArray(body.optimizedAnchors)).toBe(true)
      expect(body.linkAnalysis).toBeDefined()
    })

    it('デフォルトで dryRun=true であること', async () => {
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001' }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(body.dryRun).toBe(true)
    })

    it('dryRun=true の場合 modifiedContent が含まれること', async () => {
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001', dryRun: true }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(body.modifiedContent).toBeDefined()
    })

    it('dryRun=false の場合 modifiedContent が含まれないこと', async () => {
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: 'article-001', dryRun: false }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(body.modifiedContent).toBeUndefined()
      expect(body.dryRun).toBe(false)
    })

    it('articleContent を渡した場合にそのコンテンツが使用されること', async () => {
      const customContent = '<p>カスタム記事コンテンツです。</p>'
      const req = new Request('http://localhost/api/admin/internal-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: 'article-001',
          articleContent: customContent,
          dryRun: true,
        }),
      }) as any
      const response = await POST(req)
      const body = await response.json()

      expect(response.status).toBe(200)
      // modifiedContent はカスタムコンテンツに基づいて生成されるはず
      if (body.modifiedContent) {
        expect(body.modifiedContent).toContain('カスタム記事コンテンツ')
      }
    })
  })
})
