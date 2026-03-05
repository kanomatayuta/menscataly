/**
 * GA4 Data API モックファクトリ
 * テスト時に外部APIを呼ばず、モックデータで検証する
 */

/**
 * GA4 RunReportResponse 互換型
 */
interface GA4ReportRow {
  dimensionValues: Array<{ value: string }>
  metricValues: Array<{ value: string }>
}

interface GA4RunReportResponse {
  dimensionHeaders?: Array<{ name: string }>
  metricHeaders?: Array<{ name: string; type?: string }>
  rows?: GA4ReportRow[]
  rowCount?: number
  metadata?: { currencyCode?: string; timeZone?: string }
}

/**
 * GA4 Data API クライアントモックファクトリ
 */
export function createMockGA4Client() {
  const runReport = vi.fn<[], Promise<[GA4RunReportResponse]>>()
  const batchRunReports = vi.fn()

  return {
    client: {
      runReport,
      batchRunReports,
      close: vi.fn(),
    },
    mockRunReportResponse(data: GA4RunReportResponse) {
      runReport.mockResolvedValue([data])
    },
    mockRunReportError(error: Error) {
      runReport.mockRejectedValue(error)
    },
  }
}

/**
 * GA4レポート行モックファクトリ
 */
export function createMockGA4ReportRow(overrides?: {
  pagePath?: string
  pageviews?: number
  sessions?: number
  avgSessionDuration?: number
  bounceRate?: number
}): GA4ReportRow {
  const {
    pagePath = '/articles/aga-treatment',
    pageviews = 1500,
    sessions = 1200,
    avgSessionDuration = 180.5,
    bounceRate = 0.45,
  } = overrides ?? {}

  return {
    dimensionValues: [{ value: pagePath }],
    metricValues: [
      { value: String(pageviews) },
      { value: String(sessions) },
      { value: String(avgSessionDuration) },
      { value: String(bounceRate) },
    ],
  }
}

/**
 * GA4 RunReportResponse モック (完全形)
 */
export function createMockGA4Response(
  rows: GA4ReportRow[],
  overrides?: Partial<GA4RunReportResponse>
): GA4RunReportResponse {
  return {
    dimensionHeaders: [{ name: 'pagePath' }],
    metricHeaders: [
      { name: 'screenPageViews', type: 'TYPE_INTEGER' },
      { name: 'sessions', type: 'TYPE_INTEGER' },
      { name: 'averageSessionDuration', type: 'TYPE_SECONDS' },
      { name: 'bounceRate', type: 'TYPE_FLOAT' },
    ],
    rows,
    rowCount: rows.length,
    metadata: { currencyCode: 'JPY', timeZone: 'Asia/Tokyo' },
    ...overrides,
  }
}

// ============================================================
// アフィリエイトクリック用モック
// ============================================================

/**
 * アフィリエイトクリック行の入力型
 */
interface AffiliateClickRowInput {
  pagePath?: string
  date?: string
  aspName?: string
  programId?: string
  eventCount?: number
}

/**
 * GA4 アフィリエイトクリックレポートレスポンス モックファクトリ
 * fetchAffiliateClicks が内部で使う GA4 RunReport レスポンスを生成する
 *
 * dimensions: pagePath, date, customEvent:asp_name, customEvent:program_id
 * metrics: eventCount
 *
 * @param rows - カスタム行データ (省略時はデフォルト2件のクリックデータ)
 */
export function createMockAffiliateClickResponse(
  rows?: AffiliateClickRowInput[]
): GA4RunReportResponse {
  const defaultRows: AffiliateClickRowInput[] = [
    {
      pagePath: '/articles/aga-clinic-ranking',
      date: '20260305',
      aspName: 'a8',
      programId: 'a8-aga-001',
      eventCount: 12,
    },
    {
      pagePath: '/articles/hair-loss-treatment',
      date: '20260305',
      aspName: 'afb',
      programId: 'afb-aga-002',
      eventCount: 5,
    },
  ]

  const resolvedRows = rows ?? defaultRows

  return {
    dimensionHeaders: [
      { name: 'pagePath' },
      { name: 'date' },
      { name: 'customEvent:asp_name' },
      { name: 'customEvent:program_id' },
    ],
    metricHeaders: [
      { name: 'eventCount', type: 'TYPE_INTEGER' },
    ],
    rows: resolvedRows.map((row) => ({
      dimensionValues: [
        { value: row.pagePath ?? '/articles/aga-clinic-ranking' },
        { value: row.date ?? '20260305' },
        { value: row.aspName ?? 'a8' },
        { value: row.programId ?? 'a8-aga-001' },
      ],
      metricValues: [
        { value: String(row.eventCount ?? 1) },
      ],
    })),
    rowCount: resolvedRows.length,
    metadata: { currencyCode: 'JPY', timeZone: 'Asia/Tokyo' },
  }
}
