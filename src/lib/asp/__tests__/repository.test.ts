/**
 * ASPプログラム repository テスト
 * - Supabase 統合 (モック)
 * - キャッシュ動作 (TTL, スタンピード防止)
 * - フォールバック挙動
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMockAspProgram } from '@/test/helpers'
import type { AspProgramRow } from '@/types/database'

// ============================================================
// モック設定
// ============================================================

// next/server の connection() をモック (テスト環境ではリクエストスコープが存在しない)
vi.mock('next/server', () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}))

// Supabase client モック
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// config.ts フォールバックモック
const mockGetProgramsByCategory = vi.fn()
vi.mock('@/lib/asp/config', () => ({
  getProgramsByCategory: (...args: unknown[]) => mockGetProgramsByCategory(...args),
}))

// helpers.ts モック
const mockMapRowToProgram = vi.fn()
vi.mock('@/lib/asp/helpers', () => ({
  mapRowToProgram: (...args: unknown[]) => mockMapRowToProgram(...args),
}))

// ============================================================
// ヘルパー
// ============================================================

/** Supabase チェーンクエリの戻り値を設定する */
function setupSupabaseChain(result: { data: unknown[] | null; error: { message: string } | null }) {
  mockOrder.mockResolvedValue(result)
  mockEq.mockReturnValue({ eq: mockEq, order: mockOrder })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

/** DB行データのモックを生成する */
function createMockRow(overrides?: Partial<AspProgramRow>): AspProgramRow {
  return {
    id: 'asp-001',
    asp_name: 'afb',
    program_name: 'AGAクリニック テスト',
    program_id: 'afb-aga-001',
    category: 'aga',
    reward_tiers: [{ condition: '初回来院完了', amount: 15000, type: 'fixed' }],
    approval_rate: 45,
    epc: 120,
    itp_support: true,
    cookie_duration: 30,
    is_active: true,
    priority: 1,
    recommended_anchors: ['AGAクリニックの詳細を見る'],
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

// ============================================================
// テスト
// ============================================================

describe('asp/repository', () => {
  let getProgramsByCategoryFromDB: typeof import('../repository').getProgramsByCategoryFromDB
  let clearProgramCache: typeof import('../repository').clearProgramCache

  const fallbackPrograms = [createMockAspProgram({ id: 'fallback-001', category: 'aga' })]

  beforeEach(async () => {
    vi.resetModules()
    vi.restoreAllMocks()

    // re-mock after resetModules
    vi.mock('@/lib/supabase/client', () => ({
      createServerSupabaseClient: vi.fn(() => ({
        from: mockFrom,
      })),
    }))
    vi.mock('@/lib/asp/config', () => ({
      getProgramsByCategory: (...args: unknown[]) => mockGetProgramsByCategory(...args),
    }))
    vi.mock('@/lib/asp/helpers', () => ({
      mapRowToProgram: (...args: unknown[]) => mockMapRowToProgram(...args),
    }))

    // デフォルトのフォールバック
    mockGetProgramsByCategory.mockReturnValue(fallbackPrograms)

    // mapRowToProgram のデフォルト実装
    mockMapRowToProgram.mockImplementation((row: AspProgramRow) => ({
      id: row.id,
      aspName: row.asp_name,
      programName: row.program_name,
      programId: row.program_id,
      category: row.category,
      rewardTiers: Array.isArray(row.reward_tiers) ? row.reward_tiers : [],
      approvalRate: row.approval_rate,
      epc: row.epc,
      itpSupport: row.itp_support,
      cookieDuration: row.cookie_duration,
      isActive: row.is_active,
      priority: row.priority,
      recommendedAnchors: row.recommended_anchors,
      notes: row.notes ?? undefined,
    }))

    // モック関数リセット
    mockFrom.mockReset()
    mockSelect.mockReset()
    mockEq.mockReset()
    mockOrder.mockReset()

    // 環境変数設定 (デフォルト: Supabase有効)
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    // 動的インポートで最新モジュールを取得
    const mod = await import('../repository')
    getProgramsByCategoryFromDB = mod.getProgramsByCategoryFromDB
    clearProgramCache = mod.clearProgramCache

    // テスト間でキャッシュをリセット
    clearProgramCache()
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    vi.restoreAllMocks()
  })

  // ----------------------------------------------------------
  // 1. Supabase未設定時 → config.tsのフォールバックデータを返す
  // ----------------------------------------------------------
  it('Supabase未設定時にconfig.tsのフォールバックデータを返す', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY

    const result = await getProgramsByCategoryFromDB('aga')

    expect(result).toEqual(fallbackPrograms)
    expect(mockGetProgramsByCategory).toHaveBeenCalledWith('aga')
    // Supabase には問い合わせない
    expect(mockFrom).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------
  // 2. Supabaseから正常取得 → DB行データがAspProgramに正しく変換
  // ----------------------------------------------------------
  it('Supabaseから正常にデータを取得しAspProgramに変換する', async () => {
    const mockRow = createMockRow()
    setupSupabaseChain({ data: [mockRow], error: null })

    const result = await getProgramsByCategoryFromDB('aga')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('asp-001')
    expect(result[0].aspName).toBe('afb')
    expect(result[0].programName).toBe('AGAクリニック テスト')
    expect(result[0].category).toBe('aga')
    expect(result[0].isActive).toBe(true)
    expect(mockMapRowToProgram).toHaveBeenCalledWith(mockRow)
    expect(mockFrom).toHaveBeenCalledWith('asp_programs')
  })

  // ----------------------------------------------------------
  // 3. Supabaseエラー時 → config.tsにフォールバック + console.warn
  // ----------------------------------------------------------
  it('Supabaseエラー時にconfig.tsにフォールバックしconsole.warnを出力する', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setupSupabaseChain({ data: null, error: { message: 'connection timeout' } })

    const result = await getProgramsByCategoryFromDB('aga')

    expect(result).toEqual(fallbackPrograms)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Supabase query failed'),
    )
    warnSpy.mockRestore()
  })

  // ----------------------------------------------------------
  // 4. キャッシュ動作 → 2回呼び出しで2回目はSupabaseに問い合わせない
  // ----------------------------------------------------------
  it('2回目の呼び出しではキャッシュを使用しSupabaseに問い合わせない', async () => {
    const mockRow = createMockRow()
    setupSupabaseChain({ data: [mockRow], error: null })

    // 1回目
    const result1 = await getProgramsByCategoryFromDB('aga')
    expect(result1).toHaveLength(1)

    // mockFrom の呼び出し回数をリセット
    const callCountAfterFirst = mockFrom.mock.calls.length

    // 2回目 (キャッシュヒット)
    const result2 = await getProgramsByCategoryFromDB('aga')
    expect(result2).toHaveLength(1)
    expect(result2).toEqual(result1)

    // mockFrom が追加で呼ばれていないことを確認
    expect(mockFrom.mock.calls.length).toBe(callCountAfterFirst)
  })

  // ----------------------------------------------------------
  // 5. キャッシュ期限切れ → TTL経過後に再取得する
  // ----------------------------------------------------------
  it('キャッシュTTL経過後に再取得する', async () => {
    const mockRow = createMockRow()
    setupSupabaseChain({ data: [mockRow], error: null })

    // 1回目
    await getProgramsByCategoryFromDB('aga')
    const callCountAfterFirst = mockFrom.mock.calls.length

    // 時間を進める (5分 + 1秒)
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1000)

    // キャッシュ期限切れ → 再取得
    await getProgramsByCategoryFromDB('aga')
    expect(mockFrom.mock.calls.length).toBeGreaterThan(callCountAfterFirst)

    vi.useRealTimers()
  })

  // ----------------------------------------------------------
  // 6. clearProgramCache → キャッシュクリア後に再取得する
  // ----------------------------------------------------------
  it('clearProgramCache後にSupabaseから再取得する', async () => {
    const mockRow = createMockRow()
    setupSupabaseChain({ data: [mockRow], error: null })

    // 1回目
    await getProgramsByCategoryFromDB('aga')
    const callCountAfterFirst = mockFrom.mock.calls.length

    // キャッシュクリア
    clearProgramCache()

    // 2回目 (キャッシュクリア後 → 再取得)
    await getProgramsByCategoryFromDB('aga')
    expect(mockFrom.mock.calls.length).toBeGreaterThan(callCountAfterFirst)
  })

  // ----------------------------------------------------------
  // 7. DB空結果 → data.length === 0 の場合にconfig.tsフォールバック
  // ----------------------------------------------------------
  it('DBが空結果を返した場合にconfig.tsにフォールバックする', async () => {
    setupSupabaseChain({ data: [], error: null })

    const result = await getProgramsByCategoryFromDB('aga')

    expect(result).toEqual(fallbackPrograms)
    expect(mockGetProgramsByCategory).toHaveBeenCalledWith('aga')
  })

  // ----------------------------------------------------------
  // 8. 同時リクエスト(スタンピード防止) → 同じカテゴリの同時呼び出しがDBを1回だけ呼ぶ
  // ----------------------------------------------------------
  it('同じカテゴリへの同時リクエストがDBを1回だけ呼ぶ (スタンピード防止)', async () => {
    const mockRow = createMockRow()

    // 遅延付きの Supabase レスポンス (同時呼び出しをシミュレーション)
    let resolveQuery: (value: { data: AspProgramRow[]; error: null }) => void
    const delayedPromise = new Promise<{ data: AspProgramRow[]; error: null }>((resolve) => {
      resolveQuery = resolve
    })
    mockOrder.mockReturnValue(delayedPromise)
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })

    // 3つの同時リクエストを発行
    const promise1 = getProgramsByCategoryFromDB('aga')
    const promise2 = getProgramsByCategoryFromDB('aga')
    const promise3 = getProgramsByCategoryFromDB('aga')

    // クエリを解決
    resolveQuery!({ data: [mockRow], error: null })

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3])

    // 3つ全てが同じ結果を返す
    expect(result1).toEqual(result2)
    expect(result2).toEqual(result3)
    expect(result1).toHaveLength(1)

    // mockFrom は 1 回だけ呼ばれる (スタンピード防止)
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})
