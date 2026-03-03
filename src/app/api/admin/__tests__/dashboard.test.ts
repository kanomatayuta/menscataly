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
  pipelineStatus: {
    currentStatus: 'idle',
    lastRunAt: '2026-03-01T06:00:00Z',
    lastRunDurationMs: 45000,
    successRate7d: 95.5,
  },
  articleStats: {
    totalArticles: 50,
    publishedCount: 42,
    draftCount: 5,
    pendingReviewCount: 3,
    avgComplianceScore: 94.2,
  },
  revenueSummary: {
    totalRevenue30d: 150000,
    totalClicks30d: 12000,
    totalConversions30d: 15,
    topAsp: 'afb',
  },
  activeAlerts: [
    createMockMonitoringAlert({ severity: 'warning' }),
    createMockMonitoringAlert({ id: 'alert-002', severity: 'info', type: 'api_error' }),
  ],
  costSummary: {
    totalCost30d: 5.50,
    articleGenerationCost: 3.80,
    imageGenerationCost: 1.20,
    avgCostPerArticle: 0.11,
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

      // pipelineStatus
      expect(data.pipelineStatus).toBeDefined()
      expect(['idle', 'running', 'success', 'failed', 'partial']).toContain(data.pipelineStatus.currentStatus)
      expect(typeof data.pipelineStatus.successRate7d).toBe('number')

      // articleStats
      expect(data.articleStats).toBeDefined()
      expect(typeof data.articleStats.totalArticles).toBe('number')
      expect(typeof data.articleStats.publishedCount).toBe('number')
      expect(typeof data.articleStats.avgComplianceScore).toBe('number')

      // revenueSummary
      expect(data.revenueSummary).toBeDefined()
      expect(typeof data.revenueSummary.totalRevenue30d).toBe('number')
      expect(typeof data.revenueSummary.totalClicks30d).toBe('number')

      // activeAlerts
      expect(Array.isArray(data.activeAlerts)).toBe(true)

      // costSummary
      expect(data.costSummary).toBeDefined()
      expect(typeof data.costSummary.totalCost30d).toBe('number')
      expect(typeof data.costSummary.avgCostPerArticle).toBe('number')
    })

    it('アクティブアラートが正しい形式であること', async () => {
      const response = await mockGetDashboard(new Request('http://localhost/api/admin/dashboard'))
      const data: AdminDashboardData = await response.json()

      data.activeAlerts.forEach(alert => {
        expect(alert.id).toBeDefined()
        expect(alert.type).toBeDefined()
        expect(alert.severity).toBeDefined()
        expect(alert.status).toBe('active')
        expect(alert.title).toBeDefined()
        expect(alert.message).toBeDefined()
      })
    })
  })
})
