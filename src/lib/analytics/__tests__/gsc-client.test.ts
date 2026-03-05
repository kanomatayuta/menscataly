/**
 * GSC クライアント ユニットテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { extractSlugFromGSCPage } from '../gsc-client'

// ============================================================
// extractSlugFromGSCPage
// ============================================================

describe('extractSlugFromGSCPage', () => {
  it('完全URL から slug を抽出する', () => {
    expect(
      extractSlugFromGSCPage('https://menscataly.com/articles/aga-clinic-ranking')
    ).toBe('aga-clinic-ranking')
  })

  it('末尾スラッシュ付きでも slug を抽出する', () => {
    expect(
      extractSlugFromGSCPage('https://menscataly.com/articles/aga-clinic-ranking/')
    ).toBe('aga-clinic-ranking')
  })

  it('/articles/ を含まないURLは null を返す', () => {
    expect(extractSlugFromGSCPage('https://menscataly.com/about')).toBeNull()
  })

  it('クエリパラメータ付きURLからも slug を抽出する', () => {
    expect(
      extractSlugFromGSCPage(
        'https://menscataly.com/articles/hair-loss-treatment?utm_source=google'
      )
    ).toBe('hair-loss-treatment')
  })
})

// ============================================================
// fetchGSCData
// ============================================================

describe('fetchGSCData', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('環境変数未設定時は空配列を返す', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '')
    vi.stubEnv('GSC_SITE_URL', '')

    const { fetchGSCData } = await import('../gsc-client')
    const data = await fetchGSCData('2026-03-04')
    expect(data).toEqual([])
  })
})
