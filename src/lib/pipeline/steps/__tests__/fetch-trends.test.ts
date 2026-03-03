/**
 * fetch-trends ステップ Unit Tests
 * トレンドデータ取得ロジック、モックデータ生成、エラー処理をテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTrendsStep } from '../fetch-trends'
import { createMockPipelineContext } from '@/test/helpers'
import type { TrendData } from '../../types'

// ============================================================
// テスト本体
// ============================================================

describe('fetch-trends ステップ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // PYTRENDS_SERVICE_URL を未設定にしてモックモードで実行
    delete process.env.PYTRENDS_SERVICE_URL
  })

  describe('ステップ定義', () => {
    it('ステップ名が "fetch-trends" であること', () => {
      expect(fetchTrendsStep.name).toBe('fetch-trends')
    })

    it('descriptionが定義されていること', () => {
      expect(fetchTrendsStep.description).toBeDefined()
      expect(fetchTrendsStep.description.length).toBeGreaterThan(0)
    })

    it('maxRetriesが3であること', () => {
      expect(fetchTrendsStep.maxRetries).toBe(3)
    })
  })

  describe('モックデータ生成 (PYTRENDS_SERVICE_URL未設定)', () => {
    it('トレンドデータの配列を返すこと', async () => {
      const context = createMockPipelineContext()
      const result = await fetchTrendsStep.execute(undefined, context)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('各トレンドデータに必須フィールドが含まれること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchTrendsStep.execute(undefined, context)

      for (const trend of result) {
        expect(trend.keyword).toBeDefined()
        expect(typeof trend.keyword).toBe('string')
        expect(trend.relativeValue).toBeDefined()
        expect(typeof trend.relativeValue).toBe('number')
        expect(trend.category).toBeDefined()
        expect(typeof trend.category).toBe('string')
        expect(trend.fetchedAt).toBeDefined()
      }
    })

    it('relativeValueが40-100の範囲であること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchTrendsStep.execute(undefined, context)

      for (const trend of result) {
        expect(trend.relativeValue).toBeGreaterThanOrEqual(40)
        expect(trend.relativeValue).toBeLessThanOrEqual(99)
      }
    })

    it('AGA, 脱毛, スキンケア, EDの4カテゴリ分のデータが含まれること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchTrendsStep.execute(undefined, context)

      const categories = new Set(result.map((t: TrendData) => t.category))
      expect(categories.has('aga')).toBe(true)
      expect(categories.has('hair-removal')).toBe(true)
      expect(categories.has('skincare')).toBe(true)
      expect(categories.has('ed')).toBe(true)
    })

    it('トレンドデータがrelativeValueの降順でソートされていること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchTrendsStep.execute(undefined, context)

      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].relativeValue).toBeGreaterThanOrEqual(
          result[i].relativeValue
        )
      }
    })

    it('コンテキストのsharedDataにtrendsが保存されること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchTrendsStep.execute(undefined, context)

      expect(context.sharedData['trends']).toBe(result)
    })
  })

  describe('pytrends サービス連携 (PYTRENDS_SERVICE_URL設定時)', () => {
    it('PYTRENDS_SERVICE_URL設定時にfetchが呼ばれること', async () => {
      process.env.PYTRENDS_SERVICE_URL = 'https://pytrends.example.com'

      const mockTrends: TrendData[] = [
        { keyword: 'AGA治療', relativeValue: 80, category: 'aga', fetchedAt: new Date().toISOString() },
      ]

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ trends: mockTrends }), { status: 200 })
      )

      const context = createMockPipelineContext()
      const result = await fetchTrendsStep.execute(undefined, context)

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://pytrends.example.com/trends',
        expect.objectContaining({
          method: 'POST',
        })
      )

      expect(result).toHaveLength(1)
      expect(result[0].keyword).toBe('AGA治療')

      fetchSpy.mockRestore()
      delete process.env.PYTRENDS_SERVICE_URL
    })

    it('pytrends サービスがエラーを返した場合、例外がスローされること', async () => {
      process.env.PYTRENDS_SERVICE_URL = 'https://pytrends.example.com'

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' })
      )

      const context = createMockPipelineContext()

      await expect(fetchTrendsStep.execute(undefined, context)).rejects.toThrow(
        'pytrends service error'
      )

      fetchSpy.mockRestore()
      delete process.env.PYTRENDS_SERVICE_URL
    })
  })
})
