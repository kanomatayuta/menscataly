/**
 * Supabase 型安全クエリラッパーテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockSupabaseQuery, createMockAnalyticsDailyUpsert } from '@/test/helpers'
import { upsertAnalyticsDaily, getAnalyticsDaily, getAffiliateLinksByArticle } from '../queries'

function createMockSupabaseClient(mockQuery: ReturnType<typeof createMockSupabaseQuery>) {
  return { from: vi.fn().mockReturnValue(mockQuery) } as any
}

describe('upsertAnalyticsDaily', () => {
  it('正常にupsertしてデータを返す', async () => {
    const mockRow = createMockAnalyticsDailyUpsert()
    const mockQuery = createMockSupabaseQuery([mockRow])
    const supabase = createMockSupabaseClient(mockQuery)

    const result = await upsertAnalyticsDaily(supabase, {
      article_id: 'article-001',
      date: '2026-03-05',
      pageviews: 500,
      unique_users: 350,
      avg_time: 120,
      bounce_rate: 0.45,
      ctr: 0.03,
      conversions: 2,
    })

    expect(result).toEqual(mockRow)
    expect(supabase.from).toHaveBeenCalledWith('analytics_daily')
    expect(mockQuery.upsert).toHaveBeenCalled()
  })

  it('エラー時にthrowする', async () => {
    const mockQuery = createMockSupabaseQuery([])
    mockQuery.single = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'duplicate key', code: '23505' },
    })
    const supabase = createMockSupabaseClient(mockQuery)

    await expect(
      upsertAnalyticsDaily(supabase, {
        article_id: 'article-001',
        date: '2026-03-05',
      })
    ).rejects.toEqual({ message: 'duplicate key', code: '23505' })
  })
})

describe('getAnalyticsDaily', () => {
  let mockQuery: ReturnType<typeof createMockSupabaseQuery>

  beforeEach(() => {
    mockQuery = createMockSupabaseQuery([
      createMockAnalyticsDailyUpsert({ date: '2026-03-05' }),
      createMockAnalyticsDailyUpsert({ id: 'analytics-002', date: '2026-03-04' }),
    ])
  })

  it('全件取得できる', async () => {
    const supabase = createMockSupabaseClient(mockQuery)
    const result = await getAnalyticsDaily(supabase, {})

    expect(result).toHaveLength(2)
    expect(supabase.from).toHaveBeenCalledWith('analytics_daily')
    expect(mockQuery.select).toHaveBeenCalledWith('*')
    expect(mockQuery.order).toHaveBeenCalledWith('date', { ascending: false })
  })

  it('articleIdでフィルタできる', async () => {
    const supabase = createMockSupabaseClient(mockQuery)
    await getAnalyticsDaily(supabase, { articleId: 'article-001' })

    expect(mockQuery.eq).toHaveBeenCalledWith('article_id', 'article-001')
  })

  it('sinceでフィルタできる', async () => {
    const supabase = createMockSupabaseClient(mockQuery)
    await getAnalyticsDaily(supabase, { since: '2026-03-01' })

    expect(mockQuery.gte).toHaveBeenCalledWith('date', '2026-03-01')
  })

  it('untilでフィルタできる', async () => {
    const supabase = createMockSupabaseClient(mockQuery)
    await getAnalyticsDaily(supabase, { until: '2026-03-05' })

    expect(mockQuery.lte).toHaveBeenCalledWith('date', '2026-03-05')
  })

  it('エラー時にthrowする', async () => {
    const errorQuery = createMockSupabaseQuery([])
    // Override the then to simulate error
    errorQuery.then = vi.fn().mockImplementation((resolve: (value: any) => void) => {
      return Promise.resolve({
        data: null,
        error: { message: 'connection error', code: 'PGRST000' },
      }).then(resolve)
    })
    const supabase = createMockSupabaseClient(errorQuery)

    await expect(getAnalyticsDaily(supabase, {})).rejects.toEqual({
      message: 'connection error',
      code: 'PGRST000',
    })
  })
})

describe('getAffiliateLinksByArticle', () => {
  it('記事IDに紐づくリンクを取得できる', async () => {
    const mockLinks = [
      {
        id: 'link-001',
        article_id: 'article-001',
        asp_name: 'a8',
        program_name: 'AGAクリニック',
        url: 'https://example.com',
        click_count: 50,
        conversion_count: 2,
        revenue: 30000,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-05T00:00:00Z',
      },
    ]
    const mockQuery = createMockSupabaseQuery(mockLinks)
    const supabase = createMockSupabaseClient(mockQuery)

    const result = await getAffiliateLinksByArticle(supabase, 'article-001')

    expect(result).toHaveLength(1)
    expect(result[0].asp_name).toBe('a8')
    expect(supabase.from).toHaveBeenCalledWith('affiliate_links')
    expect(mockQuery.eq).toHaveBeenCalledWith('article_id', 'article-001')
    expect(mockQuery.order).toHaveBeenCalledWith('click_count', { ascending: false })
  })
})
