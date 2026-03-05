/**
 * レビューワークフロー API Unit Tests
 * GET/POST/PATCH /api/admin/articles/[id]/review
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数をクリアしてインメモリモードに
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

// 認証モック
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(async () => ({ authorized: true })),
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

import { validateAdminAuth } from '@/lib/admin/auth'

describe('レビューワークフロー API', () => {
  let GET: typeof import('@/app/api/admin/articles/[id]/review/route').GET
  let POST: typeof import('@/app/api/admin/articles/[id]/review/route').POST
  let PATCH: typeof import('@/app/api/admin/articles/[id]/review/route').PATCH

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ authorized: true })

    const reviewRoute = await import('@/app/api/admin/articles/[id]/review/route')
    GET = reviewRoute.GET
    POST = reviewRoute.POST
    PATCH = reviewRoute.PATCH
  })

  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

  // ==============================================================
  // GET: レビュー履歴取得
  // ==============================================================
  describe('GET /api/admin/articles/[id]/review', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/review') as any
      const response = await GET(req, makeParams('art-001'))
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request('http://localhost/api/admin/articles/art-001/review') as any
      const response = await GET(req, makeParams('art-001'))
      expect(response.status).toBe(401)
    })

    it('レビュー履歴の形式が正しいこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/review') as any
      const response = await GET(req, makeParams('art-001'))
      const data = await response.json()

      expect(data.articleId).toBe('art-001')
      expect(Array.isArray(data.reviews)).toBe(true)
      expect(typeof data.total).toBe('number')
    })

    it('初期状態ではレビュー履歴が空であること', async () => {
      const req = new Request('http://localhost/api/admin/articles/fresh-article/review') as any
      const response = await GET(req, makeParams('fresh-article'))
      const data = await response.json()

      expect(data.reviews).toHaveLength(0)
      expect(data.total).toBe(0)
    })
  })

  // ==============================================================
  // POST: レビュー送信 (approve/reject/revision)
  // ==============================================================
  describe('POST /api/admin/articles/[id]/review', () => {
    it('承認アクションが正常に処理されること', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          comment: '薬機法チェックOK。公開可能です。',
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.articleId).toBe('art-001')
      expect(data.newStatus).toBe('approved')
      expect(data.review).toBeDefined()
      expect(data.review.action).toBe('approve')
      expect(data.review.content).toBe('薬機法チェックOK。公開可能です。')
    })

    it('却下アクションが正常に処理されること', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-002/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          comment: 'コンプライアンススコアが基準以下です。',
        }),
      }) as any

      const response = await POST(req, makeParams('art-002'))
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.newStatus).toBe('rejected')
    })

    it('修正依頼アクションが正常に処理されること', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-003/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revision',
          comment: '薬機法のNG表現を修正してください。',
        }),
      }) as any

      const response = await POST(req, makeParams('art-003'))
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.newStatus).toBe('revision')
    })

    it('著者情報が保存されること', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          comment: 'LGTM',
          author: '田中医師',
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      const data = await response.json()

      expect(data.review.author).toBe('田中医師')
    })

    it('無効なアクションで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invalid-action',
          comment: 'test',
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(400)
    })

    it('空のコメントで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          comment: '',
        }),
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(400)
    })

    it('不正なJSON bodyで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/art-001/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      }) as any

      const response = await POST(req, makeParams('art-001'))
      expect(response.status).toBe(400)
    })

    it('レビュー送信後にGETで履歴が取得できること', async () => {
      // レビュー送信
      const postReq = new Request('http://localhost/api/admin/articles/art-history/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          comment: '承認しました',
        }),
      }) as any
      await POST(postReq, makeParams('art-history'))

      // 履歴取得
      const getReq = new Request('http://localhost/api/admin/articles/art-history/review') as any
      const response = await GET(getReq, makeParams('art-history'))
      const data = await response.json()

      expect(data.reviews.length).toBeGreaterThan(0)
      expect(data.reviews[0].action).toBe('approve')
      expect(data.reviews[0].content).toBe('承認しました')
    })
  })

  // ==============================================================
  // PATCH: レガシーレビュー (approve/reject)
  // ==============================================================
  describe('PATCH /api/admin/articles/[id]/review', () => {
    it('承認アクションが正常に処理されること', async () => {
      const req = new Request('http://localhost/api/admin/articles/review-001/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          notes: '問題なし',
        }),
      }) as any

      const response = await PATCH(req, makeParams('review-001'))
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.status).toBe('approved')
    })

    it('却下アクションが正常に処理されること', async () => {
      const req = new Request('http://localhost/api/admin/articles/review-002/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          notes: 'NG表現あり',
        }),
      }) as any

      const response = await PATCH(req, makeParams('review-002'))
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.status).toBe('rejected')
    })

    it('無効なアクションで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/review-001/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revision',
        }),
      }) as any

      const response = await PATCH(req, makeParams('review-001'))
      expect(response.status).toBe(400)
    })

    it('不正なJSON bodyで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/articles/review-001/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }) as any

      const response = await PATCH(req, makeParams('review-001'))
      expect(response.status).toBe(400)
    })
  })
})
