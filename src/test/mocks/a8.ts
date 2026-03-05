/**
 * A8.net API レスポンスモック
 * A8.net にはパブリック API がないため、CSV取込を想定
 */

export interface A8RevenueRecord {
  date: string
  programId: string
  programName: string
  clicks: number
  conversions: number
  confirmedConversions: number
  revenue: number
  status: 'pending' | 'confirmed' | 'rejected'
}

/**
 * A8.net 収益レコードモックファクトリ
 */
export function createMockA8RevenueRecord(
  overrides?: Partial<A8RevenueRecord>
): A8RevenueRecord {
  return {
    date: '2026-03-05',
    programId: 'a8-aga-clinic-001',
    programName: 'AGAクリニック 新規来院',
    clicks: 150,
    conversions: 3,
    confirmedConversions: 2,
    revenue: 30000,
    status: 'confirmed',
    ...overrides,
  }
}

/**
 * A8.net 月次レポートモック
 */
export function createMockA8MonthlyReport(records?: A8RevenueRecord[]) {
  const data = records ?? [
    createMockA8RevenueRecord(),
    createMockA8RevenueRecord({
      programId: 'a8-datsumo-001',
      programName: 'メンズ脱毛 無料カウンセリング',
      clicks: 80,
      conversions: 2,
      confirmedConversions: 1,
      revenue: 15000,
    }),
  ]

  return {
    period: { start: '2026-03-01', end: '2026-03-31' },
    records: data,
    totalClicks: data.reduce((sum, r) => sum + r.clicks, 0),
    totalConversions: data.reduce((sum, r) => sum + r.conversions, 0),
    totalRevenue: data.reduce((sum, r) => sum + r.revenue, 0),
  }
}
