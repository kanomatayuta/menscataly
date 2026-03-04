/**
 * 記事一覧 API Unit Tests
 * GET /api/articles
 *
 * Supabase をモックしてカテゴリフィルタ・ページネーションを検証する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase モック ──────────────────────────────────────
// チェーン可能なクエリビルダーを組み立て、最後に実行結果を返す
const MOCK_ARTICLES = [
  {
    id: 'art-001',
    slug: 'aga-treatment-guide',
    title: 'AGA治療ガイド',
    excerpt: 'AGA治療の基本を解説',
    category: 'aga',
    category_id: null,
    status: 'published',
    seo_title: 'AGA治療ガイド',
    seo_description: 'AGA治療の概要',
    author_name: 'テスト著者',
    quality_score: 85,
    pv_count: 100,
    published_at: '2026-01-01T00:00:00Z',
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'art-002',
    slug: 'mens-skincare-basics',
    title: 'メンズスキンケア入門',
    excerpt: 'スキンケアの基本',
    category: 'skincare',
    category_id: null,
    status: 'published',
    seo_title: 'スキンケア入門',
    seo_description: 'メンズスキンケアの概要',
    author_name: 'テスト著者',
    quality_score: 90,
    pv_count: 200,
    published_at: '2026-01-15T00:00:00Z',
    created_at: '2025-12-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'art-003',
    slug: 'ed-treatment-overview',
    title: 'ED治療の概要',
    excerpt: 'ED治療の選択肢',
    category: 'ed',
    category_id: null,
    status: 'published',
    seo_title: 'ED治療の概要',
    seo_description: 'ED治療について',
    author_name: 'テスト著者',
    quality_score: 80,
    pv_count: 150,
    published_at: '2026-02-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
]

/**
 * Supabase のチェーン可能クエリビルダーをモックする。
 * Supabase JS v2 のクエリビルダーは PostgrestFilterBuilder を返し、
 * これは PromiseLike であると同時に .eq() 等のフィルタメソッドも持つ。
 * ここではその挙動を再現する。
 */
function createMockQueryBuilder() {
  let filterCategory: string | undefined
  let rangeStart = 0
  let rangeEnd = 9

  function getResult() {
    let filtered = [...MOCK_ARTICLES]
    if (filterCategory) {
      filtered = filtered.filter((a) => a.category === filterCategory)
    }
    const total = filtered.length
    const sliced = filtered.slice(rangeStart, rangeEnd + 1)
    return { data: sliced, error: null, count: total }
  }

  // PromiseLike + chainable object
  const builder: Record<string, unknown> = {
    select: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation((_col: string, value: string) => {
      if (_col === 'category') filterCategory = value
      return builder
    }),
    order: vi.fn().mockImplementation(() => builder),
    range: vi.fn().mockImplementation((start: number, end: number) => {
      rangeStart = start
      rangeEnd = end
      return builder
    }),
    // PromiseLike を実装して await 可能にする
    then: vi.fn().mockImplementation(
      (resolve?: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
        try {
          const result = getResult()
          return Promise.resolve(result).then(resolve, reject)
        } catch (err) {
          if (reject) return Promise.reject(err).catch(reject)
          throw err
        }
      }
    ),
  }

  return builder
}

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => createMockQueryBuilder()),
  })),
}))

/**
 * NextRequest を模倣するヘルパー
 * 通常の Request に nextUrl プロパティを追加する
 */
function createNextRequest(url: string) {
  const parsedUrl = new URL(url)
  const req = new Request(url) as Request & { nextUrl: URL }
  req.nextUrl = parsedUrl
  return req as any
}

describe('記事一覧 API (GET /api/articles)', () => {
  let GET: typeof import('@/app/api/articles/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    const articlesRoute = await import('@/app/api/articles/route')
    GET = articlesRoute.GET
  })

  // ==============================================================
  // GETで記事一覧取得
  // ==============================================================
  describe('記事一覧取得', () => {
    it('GETリクエストで200を返すこと', async () => {
      const req = createNextRequest('http://localhost/api/articles')
      const response = await GET(req)
      expect(response.status).toBe(200)
    })

    it('レスポンスに articles, total, limit, offset が含まれること', async () => {
      const req = createNextRequest('http://localhost/api/articles')
      const response = await GET(req)
      const data = await response.json()

      expect(data).toHaveProperty('articles')
      expect(data).toHaveProperty('total')
      expect(data).toHaveProperty('limit')
      expect(data).toHaveProperty('offset')
    })

    it('デフォルトで記事一覧を返すこと', async () => {
      const req = createNextRequest('http://localhost/api/articles')
      const response = await GET(req)
      const data = await response.json()

      expect(Array.isArray(data.articles)).toBe(true)
      expect(data.articles.length).toBeGreaterThan(0)
    })

    it('各記事に必須フィールドが含まれること', async () => {
      const req = createNextRequest('http://localhost/api/articles')
      const response = await GET(req)
      const data = await response.json()

      for (const article of data.articles) {
        expect(article.id).toBeDefined()
        expect(article.slug).toBeDefined()
        expect(article.title).toBeDefined()
        expect(article.category).toBeDefined()
      }
    })
  })

  // ==============================================================
  // カテゴリフィルタ
  // ==============================================================
  describe('カテゴリフィルタ', () => {
    it('category=aga でAGA記事のみ返すこと', async () => {
      const req = createNextRequest('http://localhost/api/articles?category=aga')
      const response = await GET(req)
      const data = await response.json()

      expect(data.articles.length).toBeGreaterThan(0)
      for (const article of data.articles) {
        expect(article.category).toBe('aga')
      }
    })

    it('category=skincare でスキンケア記事のみ返すこと', async () => {
      const req = createNextRequest('http://localhost/api/articles?category=skincare')
      const response = await GET(req)
      const data = await response.json()

      expect(data.articles.length).toBeGreaterThan(0)
      for (const article of data.articles) {
        expect(article.category).toBe('skincare')
      }
    })

    it('存在しないカテゴリで空配列を返すこと', async () => {
      const req = createNextRequest('http://localhost/api/articles?category=nonexistent')
      const response = await GET(req)
      const data = await response.json()

      expect(data.articles).toHaveLength(0)
      expect(data.total).toBe(0)
    })
  })

  // ==============================================================
  // ページネーション
  // ==============================================================
  describe('ページネーション', () => {
    it('limit パラメータでページサイズを制御できること', async () => {
      const req = createNextRequest('http://localhost/api/articles?limit=1')
      const response = await GET(req)
      const data = await response.json()

      expect(data.limit).toBe(1)
      expect(data.articles.length).toBeLessThanOrEqual(1)
    })

    it('offset パラメータでスキップできること', async () => {
      const req = createNextRequest('http://localhost/api/articles?offset=1')
      const response = await GET(req)
      const data = await response.json()

      expect(data.offset).toBe(1)
    })

    it('limit の最大値が100であること', async () => {
      const req = createNextRequest('http://localhost/api/articles?limit=999')
      const response = await GET(req)
      const data = await response.json()

      expect(data.limit).toBe(100)
    })

    it('不正な limit 値にデフォルト値 10 が使われること', async () => {
      const req = createNextRequest('http://localhost/api/articles?limit=abc')
      const response = await GET(req)
      const data = await response.json()

      expect(data.limit).toBe(10)
    })

    it('不正な offset 値にデフォルト値 0 が使われること', async () => {
      const req = createNextRequest('http://localhost/api/articles?offset=-5')
      const response = await GET(req)
      const data = await response.json()

      expect(data.offset).toBe(0)
    })
  })
})
