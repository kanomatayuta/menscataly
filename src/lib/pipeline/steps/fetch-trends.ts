/**
 * トレンドデータ取得ステップ
 * Google Trends 風のキーワードトレンドを取得する
 * モック実装 + 将来の pytrends 連携インターフェース定義
 */

import type { PipelineContext, PipelineStep, TrendData } from '../types'

// ============================================================
// pytrends 連携インターフェース (将来実装用)
// ============================================================

export interface PytrendsClient {
  /**
   * キーワードのトレンドスコアを取得する
   * @param keywords 検索キーワードのリスト (最大5件)
   * @param geo 地域コード (e.g. 'JP')
   * @param timeframe 期間 (e.g. 'today 3-m')
   */
  getInterestOverTime(
    keywords: string[],
    geo: string,
    timeframe: string
  ): Promise<Array<{ keyword: string; value: number; date: string }>>

  /**
   * 関連キーワードを取得する
   * @param keyword 基準キーワード
   */
  getRelatedQueries(
    keyword: string
  ): Promise<Array<{ query: string; value: number }>>
}

// ============================================================
// 対象キーワード定義
// ============================================================

/**
 * カテゴリ別のトラッキングキーワード
 * 将来的には Supabase の keywords テーブルから動的に取得する
 */
const TRACKING_KEYWORDS: Record<string, string[]> = {
  aga: [
    'AGA治療',
    'ミノキシジル',
    '発毛',
    '育毛剤',
    'フィナステリド',
  ],
  'hair-removal': [
    '医療脱毛',
    'ヒゲ脱毛',
    '永久脱毛',
    'レーザー脱毛',
  ],
  skincare: [
    'メンズスキンケア',
    'ニキビ治療',
    'メンズ美容',
    '美白',
  ],
  ed: [
    'ED治療',
    '勃起不全',
    'シアリス',
    'バイアグラ',
  ],
}

// ============================================================
// モック実装
// ============================================================

/**
 * モックトレンドデータを生成する
 * 将来的には実際の Google Trends API / pytrends に置き換える
 */
function generateMockTrendData(): TrendData[] {
  const trends: TrendData[] = []
  const now = new Date().toISOString()

  for (const [category, keywords] of Object.entries(TRACKING_KEYWORDS)) {
    for (const keyword of keywords) {
      trends.push({
        keyword,
        // 40-100 の範囲でランダムなトレンドスコアを生成
        relativeValue: Math.floor(Math.random() * 60) + 40,
        category,
        fetchedAt: now,
      })
    }
  }

  return trends
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * トレンドデータ取得ステップ
 */
export const fetchTrendsStep: PipelineStep<unknown, TrendData[]> = {
  name: 'fetch-trends',
  description: 'Google Trendsからキーワードトレンドデータを取得する',
  maxRetries: 3,

  async execute(_input: unknown, context: PipelineContext): Promise<TrendData[]> {
    console.log(`[fetch-trends] Starting trend data fetch (run: ${context.runId})`)

    // 将来の pytrends 連携フラグ
    const usePytrends = process.env.PYTRENDS_SERVICE_URL !== undefined

    let trends: TrendData[]

    if (usePytrends) {
      // 将来実装: Python microservice (Cloud Run) 経由で pytrends を呼び出す
      trends = await fetchFromPytrendsService()
    } else {
      // モック実装
      console.log('[fetch-trends] Using mock data (PYTRENDS_SERVICE_URL not set)')
      trends = generateMockTrendData()
    }

    // トレンドスコアで降順ソート
    trends.sort((a, b) => b.relativeValue - a.relativeValue)

    console.log(`[fetch-trends] Fetched ${trends.length} trend data points`)

    // コンテキストの共有データに保存
    context.sharedData['trends'] = trends

    return trends
  },
}

/**
 * pytrends マイクロサービス経由でトレンドデータを取得する
 * Cloud Run で Python/pytrends を実行するサービスを呼び出す
 * @internal 将来実装
 */
async function fetchFromPytrendsService(): Promise<TrendData[]> {
  const serviceUrl = process.env.PYTRENDS_SERVICE_URL
  if (!serviceUrl) {
    throw new Error('PYTRENDS_SERVICE_URL is not defined')
  }

  const allKeywords = Object.values(TRACKING_KEYWORDS).flat()

  const response = await fetch(`${serviceUrl}/trends`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keywords: allKeywords,
      geo: 'JP',
      timeframe: 'today 3-m',
    }),
  })

  if (!response.ok) {
    throw new Error(`pytrends service error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as { trends: TrendData[] }
  return data.trends
}
