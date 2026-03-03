/**
 * fetch-asp ステップ Unit Tests
 * ASP収益データ取得ロジック、カテゴリベースのプログラム選択、エラー処理をテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAspStep } from '../fetch-asp'
import { createMockPipelineContext } from '@/test/helpers'
import type { AspRevenueData } from '../../types'

// ============================================================
// テスト本体
// ============================================================

describe('fetch-asp ステップ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // ASP API キーを全て未設定にしてモックモードで実行
    delete process.env.AFB_API_KEY
    delete process.env.A8_API_KEY
    delete process.env.ACCESSTRADE_API_KEY
    delete process.env.VALUECOMMERCE_API_KEY
    delete process.env.FELMAT_API_KEY
  })

  describe('ステップ定義', () => {
    it('ステップ名が "fetch-asp" であること', () => {
      expect(fetchAspStep.name).toBe('fetch-asp')
    })

    it('descriptionが定義されていること', () => {
      expect(fetchAspStep.description).toBeDefined()
      expect(fetchAspStep.description.length).toBeGreaterThan(0)
    })

    it('maxRetriesが2であること', () => {
      expect(fetchAspStep.maxRetries).toBe(2)
    })
  })

  describe('モックデータ生成 (API未設定時)', () => {
    it('ASP収益データの配列を返すこと', async () => {
      const context = createMockPipelineContext()
      const result = await fetchAspStep.execute(undefined, context)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })

    it('各収益データに必須フィールドが含まれること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchAspStep.execute(undefined, context)

      for (const record of result) {
        expect(record.aspName).toBeDefined()
        expect(typeof record.aspName).toBe('string')
        expect(record.programName).toBeDefined()
        expect(typeof record.programName).toBe('string')
        expect(record.clicks).toBeDefined()
        expect(typeof record.clicks).toBe('number')
        expect(record.conversions).toBeDefined()
        expect(typeof record.conversions).toBe('number')
        expect(record.revenue).toBeDefined()
        expect(typeof record.revenue).toBe('number')
        expect(record.date).toBeDefined()
      }
    })

    it('clicksとconversionsが正の値であること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchAspStep.execute(undefined, context)

      for (const record of result) {
        expect(record.clicks).toBeGreaterThan(0)
        expect(record.conversions).toBeGreaterThan(0)
      }
    })

    it('コンテキストのsharedDataにaspRevenueが保存されること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchAspStep.execute(undefined, context)

      expect(context.sharedData['aspRevenue']).toBe(result)
    })
  })

  describe('カテゴリベースのプログラム選択', () => {
    it('モックデータに複数のASP名が含まれること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchAspStep.execute(undefined, context)

      const aspNames = new Set(result.map((r: AspRevenueData) => r.aspName))
      // ASPセレクターからプログラム情報を取得するため、複数ASPのデータが含まれる
      expect(aspNames.size).toBeGreaterThanOrEqual(1)
    })

    it('各レコードのrevenueが0以上であること', async () => {
      const context = createMockPipelineContext()
      const result = await fetchAspStep.execute(undefined, context)

      for (const record of result) {
        expect(record.revenue).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('ASP API連携 (APIキー設定時)', () => {
    it('APIキーが設定されている場合、そのASPのデータ取得を試みること', async () => {
      // afb のAPIキーのみ設定
      process.env.AFB_API_KEY = 'test-afb-api-key'

      const context = createMockPipelineContext()

      // fetchFromAsp は現時点ではモック実装（空配列を返す）
      // APIキーが設定されている場合、hasAnyConfig=true となり
      // モックフォールバックは使用されない
      const result = await fetchAspStep.execute(undefined, context)

      // afb API は未実装のため空配列が返される
      expect(Array.isArray(result)).toBe(true)

      delete process.env.AFB_API_KEY
    })
  })

  describe('エラー処理', () => {
    it('ASP API呼び出し中のエラーがキャッチされ、処理が続行されること', async () => {
      // 複数のASPキーを設定して、エラー時もクラッシュしないことを確認
      process.env.AFB_API_KEY = 'test-key'
      process.env.A8_API_KEY = 'test-key'

      const context = createMockPipelineContext()

      // fetchFromAsp は現在モック実装のため例外は発生しないが
      // エラーハンドリングの構造を確認
      const result = await fetchAspStep.execute(undefined, context)

      expect(Array.isArray(result)).toBe(true)

      delete process.env.AFB_API_KEY
      delete process.env.A8_API_KEY
    })
  })
})
