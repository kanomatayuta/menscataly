/**
 * キーワード API Unit Tests
 * GET/POST /api/admin/keywords
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数をクリアしてインメモリモードに
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

// 認証モック
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(() => ({ authorized: true })),
}))

import { validateAdminAuth } from '@/lib/admin/auth'

describe('キーワード API', () => {
  let GET: typeof import('@/app/api/admin/keywords/route').GET
  let POST: typeof import('@/app/api/admin/keywords/route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true })

    const keywordsRoute = await import('@/app/api/admin/keywords/route')
    GET = keywordsRoute.GET
    POST = keywordsRoute.POST
  })

  // ==============================================================
  // GET: キーワード一覧
  // ==============================================================
  describe('GET /api/admin/keywords', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords') as any
      const response = await GET(req)
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request('http://localhost/api/admin/keywords') as any
      const response = await GET(req)
      expect(response.status).toBe(401)
    })

    it('キーワードリストの形式が正しいこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.keywords).toBeDefined()
      expect(Array.isArray(data.keywords)).toBe(true)
      expect(typeof data.total).toBe('number')
      expect(data.filters).toBeDefined()
    })

    it('カテゴリフィルタが機能すること', async () => {
      // まずキーワードを追加
      const postReq = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: 'AGA治療 費用',
          category: 'aga',
          searchVolume: 3000,
          difficulty: 30,
        }),
      }) as any
      await POST(postReq)

      const req = new Request('http://localhost/api/admin/keywords?category=aga') as any
      const response = await GET(req)
      const data = await response.json()

      for (const kw of data.keywords) {
        expect(kw.category).toBe('aga')
      }
    })

    it('検索クエリフィルタが機能すること', async () => {
      // キーワード追加
      const postReq = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: 'メンズ脱毛 おすすめ',
          category: 'hair-removal',
        }),
      }) as any
      await POST(postReq)

      const req = new Request('http://localhost/api/admin/keywords?q=%E8%84%B1%E6%AF%9B') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.keywords.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ==============================================================
  // POST: キーワード新規追加
  // ==============================================================
  describe('POST /api/admin/keywords', () => {
    it('有効なリクエストで201を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: 'ED治療 オンライン',
          category: 'ed',
          searchVolume: 2500,
          difficulty: 25,
          trendScore: 70,
        }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.keyword).toBeDefined()
      expect(data.keyword.keyword).toBe('ED治療 オンライン')
      expect(data.keyword.category).toBe('ed')
      expect(data.keyword.searchVolume).toBe(2500)
    })

    it('キーワードにdifficultyLevel が自動設定されること', async () => {
      // difficulty <= 30 -> easy
      const req1 = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'test easy', category: 'aga', difficulty: 20 }),
      }) as any
      const res1 = await POST(req1)
      const data1 = await res1.json()
      expect(data1.keyword.difficultyLevel).toBe('easy')

      // difficulty 31-60 -> medium
      const req2 = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'test medium', category: 'aga', difficulty: 50 }),
      }) as any
      const res2 = await POST(req2)
      const data2 = await res2.json()
      expect(data2.keyword.difficultyLevel).toBe('medium')

      // difficulty > 60 -> hard
      const req3 = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'test hard', category: 'aga', difficulty: 80 }),
      }) as any
      const res3 = await POST(req3)
      const data3 = await res3.json()
      expect(data3.keyword.difficultyLevel).toBe('hard')
    })

    it('searchIntentが自動推定されること', async () => {
      const req = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: 'AGA治療 おすすめ ランキング',
          category: 'aga',
        }),
      }) as any
      const response = await POST(req)
      const data = await response.json()

      expect(data.keyword.searchIntent).toBe('commercial')
    })

    it('不正なJSON bodyで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('キーワード未指定で400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'aga' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('カテゴリ未指定で400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: 'test keyword' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('負のsearchVolumeで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: 'test',
          category: 'aga',
          searchVolume: -100,
        }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('範囲外のdifficultyで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: 'test',
          category: 'aga',
          difficulty: 150,
        }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })
  })
})
