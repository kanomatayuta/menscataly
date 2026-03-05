/**
 * BigQuery クライアント ユニットテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  createBigQueryClient,
  queryArticleMetrics,
  queryAffiliateClicks,
} from '../bigquery-client'

describe('createBigQueryClient', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('環境変数未設定時は null を返す', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '')
    vi.stubEnv('GOOGLE_PROJECT_ID', '')

    const client = await createBigQueryClient()
    expect(client).toBeNull()
  })

  it('SDK未インストール時は null を返す (環境変数設定済みでも)', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'fake-key')
    vi.stubEnv('GOOGLE_PROJECT_ID', 'test-project')

    // SDK not installed → returns null
    const client = await createBigQueryClient()
    expect(client).toBeNull()
  })
})

describe('queryArticleMetrics', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('BQ_DATASET_ID 未設定時は空配列を返す', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', 'test@test.iam.gserviceaccount.com')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'fake-key')
    vi.stubEnv('GOOGLE_PROJECT_ID', 'test-project')
    vi.stubEnv('BQ_DATASET_ID', '')

    const data = await queryArticleMetrics({
      startDate: '2026-03-01',
      endDate: '2026-03-04',
    })

    expect(data).toEqual([])
  })

  it('全環境変数未設定時は空配列を返す', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '')
    vi.stubEnv('BQ_DATASET_ID', '')

    const data = await queryArticleMetrics({
      startDate: '2026-03-01',
      endDate: '2026-03-04',
    })

    expect(data).toEqual([])
  })
})

describe('queryAffiliateClicks', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('環境変数未設定時は空配列を返す', async () => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', '')
    vi.stubEnv('GOOGLE_PRIVATE_KEY', '')
    vi.stubEnv('GOOGLE_PROJECT_ID', '')
    vi.stubEnv('BQ_DATASET_ID', '')

    const data = await queryAffiliateClicks({
      startDate: '2026-03-01',
      endDate: '2026-03-04',
    })

    expect(data).toEqual([])
  })
})
