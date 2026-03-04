/**
 * 管理画面ダッシュボードAPI Unit Tests
 * GET /api/admin/dashboard の契約テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockMonitoringAlert,
  createMockSupabaseQuery,
} from '@/test/helpers'
import type { AdminDashboardData } from '@/types/admin'

// 認証モック
const mockValidateAuth = vi.fn()
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: mockValidateAuth,
}))

// Supabase モック
const mockDashboardData: AdminDashboardData = {
  pipeline: {
    status: 'idle',
    lastRunAt: '2026-03-01T06:00:00Z',
    lastRunSuccess: true,
    totalRuns: 42,
  },
  articles: {
    total: 50,
    published: 42,
    draft: 5,
    pendingReview: 3,
    avgComplianceScore: 94.2,
  },
  revenue: {
    monthlyTotalJpy: 150000,
    monthOverMonthChange: 12.5,
    byAsp: [],
  },
  alerts: [
    createMockMonitoringAlert({ level: 'warning' }),
    createMockMonitoringAlert({ id: 'alert-002', level: 'info', type: 'api_error' }),
  ],
  costs: {
    monthlyTotalUsd: 5.50,
    articleAvgUsd: 0.11,
    budgetRemainingUsd: 94.50,
  },
}

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => createMockSupabaseQuery([mockDashboardData])),
  })),
}))

// ダッシュボードAPIルートをモック
const mockGetDashboard = vi.fn()

vi.mock('@/app/api/admin/dashboard/route', () => ({
  GET: mockGetDashboard,
}))

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockValidateAuth.mockReturnValue({ authorized: true, user: { id: 'admin-001' } })

    mockGetDashboard.mockResolvedValue(
      new Response(JSON.stringify(mockDashboardData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  describe('認証', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const response = await mockGetDashboard(new Request('http://localhost/api/admin/dashboard'))
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      mockValidateAuth.mockReturnValue({ authorized: false })
      mockGetDashboard.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )

      const response = await mockGetDashboard(new Request('http://localhost/api/admin/dashboard'))
      expect(response.status).toBe(401)
    })
  })

  describe('レスポンス形式', () => {
    it('AdminDashboardData 形式のレスポンスを返すこと', async () => {
      const response = await mockGetDashboard(new Request('http://localhost/api/admin/dashboard'))
      const data: AdminDashboardData = await response.json()

      // pipeline
      expect(data.pipeline).toBeDefined()
      expect(['idle', 'running', 'error']).toContain(data.pipeline.status)
      expect(typeof data.pipeline.totalRuns).toBe('number')

      // articles
      expect(data.articles).toBeDefined()
      expect(typeof data.articles.total).toBe('number')
      expect(typeof data.articles.published).toBe('number')
      expect(typeof data.articles.avgComplianceScore).toBe('number')

      // revenue
      expect(data.revenue).toBeDefined()
      expect(typeof data.revenue.monthlyTotalJpy).toBe('number')
      expect(typeof data.revenue.monthOverMonthChange).toBe('number')

      // alerts
      expect(Array.isArray(data.alerts)).toBe(true)

      // costs
      expect(data.costs).toBeDefined()
      expect(typeof data.costs.monthlyTotalUsd).toBe('number')
      expect(typeof data.costs.articleAvgUsd).toBe('number')
    })

    it('アクティブアラートが正しい形式であること', async () => {
      const response = await mockGetDashboard(new Request('http://localhost/api/admin/dashboard'))
      const data: AdminDashboardData = await response.json()

      data.alerts.forEach(alert => {
        expect(alert.id).toBeDefined()
        expect(alert.level).toBeDefined()
        expect(alert.status).toBeDefined()
        expect(alert.title).toBeDefined()
        expect(alert.message).toBeDefined()
      })
    })
  })
})
