/**
 * ダッシュボードデータ取得 ユニットテスト
 * Phase 3b: 直接データ取得のテスト
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { fetchDashboardData, getMockDashboardData } from '../dashboard-data'

// ============================================================
// テスト
// ============================================================

describe('getMockDashboardData', () => {
  it('正しい形式のモックデータを返すこと', () => {
    const data = getMockDashboardData()

    expect(data).toBeDefined()
    expect(data.articles).toBeDefined()
    expect(data.articles.total).toBeGreaterThan(0)
    expect(data.pipeline).toBeDefined()
    expect(data.pipeline.status).toBe('idle')
    expect(data.revenue).toBeDefined()
    expect(data.costs).toBeDefined()
    expect(data.alerts).toEqual([])
  })

  it('articles に必須フィールドが含まれること', () => {
    const data = getMockDashboardData()

    expect(typeof data.articles.total).toBe('number')
    expect(typeof data.articles.published).toBe('number')
    expect(typeof data.articles.draft).toBe('number')
    expect(typeof data.articles.pendingReview).toBe('number')
    expect(typeof data.articles.avgComplianceScore).toBe('number')
  })

  it('costs に必須フィールドが含まれること', () => {
    const data = getMockDashboardData()

    expect(typeof data.costs.monthlyTotalUsd).toBe('number')
    expect(typeof data.costs.articleAvgUsd).toBe('number')
    expect(typeof data.costs.budgetRemainingUsd).toBe('number')
  })
})

describe('fetchDashboardData', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('Supabase未設定時にモックデータを返すこと', async () => {
    const data = await fetchDashboardData()

    expect(data).toBeDefined()
    expect(data.articles.total).toBeGreaterThan(0)
    expect(data.pipeline.status).toBe('idle')
  })

  it('返却データが AdminDashboardData 型に準拠すること', async () => {
    const data = await fetchDashboardData()

    // 全必須フィールドの存在確認
    expect(data).toHaveProperty('articles')
    expect(data).toHaveProperty('pipeline')
    expect(data).toHaveProperty('revenue')
    expect(data).toHaveProperty('costs')
    expect(data).toHaveProperty('alerts')

    // pipeline のサブフィールド
    expect(data.pipeline).toHaveProperty('status')
    expect(data.pipeline).toHaveProperty('totalRuns')

    // revenue のサブフィールド
    expect(data.revenue).toHaveProperty('monthlyTotalJpy')
    expect(data.revenue).toHaveProperty('byAsp')
  })
})
