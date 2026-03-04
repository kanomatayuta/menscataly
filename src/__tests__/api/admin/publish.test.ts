/**
 * 記事公開 API Unit Tests
 * POST /api/admin/articles/[id]/publish
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数をクリアしてドライランモードに
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

// 認証モック
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(() => ({ authorized: true })),
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

import { validateAdminAuth } from '@/lib/admin/auth'

describe('記事公開 API', () => {
  let POST: typeof import('@/app/api/admin/articles/[id]/publish/route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true })

    const publishRoute = await import('@/app/api/admin/articles/[id]/publish/route')
    POST = publishRoute.POST
  })

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  // ==============================================================
  // POST: 記事公開
  // ==============================================================
  describe('POST /api/admin/articles/[id]/publish', () => {
    it('認証済みリクエストが200を返すこと（ドライラン）', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(401)
    })

    it('即時公開モード（デフォルト）が正しく処理されること', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.articleId).toBe('art-001')
      expect(data.publishMode).toBe('immediate')
      expect(data.microCmsStatus).toBe('published')
      expect(data.publishedAt).toBeDefined()
      expect(data.isDryRun).toBe(true)
    })

    it('予約公開モードが正しく処理されること', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()

      const req = new Request('http://localhost/api/admin/articles/art-002/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishMode: 'scheduled',
          scheduledAt: futureDate,
        }),
      }) as any

      const response = await POST(req, makeParams('art-002'))
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.publishMode).toBe('scheduled')
      expect(data.scheduledAt).toBe(futureDate)
      expect(data.publishedAt).toBeNull()
    })

    it('予約公開モードでscheduledAt未指定の場合400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishMode: 'scheduled',
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('scheduledAt')
    })

    it('過去日時のscheduledAtで400を返すこと', async () => {
      const pastDate = new Date('2020-01-01').toISOString()

      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishMode: 'scheduled',
          scheduledAt: pastDate,
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('future')
    })

    it('無効な日時のscheduledAtで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publishMode: 'scheduled',
          scheduledAt: 'not-a-date',
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(400)
    })

    it('microCmsStatusをdraftに指定できること', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          microCmsStatus: 'draft',
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      const data = await response.json()

      expect(data.microCmsStatus).toBe('draft')
    })

    it('JSON bodyなしでもデフォルト値で処理されること', async () => {
      // body無しのリクエスト
      const req = new Request('http://localhost/api/admin/articles/art-001/publish', {
        method: 'POST',
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.publishMode).toBe('immediate')
      expect(data.microCmsStatus).toBe('published')
    })
  })
})
