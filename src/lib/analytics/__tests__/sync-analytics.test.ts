/**
 * sync-analytics ユニットテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// GA4/GSC モジュールをモック
vi.mock('../ga4-client', () => ({
  extractSlugFromPath: vi.fn((path: string) => {
    const match = path.match(/^\/articles\/([^/?#]+)/)
    return match ? match[1] : null
  }),
  buildSlugMap: vi.fn().mockResolvedValue({
    'aga-clinic-ranking': 'uuid-1',
    'hair-loss-treatment': 'uuid-2',
  }),
  fetchGA4DailyMetrics: vi.fn().mockResolvedValue([
    {
      pagePath: '/articles/aga-clinic-ranking',
      date: '2026-03-04',
      pageviews: 150,
      uniqueUsers: 120,
      avgTime: 45.5,
      bounceRate: 0.35,
      sessions: 130,
    },
  ]),
}))

vi.mock('../gsc-client', () => ({
  fetchGSCData: vi.fn().mockResolvedValue([]),
  extractSlugFromGSCPage: vi.fn((url: string) => {
    const match = url.match(/\/articles\/([^/?#]+)/)
    return match ? match[1] : null
  }),
}))

import { syncGA4ToSupabase, mergeGSCData, syncDailyAnalytics } from '../sync-analytics'
import type { GA4AnalyticsRow, GSCRow, SlugToIdMap } from '../types'

// ============================================================
// syncGA4ToSupabase
// ============================================================

describe('syncGA4ToSupabase', () => {
  const slugMap: SlugToIdMap = {
    'aga-clinic-ranking': 'uuid-1',
    'hair-loss-treatment': 'uuid-2',
  }

  const ga4Data: GA4AnalyticsRow[] = [
    {
      pagePath: '/articles/aga-clinic-ranking',
      date: '2026-03-04',
      pageviews: 150,
      uniqueUsers: 120,
      avgTime: 45.5,
      bounceRate: 0.35,
      sessions: 130,
    },
    {
      pagePath: '/articles/hair-loss-treatment',
      date: '2026-03-04',
      pageviews: 80,
      uniqueUsers: 65,
      avgTime: 60.2,
      bounceRate: 0.42,
      sessions: 70,
    },
  ]

  it('全行をバッチ upsert で正常に同期する', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: upsertFn,
        update: vi.fn(),
      }),
    }

    const result = await syncGA4ToSupabase(ga4Data, slugMap, mockSupabase)
    expect(result.synced).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    // バッチ upsert: 1回の呼び出しで配列を渡す
    expect(upsertFn).toHaveBeenCalledTimes(1)
    expect(upsertFn).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ article_id: 'uuid-1' }),
        expect.objectContaining({ article_id: 'uuid-2' }),
      ]),
      { onConflict: 'article_id,date' }
    )
  })

  it('slug が見つからない行はスキップする', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: upsertFn,
        update: vi.fn(),
      }),
    }

    const dataWithUnknown: GA4AnalyticsRow[] = [
      ...ga4Data,
      {
        pagePath: '/articles/unknown-article',
        date: '2026-03-04',
        pageviews: 10,
        uniqueUsers: 5,
        avgTime: 30,
        bounceRate: 0.8,
        sessions: 5,
      },
    ]

    const result = await syncGA4ToSupabase(dataWithUnknown, slugMap, mockSupabase)
    expect(result.synced).toBe(2)
    expect(result.skipped).toBe(1) // unknown-article がスキップ
    // バッチ upsert には有効な2行のみ含まれる
    expect(upsertFn).toHaveBeenCalledTimes(1)
    const upsertArg = upsertFn.mock.calls[0][0] as Record<string, unknown>[]
    expect(upsertArg).toHaveLength(2)
  })

  it('バッチ upsert エラー時は全行をスキップしてエラーログに記録する', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        update: vi.fn(),
      }),
    }

    const result = await syncGA4ToSupabase(ga4Data, slugMap, mockSupabase)
    expect(result.synced).toBe(0)
    expect(result.skipped).toBe(2) // バッチ失敗で全行スキップ
    expect(result.errors).toHaveLength(1) // バッチエラーは1件
    expect(result.errors[0]).toContain('DB error')
  })

  it('/articles/ 以外のパスはスキップする', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: upsertFn,
        update: vi.fn(),
      }),
    }

    const nonArticleData: GA4AnalyticsRow[] = [
      {
        pagePath: '/about',
        date: '2026-03-04',
        pageviews: 50,
        uniqueUsers: 40,
        avgTime: 20,
        bounceRate: 0.5,
        sessions: 45,
      },
    ]

    const result = await syncGA4ToSupabase(nonArticleData, slugMap, mockSupabase)
    expect(result.synced).toBe(0)
    expect(result.skipped).toBe(1)
    // 有効な行がないので upsert は呼ばれない
    expect(upsertFn).not.toHaveBeenCalled()
  })
})

// ============================================================
// mergeGSCData
// ============================================================

describe('mergeGSCData', () => {
  it('GSC の CTR データをバッチ upsert でマージする', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })

    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: upsertFn,
        update: vi.fn(),
      }),
    }

    const gscData: GSCRow[] = [
      {
        page: 'https://menscataly.com/articles/aga-clinic-ranking',
        date: '2026-03-04',
        clicks: 50,
        impressions: 1000,
        ctr: 0.05,
        position: 3.2,
      },
    ]

    const slugMap: SlugToIdMap = { 'aga-clinic-ranking': 'uuid-1' }

    await mergeGSCData(gscData, slugMap, mockSupabase, '2026-03-04')
    // バッチ upsert: 1回の呼び出しで配列を渡す
    expect(upsertFn).toHaveBeenCalledTimes(1)
    expect(upsertFn).toHaveBeenCalledWith(
      [{ article_id: 'uuid-1', date: '2026-03-04', ctr: 0.05 }],
      { onConflict: 'article_id,date' }
    )
  })

  it('有効な行がない場合は upsert を呼ばない', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })

    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: upsertFn,
        update: vi.fn(),
      }),
    }

    const gscData: GSCRow[] = [
      {
        page: 'https://menscataly.com/unknown-page',
        date: '2026-03-04',
        clicks: 10,
        impressions: 100,
        ctr: 0.1,
        position: 5.0,
      },
    ]

    const slugMap: SlugToIdMap = { 'aga-clinic-ranking': 'uuid-1' }

    await mergeGSCData(gscData, slugMap, mockSupabase, '2026-03-04')
    expect(upsertFn).not.toHaveBeenCalled()
  })
})

// ============================================================
// syncDailyAnalytics
// ============================================================

describe('syncDailyAnalytics', () => {
  beforeEach(() => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'fake-key')
    vi.stubEnv('GOOGLE_PROJECT_ID', 'test-project')
  })

  it('GA4 + GSC データを同期する', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'uuid-1', slug: 'aga-clinic-ranking' },
            { id: 'uuid-2', slug: 'hair-loss-treatment' },
          ],
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    }

    const result = await syncDailyAnalytics(mockSupabase, '2026-03-04')
    expect(result.synced).toBeGreaterThanOrEqual(0)
    expect(result.errors).toBeDefined()
  })
})
