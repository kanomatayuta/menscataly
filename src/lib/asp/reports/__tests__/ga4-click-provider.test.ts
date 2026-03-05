import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GA4ClickProvider, extractSlugFromPath, formatGA4Date } from '../ga4-click-provider'

describe('GA4ClickProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('認証情報未設定で isAvailable() = false', async () => {
    delete process.env.GA4_PROPERTY_ID
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
    const provider = new GA4ClickProvider()
    expect(await provider.isAvailable()).toBe(false)
  })

  it('認証情報設定済みで isAvailable() = true', async () => {
    process.env.GA4_PROPERTY_ID = '123456'
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/creds.json'
    const provider = new GA4ClickProvider()
    expect(await provider.isAvailable()).toBe(true)
  })

  it('isAvailable=false の場合 fetchReport は空配列を返す', async () => {
    delete process.env.GA4_PROPERTY_ID
    const provider = new GA4ClickProvider()
    const result = await provider.fetchReport({
      startDate: '2026-03-01',
      endDate: '2026-03-01',
    })
    expect(result).toEqual([])
  })

  it('extractSlugFromPath: /articles/{slug} → slug 正確抽出', () => {
    expect(extractSlugFromPath('/articles/aga-treatment-guide')).toBe('aga-treatment-guide')
    expect(extractSlugFromPath('/articles/ed-online-clinic?utm=test')).toBe('ed-online-clinic')
    expect(extractSlugFromPath('/articles/skincare-101#section')).toBe('skincare-101')
    expect(extractSlugFromPath('/about')).toBeUndefined()
    expect(extractSlugFromPath('/')).toBeUndefined()
  })

  it('formatGA4Date: YYYYMMDD → YYYY-MM-DD 変換', () => {
    expect(formatGA4Date('20260305')).toBe('2026-03-05')
    expect(formatGA4Date('20251231')).toBe('2025-12-31')
  })
})
