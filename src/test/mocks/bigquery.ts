/**
 * BigQuery クライアントモックファクトリ
 * テスト時に外部APIを呼ばず、モックデータで検証する
 */

/**
 * BigQuery クライアントモックファクトリ
 */
export function createMockBigQueryClient() {
  const query = vi.fn()
  const createQueryJob = vi.fn()

  return {
    client: {
      query,
      createQueryJob,
      dataset: vi.fn().mockReturnValue({
        table: vi.fn().mockReturnValue({
          getRows: vi.fn().mockResolvedValue([[]]),
        }),
      }),
    },
    mockQueryResult(rows: Record<string, unknown>[]) {
      query.mockResolvedValue([rows])
    },
    mockQueryError(error: Error) {
      query.mockRejectedValue(error)
    },
  }
}

/**
 * BigQuery GA4イベントデータ行モック
 */
export function createMockBQEventRow(overrides?: {
  event_date?: string
  event_name?: string
  page_path?: string
  event_count?: number
}) {
  return {
    event_date: '20260305',
    event_name: 'page_view',
    page_path: '/articles/aga-treatment',
    event_count: 150,
    ...overrides,
  }
}

/**
 * BigQuery アフィリエイトクリックイベント行モック
 */
export function createMockBQClickRow(overrides?: {
  event_date?: string
  asp_name?: string
  program_id?: string
  click_count?: number
  page_path?: string
}) {
  return {
    event_date: '20260305',
    asp_name: 'a8',
    program_id: 'a8-aga-001',
    click_count: 25,
    page_path: '/articles/aga-treatment',
    ...overrides,
  }
}

/**
 * BigQuery 記事メトリクス行モック (queryArticleMetrics の戻り値形式)
 */
export function createMockBQArticleMetricsRow(overrides?: {
  date?: string
  slug?: string
  pageviews?: number
  unique_users?: number
  avg_engagement_sec?: number
}) {
  return {
    date: '2026-03-05',
    slug: 'aga-treatment',
    pageviews: 150,
    unique_users: 120,
    avg_engagement_sec: 90.5,
    ...overrides,
  }
}
