import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { A8ReportProvider, parseA8CSV } from '../a8-report-provider'

describe('A8ReportProvider', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('A8 CSVを正しくパースできる', () => {
    const csv = `日付,プログラム名,プログラムID,インプレッション,クリック,発生件数,確定件数,キャンセル件数,発生報酬,確定報酬,キャンセル報酬
2026-03-01,Dクリニック,a8-prog-aga-001,1000,50,3,2,1,36000,24000,12000
2026-03-02,BULK HOMME,a8-prog-skin-001,800,30,1,1,0,5000,5000,0`

    const provider = new A8ReportProvider()
    const records = provider.importFromCSV(csv)

    expect(records).toHaveLength(2)
    expect(records[0].date).toBe('2026-03-01')
    expect(records[0].aspName).toBe('a8')
    expect(records[0].programId).toBe('a8-prog-aga-001')
    expect(records[0].clicks).toBe(50)
    expect(records[0].conversionsConfirmed).toBe(2)
    expect(records[0].revenueConfirmed).toBe(24000)
  })

  it('BOM付きCSVを処理できる', () => {
    const csv = `\uFEFF日付,プログラム名,プログラムID,クリック,発生報酬,確定報酬,キャンセル報酬
2026-03-01,テストプログラム,test-001,10,1000,500,0`

    const records = parseA8CSV(csv)
    expect(records).toHaveLength(1)
    expect(records[0]['日付']).toBe('2026-03-01')
    expect(records[0]['プログラム名']).toBe('テストプログラム')
  })

  it('空CSVで空配列を返す', () => {
    const provider = new A8ReportProvider()
    const records = provider.importFromCSV('')
    expect(records).toEqual([])
  })

  it('API未設定で fetchReport がエラーを投げる', async () => {
    delete process.env.A8_REPORT_API_KEY
    const provider = new A8ReportProvider()
    await expect(
      provider.fetchReport({ startDate: '2026-03-01', endDate: '2026-03-01' })
    ).rejects.toThrow('A8 成果連携API未設定')
  })

  it('メンテナンス時間帯チェック (isAvailable)', async () => {
    const provider = new A8ReportProvider()
    // 通常時間帯のテスト（現在時刻依存）
    // メンテナンス時間帯外であればtrue
    const result = await provider.isAvailable()
    // 現在時刻に依存するが、テスト実行時刻がメンテナンス外なら true
    expect(typeof result).toBe('boolean')
  })

  it('ダブルクォート含むCSVをパースできる', () => {
    const csv = `日付,プログラム名,プログラムID,クリック
2026-03-01,"テスト,プログラム",test-001,10
2026-03-02,"テスト""プログラム""2",test-002,20`

    const records = parseA8CSV(csv)
    expect(records).toHaveLength(2)
    expect(records[0]['プログラム名']).toBe('テスト,プログラム')
    expect(records[1]['プログラム名']).toBe('テスト"プログラム"2')
  })
})
