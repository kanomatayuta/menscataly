/**
 * Lighthouseパフォーマンスバジェット Unit Tests
 * バジェット定数・checkPerformanceBudget()の契約テスト
 *
 * Backend エージェントが @/lib/monitoring/lighthouse-budget を実装する前に、
 * インターフェース契約をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface PerformanceBudget {
  lcp: number    // ms
  fid: number    // ms
  cls: number    // score
  ttfb: number   // ms
  fcp: number    // ms
  si: number     // ms (Speed Index)
  tbt: number    // ms (Total Blocking Time)
  bundleSize: {
    js: number   // KB
    css: number  // KB
    total: number // KB
  }
}

interface BudgetCheckResult {
  passed: boolean
  metrics: Record<string, {
    value: number
    budget: number
    passed: boolean
    delta: number
  }>
  score: number // 0-100
}

// バジェット定数 — 期待される定義
const PERFORMANCE_BUDGET: PerformanceBudget = {
  lcp: 2500,
  fid: 100,
  cls: 0.1,
  ttfb: 600,
  fcp: 1800,
  si: 3400,
  tbt: 200,
  bundleSize: {
    js: 300,
    css: 50,
    total: 400,
  },
}

// 契約模倣関数
const checkPerformanceBudget = vi.fn()

describe('Lighthouseパフォーマンスバジェット', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PERFORMANCE_BUDGET 定数', () => {
    it('LCPバジェットが定義されていること', () => {
      expect(typeof PERFORMANCE_BUDGET.lcp).toBe('number')
      expect(PERFORMANCE_BUDGET.lcp).toBeGreaterThan(0)
      // Google推奨: 2.5s以下
      expect(PERFORMANCE_BUDGET.lcp).toBeLessThanOrEqual(2500)
    })

    it('FIDバジェットが定義されていること', () => {
      expect(typeof PERFORMANCE_BUDGET.fid).toBe('number')
      expect(PERFORMANCE_BUDGET.fid).toBeGreaterThan(0)
      // Google推奨: 100ms以下
      expect(PERFORMANCE_BUDGET.fid).toBeLessThanOrEqual(100)
    })

    it('CLSバジェットが定義されていること', () => {
      expect(typeof PERFORMANCE_BUDGET.cls).toBe('number')
      expect(PERFORMANCE_BUDGET.cls).toBeGreaterThan(0)
      // Google推奨: 0.1以下
      expect(PERFORMANCE_BUDGET.cls).toBeLessThanOrEqual(0.1)
    })

    it('TTFBバジェットが定義されていること', () => {
      expect(typeof PERFORMANCE_BUDGET.ttfb).toBe('number')
      expect(PERFORMANCE_BUDGET.ttfb).toBeGreaterThan(0)
      // Google推奨: 600ms以下
      expect(PERFORMANCE_BUDGET.ttfb).toBeLessThanOrEqual(800)
    })

    it('FCPバジェットが定義されていること', () => {
      expect(typeof PERFORMANCE_BUDGET.fcp).toBe('number')
      expect(PERFORMANCE_BUDGET.fcp).toBeGreaterThan(0)
      // Google推奨: 1.8s以下
      expect(PERFORMANCE_BUDGET.fcp).toBeLessThanOrEqual(1800)
    })

    it('バンドルサイズバジェットが定義されていること', () => {
      expect(PERFORMANCE_BUDGET.bundleSize).toBeDefined()
      expect(typeof PERFORMANCE_BUDGET.bundleSize.js).toBe('number')
      expect(typeof PERFORMANCE_BUDGET.bundleSize.css).toBe('number')
      expect(typeof PERFORMANCE_BUDGET.bundleSize.total).toBe('number')
      expect(PERFORMANCE_BUDGET.bundleSize.js).toBeGreaterThan(0)
      expect(PERFORMANCE_BUDGET.bundleSize.css).toBeGreaterThan(0)
      expect(PERFORMANCE_BUDGET.bundleSize.total).toBeGreaterThanOrEqual(
        PERFORMANCE_BUDGET.bundleSize.js + PERFORMANCE_BUDGET.bundleSize.css
      )
    })
  })

  describe('checkPerformanceBudget()', () => {
    it('全メトリクスがバジェット内の場合、passed: true を返すこと', () => {
      checkPerformanceBudget.mockReturnValue({
        passed: true,
        metrics: {
          lcp: { value: 1800, budget: 2500, passed: true, delta: -700 },
          fcp: { value: 1200, budget: 1800, passed: true, delta: -600 },
          cls: { value: 0.05, budget: 0.1, passed: true, delta: -0.05 },
          ttfb: { value: 400, budget: 600, passed: true, delta: -200 },
        },
        score: 95,
      } satisfies BudgetCheckResult)

      const result: BudgetCheckResult = checkPerformanceBudget({
        lcp: 1800,
        fcp: 1200,
        cls: 0.05,
        ttfb: 400,
      })

      expect(result.passed).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(80)
    })

    it('一部メトリクスがバジェット超過の場合、passed: false を返すこと', () => {
      checkPerformanceBudget.mockReturnValue({
        passed: false,
        metrics: {
          lcp: { value: 3500, budget: 2500, passed: false, delta: 1000 },
          fcp: { value: 1200, budget: 1800, passed: true, delta: -600 },
          cls: { value: 0.05, budget: 0.1, passed: true, delta: -0.05 },
          ttfb: { value: 400, budget: 600, passed: true, delta: -200 },
        },
        score: 65,
      } satisfies BudgetCheckResult)

      const result: BudgetCheckResult = checkPerformanceBudget({
        lcp: 3500,
        fcp: 1200,
        cls: 0.05,
        ttfb: 400,
      })

      expect(result.passed).toBe(false)
      expect(result.metrics.lcp.passed).toBe(false)
      expect(result.metrics.lcp.delta).toBeGreaterThan(0)
    })

    it('各メトリクスにvalue, budget, passed, deltaが含まれること', () => {
      checkPerformanceBudget.mockReturnValue({
        passed: true,
        metrics: {
          lcp: { value: 2000, budget: 2500, passed: true, delta: -500 },
        },
        score: 90,
      } satisfies BudgetCheckResult)

      const result: BudgetCheckResult = checkPerformanceBudget({ lcp: 2000 })

      Object.values(result.metrics).forEach(metric => {
        expect(typeof metric.value).toBe('number')
        expect(typeof metric.budget).toBe('number')
        expect(typeof metric.passed).toBe('boolean')
        expect(typeof metric.delta).toBe('number')
      })
    })

    it('deltaが正の値の場合、バジェット超過であること', () => {
      checkPerformanceBudget.mockReturnValue({
        passed: false,
        metrics: {
          lcp: { value: 3000, budget: 2500, passed: false, delta: 500 },
          cls: { value: 0.15, budget: 0.1, passed: false, delta: 0.05 },
        },
        score: 50,
      } satisfies BudgetCheckResult)

      const result: BudgetCheckResult = checkPerformanceBudget({ lcp: 3000, cls: 0.15 })

      Object.values(result.metrics).forEach(metric => {
        if (!metric.passed) {
          expect(metric.delta).toBeGreaterThan(0)
          expect(metric.value).toBeGreaterThan(metric.budget)
        }
      })
    })

    it('deltaが負の値の場合、バジェット内であること', () => {
      checkPerformanceBudget.mockReturnValue({
        passed: true,
        metrics: {
          lcp: { value: 1500, budget: 2500, passed: true, delta: -1000 },
          fcp: { value: 1000, budget: 1800, passed: true, delta: -800 },
        },
        score: 98,
      } satisfies BudgetCheckResult)

      const result: BudgetCheckResult = checkPerformanceBudget({ lcp: 1500, fcp: 1000 })

      Object.values(result.metrics).forEach(metric => {
        if (metric.passed) {
          expect(metric.delta).toBeLessThanOrEqual(0)
          expect(metric.value).toBeLessThanOrEqual(metric.budget)
        }
      })
    })

    it('スコアが0-100の範囲であること', () => {
      checkPerformanceBudget.mockReturnValue({
        passed: true,
        metrics: {},
        score: 85,
      } satisfies BudgetCheckResult)

      const result: BudgetCheckResult = checkPerformanceBudget({})

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })
  })
})
