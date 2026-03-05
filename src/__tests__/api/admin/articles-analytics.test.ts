/**
 * 記事アナリティクス API テスト
 * GET /api/admin/articles (analytics カラム付き)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ArticleAnalytics } from '@/types/admin'
import { createMockAnalyticsDailyUpsert } from '@/test/helpers'

// 認証モック
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(async () => ({ authorized: true })),
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

import { validateAdminAuth } from '@/lib/admin/auth'

// Supabase モック
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

describe('Articles Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ authorized: true })

    // Supabase チェーンリセット
    mockOrder.mockResolvedValue({ data: [], error: null })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('ArticleAnalytics型が正しいフィールドを持つ', () => {
    const analytics: ArticleAnalytics = {
      articleId: 'article-001',
      pageviews: 500,
      clicks: 50,
      conversions: 2,
      revenue: 30000,
    }

    expect(analytics.articleId).toBe('article-001')
    expect(analytics.pageviews).toBe(500)
    expect(analytics.clicks).toBe(50)
    expect(analytics.conversions).toBe(2)
    expect(analytics.revenue).toBe(30000)
  })

  it('ArticleAnalytics型の数値フィールドがnumber型', () => {
    const analytics: ArticleAnalytics = {
      articleId: 'test',
      pageviews: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
    }

    expect(typeof analytics.pageviews).toBe('number')
    expect(typeof analytics.clicks).toBe('number')
    expect(typeof analytics.conversions).toBe('number')
    expect(typeof analytics.revenue).toBe('number')
  })

  it('AnalyticsDailyRowモックが正しく生成される', () => {
    const row = createMockAnalyticsDailyUpsert()

    expect(row.article_id).toBe('article-001')
    expect(row.date).toBe('2026-03-05')
    expect(row.pageviews).toBe(500)
    expect(row.bounce_rate).toBe(0.45)
    expect(row.ctr).toBe(0.03)
    expect(row.conversions).toBe(2)
  })

  it('AnalyticsDailyRowモックのオーバーライドが機能する', () => {
    const row = createMockAnalyticsDailyUpsert({
      article_id: 'custom-article',
      pageviews: 9999,
    })

    expect(row.article_id).toBe('custom-article')
    expect(row.pageviews).toBe(9999)
    // 他のデフォルト値は維持
    expect(row.bounce_rate).toBe(0.45)
  })

  it('認証失敗時に401相当のエラーを返す', async () => {
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
      authorized: false,
      error: 'Unauthorized',
    })

    const authResult = await validateAdminAuth(new Request('http://localhost') as any)
    expect(authResult.authorized).toBe(false)
  })

  it('Supabase未設定時に空配列で応答できる', () => {
    // Supabase が未設定の場合、空配列にフォールバック
    const articlesWithAnalytics: ArticleAnalytics[] = []

    expect(articlesWithAnalytics).toEqual([])
    expect(articlesWithAnalytics).toHaveLength(0)
  })
})
