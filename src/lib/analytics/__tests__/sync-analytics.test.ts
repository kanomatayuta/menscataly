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

  it('全行を正常に upsert する', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn(),
      }),
    }

    const result = await syncGA4ToSupabase(ga4Data, slugMap, mockSupabase)
    expect(result.synced).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('slug が見つからない行はスキップする', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
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
  })

  it('upsert エラー時はスキップしてエラーログに記録する', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        update: vi.fn(),
      }),
    }

    const result = await syncGA4ToSupabase(ga4Data, slugMap, mockSupabase)
    expect(result.synced).toBe(0)
    expect(result.skipped).toBe(2)
    expect(result.errors).toHaveLength(2)
    expect(result.errors[0]).toContain('DB error')
  })

  it('/articles/ 以外のパスはスキップする', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
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
  })
})

// ============================================================
// mergeGSCData
// ============================================================

describe('mergeGSCData', () => {
  it('GSC の CTR データをマージする', async () => {
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    const mockSupabase = {
      from: () => ({
        select: vi.fn(),
        upsert: vi.fn(),
        update: updateFn,
      }),
    }

    const gscData: GSCRow[] = [
      {
        page: 'https://menscataly.com/articles/aga-clinic-ranking',
        clicks: 50,
        impressions: 1000,
        ctr: 0.05,
        position: 3.2,
      },
    ]

    const slugMap: SlugToIdMap = { 'aga-clinic-ranking': 'uuid-1' }

    await mergeGSCData(gscData, slugMap, mockSupabase, '2026-03-04')
    expect(updateFn).toHaveBeenCalledWith({ ctr: 0.05 })
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
