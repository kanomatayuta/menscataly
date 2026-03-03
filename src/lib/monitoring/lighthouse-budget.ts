/**
 * パフォーマンスバジェット
 * Core Web Vitals (CWV) の閾値定義とチェック
 */

// ============================================================
// パフォーマンスバジェット定義
// ============================================================

export interface PerformanceBudget {
  /** Largest Contentful Paint (ms) */
  lcp: number
  /** First Input Delay (ms) */
  fid: number
  /** Cumulative Layout Shift */
  cls: number
  /** First Contentful Paint (ms) */
  fcp: number
  /** Time to First Byte (ms) */
  ttfb: number
  /** Total Blocking Time (ms) */
  tbt: number
  /** Speed Index (ms) */
  si: number
}

export const PERFORMANCE_BUDGETS: PerformanceBudget = {
  lcp: 2500,   // Good: <= 2.5s
  fid: 100,    // Good: <= 100ms
  cls: 0.1,    // Good: <= 0.1
  fcp: 1800,   // Good: <= 1.8s
  ttfb: 800,   // Good: <= 800ms
  tbt: 200,    // Good: <= 200ms
  si: 3400,    // Good: <= 3.4s
}

// ============================================================
// メトリクス入力型
// ============================================================

export interface PerformanceMetrics {
  lcp?: number
  fid?: number
  cls?: number
  fcp?: number
  ttfb?: number
  tbt?: number
  si?: number
}

// ============================================================
// チェック結果
// ============================================================

export interface BudgetViolation {
  metric: keyof PerformanceBudget
  actual: number
  budget: number
  exceeded: boolean
  exceedRatio: number
}

export interface PerformanceBudgetResult {
  passed: boolean
  violations: BudgetViolation[]
  summary: {
    totalChecked: number
    totalPassed: number
    totalFailed: number
  }
}

// ============================================================
// チェック関数
// ============================================================

/**
 * パフォーマンスメトリクスをバジェットと照合する
 */
export function checkPerformanceBudget(
  metrics: PerformanceMetrics,
  budgets: PerformanceBudget = PERFORMANCE_BUDGETS
): PerformanceBudgetResult {
  const violations: BudgetViolation[] = []
  let totalChecked = 0
  let totalPassed = 0
  let totalFailed = 0

  const entries = Object.entries(metrics) as Array<
    [keyof PerformanceBudget, number | undefined]
  >

  for (const [metric, value] of entries) {
    if (value === undefined || !(metric in budgets)) continue

    totalChecked++
    const budget = budgets[metric]
    const exceeded = value > budget

    if (exceeded) {
      totalFailed++
    } else {
      totalPassed++
    }

    violations.push({
      metric,
      actual: value,
      budget,
      exceeded,
      exceedRatio: budget > 0 ? value / budget : 0,
    })
  }

  return {
    passed: totalFailed === 0,
    violations: violations.filter((v) => v.exceeded),
    summary: {
      totalChecked,
      totalPassed,
      totalFailed,
    },
  }
}
