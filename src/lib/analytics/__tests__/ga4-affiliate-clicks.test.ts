/**
 * GA4 アフィリエイトクリック取得 ユニットテスト
 *
 * fetchAffiliateClicks は別エージェントが ga4-client.ts に実装する予定。
 * この関数は runGA4Report を使って eventName='affiliate_link_click' でフィルタし、
 * dimensions: pagePath, date, customEvent:asp_name, customEvent:program_id
 * metrics: eventCount
 * で GA4 Data API に問い合わせ、GA4AffiliateClickRow[] を返す。
 *
 * 関数が未実装の場合は test.skip で待機する。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMockAffiliateClickResponse } from '@/test/mocks/ga4'

// fetchAffiliateClicks のインポートを試みる。
// 別エージェントがまだ実装していない可能性があるため、
// 動的インポートで存在確認してからテストを実行する。
let fetchAffiliateClicks: ((startDate: string, endDate: string) => Promise<Array<{
  pagePath: string
  date: string
  aspName: string
  programId: string
  clickCount: number
}>>) | undefined

let isImplemented = false

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../ga4-client')
  if (typeof mod.fetchAffiliateClicks === 'function') {
    fetchAffiliateClicks = mod.fetchAffiliateClicks
    isImplemented = true
  }
} catch {
  // モジュール読み込み失敗 — 未実装とみなす
}

// ============================================================
// テストスイート
// ============================================================

describe('fetchAffiliateClicks', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  // ----------------------------------------------------------
  // GA4_PROPERTY_ID 未設定 → 空配列
  // ----------------------------------------------------------
  it.skipIf(!isImplemented)('GA4_PROPERTY_ID 未設定時は空配列を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '')

    const result = await fetchAffiliateClicks!('2026-03-01', '2026-03-05')
    expect(result).toEqual([])
  })

  // ----------------------------------------------------------
  // 認証情報未設定 → 空配列
  // ----------------------------------------------------------
  it.skipIf(!isImplemented)('認証情報未設定時は空配列を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '')

    const result = await fetchAffiliateClicks!('2026-03-01', '2026-03-05')
    expect(result).toEqual([])
  })

  // ----------------------------------------------------------
  // 不正な秘密鍵 → 空配列 (エラーcatch)
  // ----------------------------------------------------------
  it.skipIf(!isImplemented)('不正な秘密鍵の場合は空配列を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'invalid-key-data')

    const result = await fetchAffiliateClicks!('2026-03-01', '2026-03-05')
    expect(result).toEqual([])
  })

  // ----------------------------------------------------------
  // 正常レスポンスのパース確認 (global.fetch をモック)
  // ----------------------------------------------------------
  it.skipIf(!isImplemented)('正常なGA4レスポンスをパースしてGA4AffiliateClickRow[]を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'test-key')

    const mockResponse = createMockAffiliateClickResponse([
      {
        pagePath: '/articles/aga-clinic-ranking',
        date: '20260305',
        aspName: 'a8',
        programId: 'a8-aga-001',
        eventCount: 12,
      },
      {
        pagePath: '/articles/hair-loss-treatment',
        date: '20260304',
        aspName: 'afb',
        programId: 'afb-hair-001',
        eventCount: 7,
      },
    ])

    // OAuth2 トークンリクエスト + GA4 レポートリクエストをモック
    const mockFetch = vi.fn()
      // 1回目: OAuth2 トークン取得
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-token', expires_in: 3600 }),
        text: async () => '',
      })
      // 2回目: GA4 runReport
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
      })

    globalThis.fetch = mockFetch

    const result = await fetchAffiliateClicks!('2026-03-01', '2026-03-05')

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      pagePath: '/articles/aga-clinic-ranking',
      date: '2026-03-05',
      aspName: 'a8',
      programId: 'a8-aga-001',
      clickCount: 12,
    })
    expect(result[1]).toEqual({
      pagePath: '/articles/hair-loss-treatment',
      date: '2026-03-04',
      aspName: 'afb',
      programId: 'afb-hair-001',
      clickCount: 7,
    })
  })

  // ----------------------------------------------------------
  // rows が undefined → 空配列
  // ----------------------------------------------------------
  it.skipIf(!isImplemented)('レスポンスの rows が undefined の場合は空配列を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'test-key')

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-token', expires_in: 3600 }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          dimensionHeaders: [],
          metricHeaders: [],
          // rows is undefined
        }),
        text: async () => '{}',
      })

    globalThis.fetch = mockFetch

    const result = await fetchAffiliateClicks!('2026-03-01', '2026-03-05')
    expect(result).toEqual([])
  })

  // ----------------------------------------------------------
  // rows が空配列 → 空配列
  // ----------------------------------------------------------
  it.skipIf(!isImplemented)('レスポンスの rows が空配列の場合は空配列を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'test-key')

    const emptyResponse = createMockAffiliateClickResponse([])

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-token', expires_in: 3600 }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => emptyResponse,
        text: async () => JSON.stringify(emptyResponse),
      })

    globalThis.fetch = mockFetch

    const result = await fetchAffiliateClicks!('2026-03-01', '2026-03-05')
    expect(result).toEqual([])
  })

  // ----------------------------------------------------------
  // モックファクトリ自体の検証 (常に実行)
  // ----------------------------------------------------------
  describe('createMockAffiliateClickResponse', () => {
    it('デフォルトで2件のクリックデータを生成する', () => {
      const response = createMockAffiliateClickResponse()

      expect(response.rows).toHaveLength(2)
      expect(response.rowCount).toBe(2)
      expect(response.dimensionHeaders).toEqual([
        { name: 'pagePath' },
        { name: 'date' },
        { name: 'customEvent:asp_name' },
        { name: 'customEvent:program_id' },
      ])
      expect(response.metricHeaders).toEqual([
        { name: 'eventCount', type: 'TYPE_INTEGER' },
      ])
    })

    it('カスタム行データを指定できる', () => {
      const response = createMockAffiliateClickResponse([
        {
          pagePath: '/articles/custom-article',
          date: '20260301',
          aspName: 'accesstrade',
          programId: 'at-skin-001',
          eventCount: 25,
        },
      ])

      expect(response.rows).toHaveLength(1)
      expect(response.rowCount).toBe(1)
      expect(response.rows![0].dimensionValues[0].value).toBe('/articles/custom-article')
      expect(response.rows![0].dimensionValues[1].value).toBe('20260301')
      expect(response.rows![0].dimensionValues[2].value).toBe('accesstrade')
      expect(response.rows![0].dimensionValues[3].value).toBe('at-skin-001')
      expect(response.rows![0].metricValues[0].value).toBe('25')
    })

    it('空配列を指定するとrows空のレスポンスを返す', () => {
      const response = createMockAffiliateClickResponse([])

      expect(response.rows).toHaveLength(0)
      expect(response.rowCount).toBe(0)
    })

    it('部分的なオーバーライドでデフォルト値が適用される', () => {
      const response = createMockAffiliateClickResponse([
        { aspName: 'felmat' },
      ])

      expect(response.rows).toHaveLength(1)
      const row = response.rows![0]
      // aspName はオーバーライド
      expect(row.dimensionValues[2].value).toBe('felmat')
      // 他はデフォルト値
      expect(row.dimensionValues[0].value).toBe('/articles/aga-clinic-ranking')
      expect(row.dimensionValues[1].value).toBe('20260305')
      expect(row.dimensionValues[3].value).toBe('a8-aga-001')
      expect(row.metricValues[0].value).toBe('1')
    })
  })
})
