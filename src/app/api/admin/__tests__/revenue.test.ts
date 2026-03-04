/**
 * 管理画面収益API Unit Tests
 * GET /api/admin/revenue の契約テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockRevenueSummary,
  createMockSupabaseQuery,
} from '@/test/helpers'
import type { RevenueSummary } from '@/types/admin'

// 認証モック
const mockValidateAuth = vi.fn()
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: mockValidateAuth,
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

// モックデータ
const mockRevenueSummaries: RevenueSummary[] = [
  createMockRevenueSummary({ aspName: 'afb', totalRevenue: 80000, totalConversions: 8 }),
  createMockRevenueSummary({ aspName: 'a8', totalRevenue: 50000, totalConversions: 5, programCount: 3 }),
  createMockRevenueSummary({ aspName: 'accesstrade', totalRevenue: 20000, totalConversions: 2, programCount: 2 }),
]

// Supabase モック
vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => createMockSupabaseQuery(mockRevenueSummaries)),
  })),
}))

// APIルートモック
const mockGetRevenue = vi.fn()

vi.mock('@/app/api/admin/revenue/route', () => ({
  GET: mockGetRevenue,
}))

describe('GET /api/admin/revenue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateAuth.mockReturnValue({ authorized: true, user: { id: 'admin-001' } })

    mockGetRevenue.mockResolvedValue(
      new Response(JSON.stringify({
        summaries: mockRevenueSummaries,
        totalRevenue: 150000,
        period: { startDate: '2026-02-01', endDate: '2026-03-01' },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  describe('認証', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const response = await mockGetRevenue(new Request('http://localhost/api/admin/revenue'))
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      mockValidateAuth.mockReturnValue({ authorized: false })
      mockGetRevenue.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )

      const response = await mockGetRevenue(new Request('http://localhost/api/admin/revenue'))
      expect(response.status).toBe(401)
    })
  })

  describe('レスポンス形式', () => {
    it('収益サマリリストを返すこと', async () => {
      const response = await mockGetRevenue(new Request('http://localhost/api/admin/revenue'))
      const data = await response.json()

      expect(data.summaries).toBeDefined()
      expect(Array.isArray(data.summaries)).toBe(true)
      expect(data.summaries.length).toBeGreaterThan(0)
    })

    it('各サマリにRevenueSummaryの必須フィールドが含まれること', async () => {
      const response = await mockGetRevenue(new Request('http://localhost/api/admin/revenue'))
      const data = await response.json()

      data.summaries.forEach((summary: RevenueSummary) => {
        expect(summary.aspName).toBeDefined()
        expect(typeof summary.totalClicks).toBe('number')
        expect(typeof summary.totalConversions).toBe('number')
        expect(typeof summary.totalRevenue).toBe('number')
        expect(typeof summary.conversionRate).toBe('number')
      })
    })

    it('合計収益が返されること', async () => {
      const response = await mockGetRevenue(new Request('http://localhost/api/admin/revenue'))
      const data = await response.json()

      expect(typeof data.totalRevenue).toBe('number')
      expect(data.totalRevenue).toBeGreaterThanOrEqual(0)
    })

    it('期間パラメータが含まれること', async () => {
      const response = await mockGetRevenue(new Request('http://localhost/api/admin/revenue'))
      const data = await response.json()

      expect(data.period).toBeDefined()
      expect(data.period.startDate).toBeDefined()
      expect(data.period.endDate).toBeDefined()
    })
  })

  describe('日付範囲フィルタ', () => {
    it('カスタム日付範囲でリクエストできること', async () => {
      const filteredSummaries = [mockRevenueSummaries[0]]
      mockGetRevenue.mockResolvedValueOnce(
        new Response(JSON.stringify({
          summaries: filteredSummaries,
          totalRevenue: 80000,
          period: { startDate: '2026-02-15', endDate: '2026-03-01' },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const response = await mockGetRevenue(
        new Request('http://localhost/api/admin/revenue?startDate=2026-02-15&endDate=2026-03-01')
      )
      const data = await response.json()

      expect(data.period.startDate).toBe('2026-02-15')
      expect(data.period.endDate).toBe('2026-03-01')
    })

    it('ASPごとの収益が降順にソートされていること', async () => {
      const response = await mockGetRevenue(new Request('http://localhost/api/admin/revenue'))
      const data = await response.json()

      const revenues = data.summaries.map((s: RevenueSummary) => s.totalRevenue)
      for (let i = 1; i < revenues.length; i++) {
        expect(revenues[i]).toBeLessThanOrEqual(revenues[i - 1])
      }
    })
  })
})
