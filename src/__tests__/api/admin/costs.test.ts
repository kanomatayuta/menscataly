/**
 * コスト API Unit Tests
 * GET /api/admin/costs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数をクリア
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

// 認証モック
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(() => ({ authorized: true })),
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

// CostTracker モック — class構文で定義
vi.mock('@/lib/batch/cost-tracker', () => {
  return {
    CostTracker: class MockCostTracker {
      async getCostSummary() {
        return {
          totalCostUsd: 19.30,
          articleGenerationCost: 12.50,
          imageGenerationCost: 4.00,
          analysisCost: 2.80,
          totalArticles: 25,
          avgCostPerArticle: 0.77,
        }
      }
      async checkThreshold() {
        return {
          exceeded: false,
          currentCost: 19.30,
          threshold: 50.00,
        }
      }
    },
  }
})

import { validateAdminAuth } from '@/lib/admin/auth'

describe('コスト API', () => {
  let GET: typeof import('@/app/api/admin/costs/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true })

    const costsRoute = await import('@/app/api/admin/costs/route')
    GET = costsRoute.GET
  })

  // ==============================================================
  // GET: コストサマリー取得
  // ==============================================================
  describe('GET /api/admin/costs', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      expect(response.status).toBe(401)
    })

    it('レスポンスにsummaryが含まれること', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.summary).toBeDefined()
      expect(typeof data.summary.totalCostUsd).toBe('number')
    })

    it('レスポンスにbudgetAlertが含まれること', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.budgetAlert).toBeDefined()
      expect(typeof data.budgetAlert.exceeded).toBe('boolean')
      expect(typeof data.budgetAlert.currentCost).toBe('number')
      expect(typeof data.budgetAlert.budgetLimit).toBe('number')
      expect(typeof data.budgetAlert.remainingBudget).toBe('number')
      expect(typeof data.budgetAlert.usagePercent).toBe('number')
      expect(['safe', 'warning', 'critical']).toContain(data.budgetAlert.alertLevel)
    })

    it('budgetAlert.alertLevel が使用率に応じて変わること', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      const data = await response.json()

      // usagePercent = 19.30/50.00 * 100 = 38.6% -> "safe"
      expect(data.budgetAlert.alertLevel).toBe('safe')
    })

    it('レスポンスにbreakdownが含まれること', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.breakdown).toBeDefined()
      expect(Array.isArray(data.breakdown)).toBe(true)

      for (const item of data.breakdown) {
        expect(item.model).toBeDefined()
        expect(typeof item.totalCostUsd).toBe('number')
        expect(typeof item.requestCount).toBe('number')
      }
    })

    it('breakdown=false でbreakdownが空になること', async () => {
      const req = new Request('http://localhost/api/admin/costs?breakdown=false') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.breakdown).toHaveLength(0)
    })

    it('レスポンスにaggregatedが含まれること', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.aggregated).toBeDefined()
      expect(Array.isArray(data.aggregated)).toBe(true)

      if (data.aggregated.length > 0) {
        const entry = data.aggregated[0]
        expect(entry.periodStart).toBeDefined()
        expect(entry.periodEnd).toBeDefined()
        expect(typeof entry.totalCostUsd).toBe('number')
      }
    })

    it('aggregation=weeklyで週次集計されること', async () => {
      const start = new Date('2026-01-01')
      const end = new Date('2026-01-31')
      const req = new Request(
        `http://localhost/api/admin/costs?aggregation=weekly&startDate=${start.toISOString()}&endDate=${end.toISOString()}`
      ) as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.period.aggregation).toBe('weekly')
      expect(data.aggregated.length).toBeLessThanOrEqual(5) // 4-5 weeks in January
    })

    it('aggregation=monthlyで月次集計されること', async () => {
      const start = new Date('2026-01-01')
      const end = new Date('2026-03-31')
      const req = new Request(
        `http://localhost/api/admin/costs?aggregation=monthly&startDate=${start.toISOString()}&endDate=${end.toISOString()}`
      ) as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.period.aggregation).toBe('monthly')
      expect(data.aggregated.length).toBeLessThanOrEqual(3)
    })

    it('後方互換のthresholdフィールドが含まれること', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.threshold).toBeDefined()
      expect(typeof data.threshold.exceeded).toBe('boolean')
      expect(typeof data.threshold.currentCost).toBe('number')
      expect(typeof data.threshold.limit).toBe('number')
    })

    it('periodフィールドが含まれること', async () => {
      const req = new Request('http://localhost/api/admin/costs') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.period).toBeDefined()
      expect(data.period.startDate).toBeDefined()
      expect(data.period.endDate).toBeDefined()
      expect(data.period.aggregation).toBeDefined()
    })
  })
})
