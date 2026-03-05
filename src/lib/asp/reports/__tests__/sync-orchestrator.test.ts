import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReportSyncOrchestrator } from '../sync-orchestrator'
import type { IASPReportProvider, NormalizedReportRecord } from '../types'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}))

function createMockProvider(
  overrides: Partial<IASPReportProvider> & { aspName: string }
): IASPReportProvider {
  return {
    validateCredentials: vi.fn().mockResolvedValue(true),
    fetchReport: vi.fn().mockResolvedValue([]),
    isAvailable: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

function createMockRecord(overrides: Partial<NormalizedReportRecord> = {}): NormalizedReportRecord {
  return {
    date: '2026-03-01',
    aspName: 'a8',
    programId: 'test-prog',
    programName: 'Test Program',
    impressions: 100,
    clicks: 10,
    conversionsPending: 2,
    conversionsConfirmed: 1,
    conversionsCancelled: 0,
    revenuePending: 2000,
    revenueConfirmed: 1000,
    revenueCancelled: 0,
    ...overrides,
  }
}

describe('ReportSyncOrchestrator', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    // Supabase未設定にしてDB操作をスキップ
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('複数プロバイダーを順次実行', async () => {
    const provider1 = createMockProvider({
      aspName: 'a8',
      fetchReport: vi.fn().mockResolvedValue([createMockRecord()]),
    })
    const provider2 = createMockProvider({
      aspName: 'ga4',
      fetchReport: vi.fn().mockResolvedValue([createMockRecord({ aspName: 'ga4' })]),
    })

    const orchestrator = new ReportSyncOrchestrator([provider1, provider2])
    const result = await orchestrator.syncDaily('2026-03-01')

    expect(result.date).toBe('2026-03-01')
    expect(result.providers).toHaveLength(2)
    expect(provider1.fetchReport).toHaveBeenCalledOnce()
    expect(provider2.fetchReport).toHaveBeenCalledOnce()
  })

  it('1プロバイダー失敗でも他は継続', async () => {
    const failingProvider = createMockProvider({
      aspName: 'a8',
      fetchReport: vi.fn().mockRejectedValue(new Error('API error')),
    })
    const successProvider = createMockProvider({
      aspName: 'ga4',
      fetchReport: vi.fn().mockResolvedValue([createMockRecord({ aspName: 'ga4' })]),
    })

    const orchestrator = new ReportSyncOrchestrator([failingProvider, successProvider])
    const result = await orchestrator.syncDaily('2026-03-01')

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].aspName).toBe('a8')
    expect(result.errors[0].error).toBe('API error')

    // 2番目のプロバイダーは成功
    const successResult = result.providers.find((p) => p.aspName === 'ga4')
    expect(successResult?.status).toBe('success')
  })

  it('isAvailable=false のプロバイダーはスキップ', async () => {
    const unavailableProvider = createMockProvider({
      aspName: 'a8',
      isAvailable: vi.fn().mockResolvedValue(false),
    })

    const orchestrator = new ReportSyncOrchestrator([unavailableProvider])
    const result = await orchestrator.syncDaily('2026-03-01')

    expect(result.providers[0].status).toBe('skipped')
    expect(result.providers[0].reason).toBe('Provider not available')
    expect(unavailableProvider.fetchReport).not.toHaveBeenCalled()
  })

  it('Supabase未設定時はレコード数0を返す', async () => {
    const provider = createMockProvider({
      aspName: 'a8',
      fetchReport: vi.fn().mockResolvedValue([createMockRecord()]),
    })

    const orchestrator = new ReportSyncOrchestrator([provider])
    const result = await orchestrator.syncDaily('2026-03-01')

    // Supabase未設定なのでupsert=0
    expect(result.providers[0].status).toBe('success')
    expect(result.providers[0].recordCount).toBe(0)
  })

  it('日付省略時は昨日の日付を使用', async () => {
    const provider = createMockProvider({ aspName: 'a8' })
    const orchestrator = new ReportSyncOrchestrator([provider])
    const result = await orchestrator.syncDaily()

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const expectedDate = yesterday.toISOString().slice(0, 10)

    expect(result.date).toBe(expectedDate)
  })

  it('プロバイダーなしで空のSyncResultを返す', async () => {
    const orchestrator = new ReportSyncOrchestrator([])
    const result = await orchestrator.syncDaily('2026-03-01')

    expect(result.date).toBe('2026-03-01')
    expect(result.providers).toHaveLength(0)
    expect(result.totalRecords).toBe(0)
    expect(result.errors).toHaveLength(0)
  })
})
