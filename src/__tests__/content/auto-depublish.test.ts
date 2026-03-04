/**
 * Auto-Depublish Unit Tests
 * 自動非公開システムのテスト — しきい値判定、除外ロジック、scanAndDepublish
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ============================================================
// モック定義
// ============================================================

// ComplianceChecker モック
const mockCheck = vi.fn()
vi.mock('@/lib/compliance/checker', () => ({
  ComplianceChecker: class MockComplianceChecker {
    check = mockCheck
  },
}))

// AlertManager モック
const mockCreateAlert = vi.fn().mockResolvedValue({ id: 'alert-001' })
vi.mock('@/lib/monitoring/alert-manager', () => ({
  AlertManager: class MockAlertManager {
    createAlert = mockCreateAlert
  },
}))

// Supabase モック (動的インポート)
vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}))

import {
  scanAndDepublish,
  checkShouldDepublish,
} from '@/lib/content/auto-depublish'

// ============================================================
// テスト
// ============================================================

describe('checkShouldDepublish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('スコアが閾値以上でクリティカル違反なしの場合shouldDepublish=falseを返すこと', () => {
    mockCheck.mockReturnValue({
      isCompliant: true,
      violations: [],
      fixedText: 'テキスト',
      hasPRDisclosure: true,
      missingItems: [],
      score: 85,
    })

    const result = checkShouldDepublish('安全なコンテンツです。', 70)

    expect(result.shouldDepublish).toBe(false)
    expect(result.reason).toBe('問題なし')
    expect(result.result.score).toBe(85)
  })

  it('スコアが閾値未満の場合shouldDepublish=trueを返すこと', () => {
    mockCheck.mockReturnValue({
      isCompliant: false,
      violations: [
        {
          id: 'v1',
          type: 'pharmaceutical_law',
          severity: 'medium',
          ngText: '効果あり',
          suggestedText: '効果が期待できる',
          reason: '断定表現',
          position: { start: 0, end: 4 },
        },
      ],
      fixedText: '修正テキスト',
      hasPRDisclosure: true,
      missingItems: [],
      score: 55,
    })

    const result = checkShouldDepublish('効果ありのコンテンツ', 70)

    expect(result.shouldDepublish).toBe(true)
    expect(result.reason).toContain('スコア 55')
    expect(result.reason).toContain('閾値 70')
  })

  it('クリティカル違反（severity: high）がある場合shouldDepublish=trueを返すこと', () => {
    mockCheck.mockReturnValue({
      isCompliant: false,
      violations: [
        {
          id: 'v1',
          type: 'pharmaceutical_law',
          severity: 'high',
          ngText: '確実に治る',
          suggestedText: '効果が期待できる',
          reason: '薬機法違反',
          position: { start: 0, end: 5 },
        },
      ],
      fixedText: '修正テキスト',
      hasPRDisclosure: true,
      missingItems: [],
      score: 90,
    })

    // スコアは閾値以上だがクリティカル違反がある
    const result = checkShouldDepublish('確実に治るコンテンツ', 70)

    expect(result.shouldDepublish).toBe(true)
    expect(result.reason).toContain('クリティカル違反あり')
  })

  it('スコア不足 + クリティカル違反の両方がある場合に両方の理由を含むこと', () => {
    mockCheck.mockReturnValue({
      isCompliant: false,
      violations: [
        {
          id: 'v1',
          type: 'pharmaceutical_law',
          severity: 'high',
          ngText: '確実に治る',
          suggestedText: '効果が期待できる',
          reason: '薬機法違反',
          position: { start: 0, end: 5 },
        },
      ],
      fixedText: '修正テキスト',
      hasPRDisclosure: false,
      missingItems: ['PR表記'],
      score: 40,
    })

    const result = checkShouldDepublish('確実に治るコンテンツ', 70)

    expect(result.shouldDepublish).toBe(true)
    expect(result.reason).toContain('スコア 40')
    expect(result.reason).toContain('クリティカル違反あり')
  })

  it('デフォルト閾値（70）が使用されること', () => {
    mockCheck.mockReturnValue({
      isCompliant: true,
      violations: [],
      fixedText: 'テキスト',
      hasPRDisclosure: true,
      missingItems: [],
      score: 75,
    })

    const result = checkShouldDepublish('安全なテキスト')

    expect(result.shouldDepublish).toBe(false)
  })

  it('全カテゴリでチェックが実行されること', () => {
    mockCheck.mockReturnValue({
      isCompliant: true,
      violations: [],
      fixedText: 'テキスト',
      hasPRDisclosure: true,
      missingItems: [],
      score: 100,
    })

    checkShouldDepublish('テスト')

    expect(mockCheck).toHaveBeenCalledWith('テスト', {
      categories: ['aga', 'hair_removal', 'skincare', 'ed', 'common'],
    })
  })
})

describe('scanAndDepublish', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('microCMS 未設定時に空の結果を返すこと', async () => {
    delete process.env.MICROCMS_SERVICE_DOMAIN
    delete process.env.MICROCMS_API_KEY

    const result = await scanAndDepublish({ dryRun: true })

    expect(result.totalScanned).toBe(0)
    expect(result.flaggedCount).toBe(0)
    expect(result.depublishedCount).toBe(0)
    expect(result.candidates).toHaveLength(0)
    expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
    expect(result.executedAt).toBeDefined()
  })

  it('公開記事をスキャンしてコンプライアンス違反を検出すること', async () => {
    process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
    process.env.MICROCMS_API_KEY = 'test-api-key'

    // microCMS fetch モック
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          contents: [
            { id: 'art-001', title: '良い記事', slug: 'good-article', content: '安全なコンテンツ' },
            { id: 'art-002', title: '問題のある記事', slug: 'bad-article', content: '確実に髪が生える' },
          ],
          totalCount: 2,
        }),
    } as unknown as Response)

    vi.stubGlobal('fetch', mockFetch)

    // 1記事目: 合格、2記事目: 不合格
    mockCheck
      .mockReturnValueOnce({
        isCompliant: true,
        violations: [],
        fixedText: '安全なコンテンツ',
        hasPRDisclosure: true,
        missingItems: [],
        score: 95,
      })
      .mockReturnValueOnce({
        isCompliant: false,
        violations: [
          {
            id: 'v1',
            type: 'pharmaceutical_law',
            severity: 'high',
            ngText: '確実に髪が生える',
            suggestedText: '発毛を促進する効果が期待できる',
            reason: '薬機法違反',
            position: { start: 0, end: 8 },
          },
        ],
        fixedText: '発毛を促進する効果が期待できる',
        hasPRDisclosure: false,
        missingItems: ['PR表記'],
        score: 30,
      })

    const result = await scanAndDepublish({ dryRun: true, scoreThreshold: 70 })

    expect(result.totalScanned).toBe(2)
    expect(result.flaggedCount).toBe(1)
    expect(result.depublishedCount).toBe(1)  // dryRunでもカウントされる
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].contentId).toBe('art-002')
    expect(result.candidates[0].hasCriticalViolation).toBe(true)
    expect(result.candidates[0].reason).toContain('クリティカル違反')
  })

  it('デフォルト設定が正しく適用されること', async () => {
    delete process.env.MICROCMS_SERVICE_DOMAIN
    delete process.env.MICROCMS_API_KEY

    const result = await scanAndDepublish()

    // microCMS未設定なので記事0件
    expect(result.totalScanned).toBe(0)
    expect(result.failedCount).toBe(0)
  })

  it('全記事が合格の場合にflaggedCount=0を返すこと', async () => {
    process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
    process.env.MICROCMS_API_KEY = 'test-api-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          contents: [
            { id: 'art-001', title: '良い記事1', slug: 'good-1', content: '安全なコンテンツ1' },
            { id: 'art-002', title: '良い記事2', slug: 'good-2', content: '安全なコンテンツ2' },
          ],
          totalCount: 2,
        }),
    } as unknown as Response)

    vi.stubGlobal('fetch', mockFetch)

    mockCheck.mockReturnValue({
      isCompliant: true,
      violations: [],
      fixedText: '安全なコンテンツ',
      hasPRDisclosure: true,
      missingItems: [],
      score: 95,
    })

    const result = await scanAndDepublish({ dryRun: true })

    expect(result.totalScanned).toBe(2)
    expect(result.flaggedCount).toBe(0)
    expect(result.depublishedCount).toBe(0)
    expect(result.candidates).toHaveLength(0)
  })

  it('アラートが各候補に対して作成されること', async () => {
    process.env.MICROCMS_SERVICE_DOMAIN = 'test-service'
    process.env.MICROCMS_API_KEY = 'test-api-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          contents: [
            { id: 'art-001', title: '問題記事', slug: 'bad', content: 'NG' },
          ],
          totalCount: 1,
        }),
    } as unknown as Response)

    vi.stubGlobal('fetch', mockFetch)

    mockCheck.mockReturnValue({
      isCompliant: false,
      violations: [
        {
          id: 'v1',
          type: 'pharmaceutical_law',
          severity: 'high',
          ngText: 'NG',
          suggestedText: 'OK',
          reason: '薬機法違反',
          position: { start: 0, end: 2 },
        },
      ],
      fixedText: 'OK',
      hasPRDisclosure: false,
      missingItems: ['PR表記'],
      score: 20,
    })

    const result = await scanAndDepublish({ dryRun: true })

    expect(mockCreateAlert).toHaveBeenCalledTimes(1)
    expect(mockCreateAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'compliance_violation',
        severity: 'critical',
        title: expect.stringContaining('問題記事'),
      })
    )
    expect(result.alertIds).toHaveLength(1)
    expect(result.alertIds[0]).toBe('alert-001')
  })
})
