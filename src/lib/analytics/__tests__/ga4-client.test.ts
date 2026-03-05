/**
 * GA4 クライアント ユニットテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  extractSlugFromPath,
  buildSlugMap,
  fetchGA4DailyMetrics,
  createGA4Client,
} from '../ga4-client'

// ============================================================
// extractSlugFromPath
// ============================================================

describe('extractSlugFromPath', () => {
  it('/articles/slug → slug を抽出する', () => {
    expect(extractSlugFromPath('/articles/aga-clinic-ranking')).toBe(
      'aga-clinic-ranking'
    )
  })

  it('末尾スラッシュを無視する', () => {
    expect(extractSlugFromPath('/articles/aga-clinic-ranking/')).toBe(
      'aga-clinic-ranking'
    )
  })

  it('クエリパラメータを無視する', () => {
    expect(extractSlugFromPath('/articles/aga-clinic-ranking?ref=top')).toBe(
      'aga-clinic-ranking'
    )
  })

  it('ハッシュフラグメントを無視する', () => {
    expect(extractSlugFromPath('/articles/aga-clinic-ranking#section')).toBe(
      'aga-clinic-ranking'
    )
  })

  it('/articles/ 以外のパスは null を返す', () => {
    expect(extractSlugFromPath('/about')).toBeNull()
    expect(extractSlugFromPath('/')).toBeNull()
    expect(extractSlugFromPath('/search?q=aga')).toBeNull()
  })
})

// ============================================================
// buildSlugMap
// ============================================================

describe('buildSlugMap', () => {
  it('Supabase データから slug → id マップを構築する', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn().mockResolvedValue({
          data: [
            { id: 'uuid-1', slug: 'aga-clinic-ranking' },
            { id: 'uuid-2', slug: 'hair-loss-treatment' },
          ],
        }),
      }),
    }

    const map = await buildSlugMap(mockSupabase)
    expect(map['aga-clinic-ranking']).toBe('uuid-1')
    expect(map['hair-loss-treatment']).toBe('uuid-2')
  })

  it('データが空の場合は空マップを返す', async () => {
    const mockSupabase = {
      from: () => ({
        select: vi.fn().mockResolvedValue({ data: null }),
      }),
    }

    const map = await buildSlugMap(mockSupabase)
    expect(Object.keys(map)).toHaveLength(0)
  })
})

// ============================================================
// createGA4Client
// ============================================================

describe('createGA4Client', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('環境変数未設定時は null を返す', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '')
    vi.stubEnv('GOOGLE_PROJECT_ID', '')

    const client = await createGA4Client()
    expect(client).toBeNull()
  })

  it('SDK未インストール時は null を返す (環境変数設定済みでも)', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'fake-key')
    vi.stubEnv('GOOGLE_PROJECT_ID', 'test-project')

    // SDK未インストールなのでnullが返る
    const client = await createGA4Client()
    expect(client).toBeNull()
  })
})

// ============================================================
// fetchGA4DailyMetrics
// ============================================================

describe('fetchGA4DailyMetrics', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('GA4_PROPERTY_ID 未設定時は空配列を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '')

    const data = await fetchGA4DailyMetrics()
    expect(data).toEqual([])
  })

  it('不正な秘密鍵の場合は空配列を返す', async () => {
    vi.stubEnv('GA4_PROPERTY_ID', '123456')
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'fake-key')
    vi.stubEnv('GOOGLE_PROJECT_ID', 'test-project')

    // Invalid key → JWT sign fails → caught → empty array
    const data = await fetchGA4DailyMetrics('yesterday')
    expect(data).toEqual([])
  })
})
