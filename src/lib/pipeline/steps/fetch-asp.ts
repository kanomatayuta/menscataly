/**
 * ASP収益データ取得ステップ
 * afb, A8, アクセストレード等のASP APIから収益データを取得する
 * モック実装 + インターフェース定義
 */

import type { AspRevenueData, PipelineContext, PipelineStep } from '../types'

// ============================================================
// ASP クライアントインターフェース
// ============================================================

export type AspName = 'afb' | 'a8' | 'accesstrade' | 'valuecommerce' | 'felmat'

export interface AspApiConfig {
  name: AspName
  apiKey: string
  apiSecret?: string
  baseUrl: string
}

export interface AspRawReportRow {
  programId: string
  programName: string
  clicks: number
  conversions: number
  revenue: number
  date: string  // YYYY-MM-DD
}

export interface AspClient {
  /**
   * 収益レポートを取得する
   * @param startDate 開始日 (YYYY-MM-DD)
   * @param endDate 終了日 (YYYY-MM-DD)
   */
  getReport(startDate: string, endDate: string): Promise<AspRawReportRow[]>
}

// ============================================================
// ASP固有のAPI設定
// ============================================================

/**
 * 対応ASP一覧
 * 環境変数が設定されているASPのみ実行する
 */
const ASP_CONFIGS: Record<AspName, { envKey: string; baseUrl: string }> = {
  afb: {
    envKey: 'AFB_API_KEY',
    baseUrl: 'https://api.afb.ne.jp/v1',
  },
  a8: {
    envKey: 'A8_API_KEY',
    baseUrl: 'https://api.a8.net/as/api',
  },
  accesstrade: {
    envKey: 'ACCESSTRADE_API_KEY',
    baseUrl: 'https://api.accesstrade.net/v1',
  },
  valuecommerce: {
    envKey: 'VALUECOMMERCE_API_KEY',
    baseUrl: 'https://developer.valuecommerce.ne.jp/api/v2',
  },
  felmat: {
    envKey: 'FELMAT_API_KEY',
    baseUrl: 'https://www.felmat.net/api',
  },
}

// ============================================================
// モック実装
// ============================================================

/**
 * モックのASP収益データを生成する
 * ASPセレクターからプログラム情報を取得して、より正確なモックデータを生成する
 */
async function generateMockAspData(): Promise<AspRevenueData[]> {
  const today = new Date().toISOString().split('T')[0]

  try {
    // ASPセレクターからプログラム情報を取得して精度の高いモックデータを生成
    const { getPrograms } = await import('@/lib/asp/config')
    const programs = getPrograms()

    if (programs.length > 0) {
      return programs.slice(0, 8).map((program) => ({
        aspName: program.aspName,
        programName: program.programName,
        clicks: Math.floor(Math.random() * 200) + 50,
        conversions: Math.floor(Math.random() * 5) + 1,
        revenue: program.rewardAmount * (Math.floor(Math.random() * 3) + 1),
        date: today,
      }))
    }
  } catch {
    // ASPセレクターが利用不可の場合はフォールバック
    console.warn('[fetch-asp] ASP selector unavailable, using hardcoded mock data')
  }

  // フォールバック: ハードコードされたモックデータ
  const mockData: AspRevenueData[] = [
    {
      aspName: 'afb',
      programName: 'AGAクリニック A',
      clicks: 145,
      conversions: 3,
      revenue: 45000,
      date: today,
    },
    {
      aspName: 'a8',
      programName: '医療脱毛クリニック B',
      clicks: 89,
      conversions: 2,
      revenue: 20000,
      date: today,
    },
    {
      aspName: 'accesstrade',
      programName: 'EDクリニック C',
      clicks: 67,
      conversions: 1,
      revenue: 15000,
      date: today,
    },
    {
      aspName: 'afb',
      programName: 'スキンケアブランド D',
      clicks: 201,
      conversions: 5,
      revenue: 12500,
      date: today,
    },
  ]

  return mockData
}

// ============================================================
// ASP API 呼び出し実装 (将来実装)
// ============================================================

/**
 * 特定のASPからデータを取得する
 * @param aspName ASP名
 * @param config API設定
 */
async function fetchFromAsp(
  aspName: AspName,
  config: { apiKey: string; baseUrl: string }
): Promise<AspRevenueData[]> {
  const endDate = new Date().toISOString().split('T')[0]
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]

  // 将来実装: 各ASPのAPI仕様に合わせてリクエストを構築する
  // afb: https://support.afb.ne.jp/hc/ja/articles/...
  // A8:  https://support.a8.net/hc/ja/articles/...
  const _url = `${config.baseUrl}/report?start=${startDate}&end=${endDate}`

  // 現在はモックを返す（将来的に実API呼び出しに置き換え）
  console.warn(`[fetch-asp] ${aspName} API not yet implemented, skipping`)
  return []
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * ASP収益データ取得ステップ
 */
export const fetchAspStep: PipelineStep<unknown, AspRevenueData[]> = {
  name: 'fetch-asp',
  description: 'ASP (afb/A8/アクセストレード等) から収益データを取得する',
  maxRetries: 2,

  async execute(_input: unknown, context: PipelineContext): Promise<AspRevenueData[]> {
    console.log(`[fetch-asp] Starting ASP data fetch (run: ${context.runId})`)

    const results: AspRevenueData[] = []
    let hasAnyConfig = false

    // 設定されているASPのみ実行
    for (const [aspName, aspConfig] of Object.entries(ASP_CONFIGS)) {
      const apiKey = process.env[aspConfig.envKey]
      if (!apiKey) {
        continue
      }

      hasAnyConfig = true
      console.log(`[fetch-asp] Fetching data from ${aspName}`)

      try {
        const data = await fetchFromAsp(aspName as AspName, {
          apiKey,
          baseUrl: aspConfig.baseUrl,
        })
        results.push(...data)
      } catch (err) {
        console.warn(`[fetch-asp] Failed to fetch from ${aspName}:`, err)
      }
    }

    if (!hasAnyConfig) {
      console.log('[fetch-asp] No ASP API keys configured — using mock data')
      const mockData = await generateMockAspData()
      results.push(...mockData)
    }

    console.log(`[fetch-asp] Fetched ${results.length} ASP revenue records`)

    // コンテキストの共有データに保存
    context.sharedData['aspRevenue'] = results

    // 総収益をサマリーとしてログ
    const totalRevenue = results.reduce((sum, r) => sum + r.revenue, 0)
    console.log(`[fetch-asp] Total revenue: ¥${totalRevenue.toLocaleString()}`)

    return results
  },
}
