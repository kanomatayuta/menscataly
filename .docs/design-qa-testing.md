# QA/品質設計書 — GA4/BigQuery/A8 API統合テスト戦略

**作成日**: 2026年3月5日
**担当**: QA Agent
**対象**: Analytics Dashboard (GA4 Data API / BigQuery / A8.net API)
**既存テスト基盤**: 1,258テスト全通過 (Vitest) + 12 E2Eスペック (Playwright)

---

## 1. テスト戦略

### 1.1 全体方針

新規 GA4/BigQuery/A8 API 統合は、全て外部サービスに依存する。
テスト時は **モックファーストアプローチ** を採用し、外部 API を一切呼ばない。

```
テストレベル構成:
  Unit (Vitest)          ← データフェッチ関数、集計ロジック、日付処理
  Integration (Vitest)   ← API Route → Supabase upsert → レスポンス
  E2E (Playwright)       ← /admin/articles UI 表示・操作
```

### 1.2 GA4 Data API モック戦略

**ライブラリ**: `@google-analytics/data` (BetaAnalyticsDataClient)

```typescript
// src/test/mocks/ga4.ts

import type { protos } from '@google-analytics/data'

type RunReportResponse = protos.google.analytics.data.v1beta.IRunReportResponse

/**
 * GA4 Data API クライアントモックファクトリ
 */
export function createMockGA4Client() {
  const runReport = vi.fn<[], Promise<[RunReportResponse]>>()
  const batchRunReports = vi.fn()

  return {
    client: {
      runReport,
      batchRunReports,
      close: vi.fn(),
    },
    // テストヘルパー
    mockRunReportResponse(data: RunReportResponse) {
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
}) {
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
  rows: ReturnType<typeof createMockGA4ReportRow>[],
  overrides?: Partial<RunReportResponse>
): RunReportResponse {
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
```

**モック注入パターン**:
```typescript
// テストファイル内
vi.mock('@google-analytics/data', () => ({
  BetaAnalyticsDataClient: vi.fn().mockImplementation(() => mockClient.client),
}))
```

### 1.3 BigQuery クエリ モック戦略

**ライブラリ**: `@google-cloud/bigquery` (BigQuery)

```typescript
// src/test/mocks/bigquery.ts

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
    // テストヘルパー
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
```

**モック注入パターン**:
```typescript
vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn().mockImplementation(() => mockBQ.client),
}))
```

### 1.4 A8.net API レスポンスモック

A8.net にはパブリック API がないため、スクレイピング or CSV 取込を想定。

```typescript
// src/test/mocks/a8.ts

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
```

### 1.5 Supabase Upsert テスト戦略

既存 `createMockSupabaseQuery` を拡張し、新テーブル (`analytics_daily`, `revenue_daily`) 用モックを追加。

```typescript
// src/test/helpers.ts への追加

/**
 * analytics_daily upsert テスト用モック
 */
export function createMockAnalyticsDailyUpsert(overrides?: Partial<AnalyticsDailyRow>) {
  return {
    id: 'analytics-001',
    article_id: 'article-001',
    date: '2026-03-05',
    pageviews: 500,
    unique_users: 350,
    avg_time: 120,
    bounce_rate: 0.45,
    ctr: 0.03,
    conversions: 2,
    created_at: '2026-03-05T06:00:00Z',
    ...overrides,
  }
}

/**
 * revenue_daily upsert テスト用モック (新テーブル)
 */
export function createMockRevenueDailyUpsert(overrides?: Record<string, unknown>) {
  return {
    id: 'rev-001',
    date: '2026-03-05',
    asp_name: 'a8',
    program_id: 'a8-aga-001',
    clicks: 50,
    conversions: 1,
    confirmed_conversions: 0,
    revenue_jpy: 15000,
    status: 'pending',
    imported_at: '2026-03-06T00:00:00Z',
    created_at: '2026-03-06T00:00:00Z',
    ...overrides,
  }
}
```

---

## 2. テストケース一覧

### 2.1 ユニットテスト

#### GA4 Data API (`src/lib/analytics/ga4-client.ts`)

| # | テストケース | 期待結果 |
|---|-------------|---------|
| U-GA4-01 | fetchPageviews: 正常レスポンス → PVデータ配列 | pagePath, pageviews, sessions が正しくパースされる |
| U-GA4-02 | fetchPageviews: 空レスポンス (rows: []) | 空配列を返す |
| U-GA4-03 | fetchPageviews: API エラー → throw | エラーが伝播する |
| U-GA4-04 | fetchPageviews: 日付範囲パラメータが正しく渡される | startDate/endDate が正しいフォーマット |
| U-GA4-05 | fetchAffiliateClicks: `affiliate_link_click` イベントのフィルタ | eventName フィルタが正しい |
| U-GA4-06 | fetchAffiliateClicks: data-asp 属性でグルーピング | asp_name ごとに集計 |
| U-GA4-07 | mapGA4ResponseToArticleStats: 次元値→記事PVマッピング | pagePath → articleId 変換正確 |
| U-GA4-08 | mapGA4ResponseToArticleStats: メトリクス null 値ハンドリング | null → 0 にフォールバック |

#### BigQuery 集計 (`src/lib/analytics/bigquery-client.ts`)

| # | テストケース | 期待結果 |
|---|-------------|---------|
| U-BQ-01 | queryDailyPageviews: SQLテンプレート正確性 | 日付パラメータがエスケープされる |
| U-BQ-02 | queryDailyPageviews: 正常結果パース | event_date → Date変換, event_count → number |
| U-BQ-03 | queryDailyPageviews: 空結果 | 空配列を返す |
| U-BQ-04 | queryAffiliateEvents: affiliate_link_click フィルタ | イベント名フィルタが正しい |
| U-BQ-05 | queryAffiliateEvents: asp_name パラメータ集計 | ASP別グルーピング |
| U-BQ-06 | queryLongTermTrend: 月次集計 | 月ごとのPV合計が正しい |
| U-BQ-07 | buildDateRangeQuery: 日付範囲バリデーション | 不正日付 → Error |

#### A8 収益データ処理 (`src/lib/analytics/a8-revenue.ts`)

| # | テストケース | 期待結果 |
|---|-------------|---------|
| U-A8-01 | parseA8CSV: 正常CSV → レコード配列 | 全フィールドが正しくパースされる |
| U-A8-02 | parseA8CSV: 空CSV | 空配列 |
| U-A8-03 | parseA8CSV: 不正フォーマット → Error | パースエラーが投げられる |
| U-A8-04 | parseA8CSV: 文字コード変換 (Shift_JIS → UTF-8) | 日本語文字が正しい |
| U-A8-05 | aggregateByProgram: プログラムID別集計 | clicks, conversions, revenue が正しい |
| U-A8-06 | aggregateByProgram: ステータスフィルタ (confirmed のみ) | pending を除外 |
| U-A8-07 | calculateMoM: 前月比計算 | 前月データ有→パーセント, 前月ゼロ→null |
| U-A8-08 | mergeWithSupabasePrograms: ASP IDマッチング | program_id で結合される |

#### 集計ロジック (`src/lib/analytics/aggregator.ts`)

| # | テストケース | 期待結果 |
|---|-------------|---------|
| U-AGG-01 | aggregateArticleMetrics: GA4 + Supabase マージ | PV(GA4) + clicks/CV/revenue(Supabase) が1レコードに |
| U-AGG-02 | aggregateArticleMetrics: GA4データなし → Supabaseのみ | GA4 PV = 0, Supabase データはそのまま |
| U-AGG-03 | aggregateArticleMetrics: Supabaseデータなし → GA4のみ | clicks/CV/revenue = 0, PV はGA4値 |
| U-AGG-04 | calculateTrend: 7日間トレンド計算 | 傾きが正しい |
| U-AGG-05 | calculateTrend: データ不足 (< 3日) | null を返す |
| U-AGG-06 | sortByMetric: 複合ソート (PV降順 → CV降順) | 正しい順序 |
| U-AGG-07 | filterByDateRange: 日付範囲フィルタ | 範囲外データが除外される |
| U-AGG-08 | formatCurrency: JPY フォーマット | "¥15,000" 形式 |

#### 日付処理 (`src/lib/analytics/date-utils.ts`)

| # | テストケース | 期待結果 |
|---|-------------|---------|
| U-DATE-01 | getDateRange('7d'): 7日前〜今日 | ISO文字列が正確 |
| U-DATE-02 | getDateRange('30d'): 30日前〜今日 | 月跨ぎ正常 |
| U-DATE-03 | getDateRange('custom', start, end): カスタム範囲 | start < end バリデーション |
| U-DATE-04 | formatBQDate: Date → 'YYYYMMDD' | BigQuery形式 |
| U-DATE-05 | formatGA4Date: Date → 'YYYY-MM-DD' | GA4形式 |
| U-DATE-06 | parseBQDate: 'YYYYMMDD' → Date | パース正確 |
| U-DATE-07 | getMonthRange: 月初・月末の計算 | 2月末, 閏年対応 |

### 2.2 統合テスト

#### API → Supabase → Response フロー

| # | テストケース | 期待結果 |
|---|-------------|---------|
| I-API-01 | GET /api/admin/articles/analytics: 認証成功 → データ返却 | 200 + ArticleAnalytics[] |
| I-API-02 | GET /api/admin/articles/analytics: 認証失敗 | 401 |
| I-API-03 | GET /api/admin/articles/analytics: Supabase未設定 | 200 + 空配列 |
| I-API-04 | POST /api/admin/analytics/sync: GA4→Supabase同期 | analytics_daily にupsert |
| I-API-05 | POST /api/admin/analytics/sync: 重複日付upsert | ON CONFLICT UPDATE |
| I-API-06 | POST /api/admin/analytics/sync: GA4エラー | 500 + エラーメッセージ |
| I-API-07 | POST /api/admin/revenue/sync: A8→Supabase同期 | revenue_daily にupsert |
| I-API-08 | POST /api/admin/revenue/sync: CSVパースエラー | 400 + バリデーションエラー |
| I-API-09 | GET /api/admin/revenue: 期間指定 | 日付範囲フィルタが機能 |
| I-API-10 | GET /api/admin/revenue: ASP別集計 | asp_name ごとにグルーピング |
| I-API-11 | レート制限 (60req/min) 超過時 | 429 + Retry-After ヘッダー |
| I-API-12 | CRON /api/cron/analytics-sync: 認証 | CRON_SECRET 検証 |

#### Dashboard Data 統合

| # | テストケース | 期待結果 |
|---|-------------|---------|
| I-DASH-01 | fetchDashboardData: 全データソース正常 | AdminDashboardData 完全形 |
| I-DASH-02 | fetchDashboardData: GA4エラー → 部分データ | PV=0, 他は正常 |
| I-DASH-03 | fetchDashboardData: Supabaseエラー → モックフォールバック | getMockDashboardData() |
| I-DASH-04 | fetchDashboardData: revenue.byAsp にA8データ含む | RevenueSummary[] が正しい |
| I-DASH-05 | fetchDashboardData: connection() 呼び出し | PPR動的レンダリングにオプトイン |

### 2.3 E2Eテスト

#### /admin/articles ページ

| # | テストケース | 期待結果 |
|---|-------------|---------|
| E2E-ART-01 | PVカラムが表示される | テーブルに「PV」列ヘッダーが存在 |
| E2E-ART-02 | クリック数カラムが表示される | テーブルに「クリック」列ヘッダーが存在 |
| E2E-ART-03 | CV数カラムが表示される | テーブルに「CV」列ヘッダーが存在 |
| E2E-ART-04 | 収益カラムが表示される | テーブルに「収益」列ヘッダーが存在 |
| E2E-ART-05 | PVカラムでソート可能 | ヘッダークリックで降順/昇順切替 |
| E2E-ART-06 | 収益カラムでソート可能 | ヘッダークリックで降順/昇順切替 |
| E2E-ART-07 | 収益が ¥ フォーマットで表示される | "¥15,000" 形式 |
| E2E-ART-08 | データなし時にゼロ表示 | "0" or "¥0" が表示される |

#### /admin ダッシュボード (トレンドチャート)

| # | テストケース | 期待結果 |
|---|-------------|---------|
| E2E-DASH-01 | PVトレンドチャートが表示される | Recharts SVG が描画される |
| E2E-DASH-02 | 収益トレンドチャートが表示される | Recharts SVG が描画される |
| E2E-DASH-03 | 期間セレクタ (7日/30日/90日) が機能する | 選択変更でチャート更新 |
| E2E-DASH-04 | ASP別収益ランキングが表示される | 表形式で ASP名, 金額 |
| E2E-DASH-05 | 記事別PVランキングが表示される | 上位10記事のリスト |

---

## 3. 品質メトリクス

### 3.1 カバレッジ目標

| 対象 | 現状閾値 | 新API目標 | 備考 |
|------|---------|----------|------|
| Branches | 25% | **50%** | 新コードは80%以上 |
| Functions | 25% | **50%** | 新コードは80%以上 |
| Lines | 30% | **55%** | 新コードは85%以上 |
| Statements | 30% | **55%** | 新コードは85%以上 |

**新規ファイル個別目標**:
- `src/lib/analytics/*.ts`: Lines 85%以上
- `src/app/api/admin/analytics/**/*.ts`: Lines 80%以上
- `src/app/api/admin/revenue/**/*.ts`: Lines 80%以上

### 3.2 パフォーマンス基準

| メトリクス | 基準値 | 測定方法 |
|-----------|--------|---------|
| /admin/articles 初期ロード | < 3秒 (LCP) | Lighthouse CI |
| /admin ダッシュボード初期ロード | < 3秒 (LCP) | Lighthouse CI |
| GA4 API レスポンス (30日分) | < 5秒 | API Route内計測 |
| BigQuery クエリ (30日分) | < 10秒 | BigQueryジョブ統計 |
| Supabase upsert (100行バッチ) | < 2秒 | API Route内計測 |
| チャート描画 (Recharts) | < 500ms | E2Eテスト内計測 |

**Lighthouse バジェット** (既存 `lighthouse-budget.test.ts` 拡張):
```
/admin/articles:
  - Performance: ≥ 70
  - First Contentful Paint: ≤ 2.5s
  - Time to Interactive: ≤ 4.0s
  - Total Blocking Time: ≤ 300ms

/admin (dashboard):
  - Performance: ≥ 65
  - First Contentful Paint: ≤ 3.0s
  - Time to Interactive: ≤ 5.0s
```

### 3.3 エラーバウンダリ

| レイヤー | エラー種別 | 処理方針 |
|---------|-----------|---------|
| GA4 API | 認証エラー (401/403) | ログ + モックデータ返却 + アラート |
| GA4 API | レート制限 (429) | 指数バックオフリトライ (max 3回) |
| GA4 API | タイムアウト | 5秒タイムアウト + フォールバック |
| BigQuery | クエリエラー | ログ + キャッシュデータ返却 |
| BigQuery | コスト上限超過 | クエリ実行拒否 + アラート |
| A8 CSV | パースエラー | バリデーションエラー返却 + 元ファイル保持 |
| Supabase | 接続エラー | モックデータフォールバック (既存パターン) |
| Supabase | upsert 競合 | ON CONFLICT UPDATE (冪等性保証) |
| UI | チャート描画エラー | React ErrorBoundary + フォールバックUI |
| UI | API fetch エラー | SWR エラーハンドリング + リトライボタン |

---

## 4. セキュリティレビュー

### 4.1 GCPサービスアカウントキーの安全な管理

| 項目 | 要件 | 実装方針 |
|------|------|---------|
| キー保存場所 | Vercel環境変数 (暗号化) | `GCP_SERVICE_ACCOUNT_KEY` (JSON文字列) |
| ローカル開発 | `.env.local` (gitignore済) | JSON キーファイルを Base64 エンコードして格納 |
| キーの権限範囲 | 最小権限の原則 | GA4: `roles/analytics.viewer`, BQ: `roles/bigquery.dataViewer` + `roles/bigquery.jobUser` |
| コードでの取扱い | 環境変数からのみ読込 | `process.env.GCP_SERVICE_ACCOUNT_KEY` → `JSON.parse()` |
| ログ出力禁止 | キー情報のログ漏洩防止 | ログにキー・トークンを含めない |

```typescript
// 推奨: 環境変数バリデーション (src/lib/config/env.ts 拡張)
export function getGCPCredentials(): ServiceAccountCredentials {
  const raw = process.env.GCP_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GCP_SERVICE_ACCOUNT_KEY is not defined')

  try {
    const parsed = JSON.parse(raw)
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error('Invalid service account key format')
    }
    return parsed
  } catch (e) {
    throw new Error('Failed to parse GCP_SERVICE_ACCOUNT_KEY')
  }
}
```

**テストケース**:
| # | テストケース | 期待結果 |
|---|-------------|---------|
| S-GCP-01 | GCP_SERVICE_ACCOUNT_KEY 未設定 → 起動時エラー | 明確なエラーメッセージ |
| S-GCP-02 | 不正JSON → パースエラー | "Failed to parse" エラー |
| S-GCP-03 | 必須フィールド欠落 | "Invalid format" エラー |
| S-GCP-04 | 正常キー → credentials返却 | client_email, private_key 含む |
| S-GCP-05 | ログにキー情報が含まれない | console.log/error を検証 |

### 4.2 APIキーのローテーション設計

| キー | ローテーション頻度 | 手順 |
|------|-----------------|------|
| GCP サービスアカウントキー | 90日ごと | GCP Console → 新キー生成 → Vercel環境変数更新 → 旧キー無効化 |
| PIPELINE_API_KEY | 90日ごと | 新キー生成 → Vercel環境変数更新 → Cron Job 確認 |
| CRON_SECRET | 90日ごと | Vercel Dashboard → 更新 |
| ADMIN_API_KEY | 90日ごと | Vercel Dashboard → 更新 |
| Supabase Service Role Key | 変更不要 (プロジェクト単位) | プロジェクト再生成時のみ |

**ローテーション手順の自動化提案**:
1. GCP: Workload Identity Federation (キーレス認証) への移行を推奨
2. ローテーションリマインダー: Vercel Cron (`/api/cron/key-rotation-check`) で90日チェック
3. デュアルキー対応: ローテーション中のダウンタイムゼロ (新旧キー並行受付)

### 4.3 Rate Limiting (既存 60req/min)

既存 `RateLimiter` (スライディングウィンドウ) を新APIエンドポイントにも適用。

| エンドポイント | レート制限 | 備考 |
|-------------|----------|------|
| GET /api/admin/articles/analytics | 60req/min | 既存の共通制限 |
| POST /api/admin/analytics/sync | 10req/min | 同期は低頻度 |
| POST /api/admin/revenue/sync | 5req/min | CSV取込は低頻度 |
| GET /api/admin/revenue | 60req/min | 既存の共通制限 |
| GET /api/cron/analytics-sync | 1req/min | Cron専用 (CRON_SECRET必須) |

**追加セキュリティ**:
- BigQuery クエリにコスト上限設定 (`maximumBytesBilled: 1GB`)
- GA4 API に1日あたりのリクエスト上限管理
- 入力バリデーション: 日付パラメータの SQL インジェクション防止 (パラメータ化クエリ)

---

## 5. Supabase `as any` 型安全化の提案

### 5.1 現状分析

`as any` は41ファイル中で使用。主な原因:

1. **Database型定義にテーブルが不足**: `pipeline_runs`, `monitoring_alerts`, `generation_costs` 等が `Database.public.Tables` に存在するが、supabase-js の型推論が複雑で `from()` の戻り値型が正しく推論されない
2. **supabase-js v2 の型制約**: `.from('table_name')` の戻り値は `Database['public']['Tables']` のキーに基づくが、チェーン呼び出し (`select().eq().order()`) の型推論が不完全

### 5.2 解消アプローチ

#### アプローチ A: 型安全ラッパー関数 (推奨)

`src/lib/supabase/client.ts` の既存パターン (`upsertArticle`, `updateArticle`) を全テーブルに拡張。

```typescript
// src/lib/supabase/queries.ts (新規)

import type { SupabaseServerClient } from './client'
import type {
  AnalyticsDailyRow, AnalyticsDailyInsert,
  PipelineRunRow, PipelineRunInsert,
  MonitoringAlertRow, MonitoringAlertInsert,
  GenerationCostRow, GenerationCostInsert,
} from '@/types/database'

// --- analytics_daily ---
export async function upsertAnalyticsDaily(
  supabase: SupabaseServerClient,
  data: AnalyticsDailyInsert
) {
  const { data: result, error } = await (supabase as any)
    .from('analytics_daily')
    .upsert(data, { onConflict: 'article_id,date' })
    .select()
    .single() as { data: AnalyticsDailyRow | null; error: { message: string; code: string } | null }

  if (error) throw error
  return result
}

export async function getAnalyticsDaily(
  supabase: SupabaseServerClient,
  options: { articleId?: string; since?: string; until?: string }
) {
  let query = (supabase as any)
    .from('analytics_daily')
    .select('*')
    .order('date', { ascending: false })

  if (options.articleId) query = query.eq('article_id', options.articleId)
  if (options.since) query = query.gte('date', options.since)
  if (options.until) query = query.lte('date', options.until)

  const { data, error } = await query as {
    data: AnalyticsDailyRow[] | null
    error: { message: string; code: string } | null
  }

  if (error) throw error
  return data ?? []
}

// --- pipeline_runs ---
export async function insertPipelineRun(
  supabase: SupabaseServerClient,
  data: PipelineRunInsert
) {
  const { data: result, error } = await (supabase as any)
    .from('pipeline_runs')
    .insert(data)
    .select()
    .single() as { data: PipelineRunRow | null; error: { message: string; code: string } | null }

  if (error) throw error
  return result
}

// 同様に monitoring_alerts, generation_costs ...
```

**メリット**: `as any` を一箇所に集約。呼び出し側は型安全。
**作業量**: 約 6テーブル × 3-4関数 = 18-24関数
**影響範囲**: 41ファイルの `as any` → queries.ts の関数呼び出しに置換

#### アプローチ B: supabase-js v3 アップグレード (将来)

supabase-js v3 (2026年中リリース予定) では型推論が改善される可能性あり。
現時点ではアプローチ A で対処し、v3 リリース後にラッパー関数を削除。

#### アプローチ C: Supabase CLI 型生成 (`supabase gen types`)

```bash
npx supabase gen types typescript --project-id <project-id> > src/types/database.generated.ts
```

**メリット**: スキーマと型定義の乖離を自動解消
**注意**: CI に組み込み、マイグレーション時に自動再生成

### 5.3 移行計画

| Phase | 対象 | ファイル数 | 優先度 |
|-------|------|-----------|--------|
| 1 | `src/lib/supabase/client.ts` 既存関数の `as any` | 2箇所 | 高 (既にラッパーパターン確立) |
| 2 | `src/lib/admin/dashboard-data.ts` | 4箇所 | 高 (今回のダッシュボード改修で対応) |
| 3 | `src/app/api/admin/**/*.ts` API Routes | 20箇所 | 中 (queries.ts ラッパーに移行) |
| 4 | `src/lib/pipeline/**/*.ts` Pipeline | 5箇所 | 中 |
| 5 | `src/lib/batch/**/*.ts`, `src/lib/reporting/**/*.ts` | 6箇所 | 低 |
| 6 | テストファイル内の `as any` | 4箇所 | 低 (モックなので影響小) |

### 5.4 型安全化テスト

| # | テストケース | 期待結果 |
|---|-------------|---------|
| T-TYPE-01 | `tsc --noEmit` が全パス | 型エラーなし |
| T-TYPE-02 | queries.ts の戻り値型が正しい | TypeScript コンパイルで検証 |
| T-TYPE-03 | ラッパー関数のエラーハンドリング | error時にthrow |
| T-TYPE-04 | 既存テストが全パス | リグレッションなし |

---

## 6. テスト実行計画

### 6.1 CI/CD パイプライン

```
PR → Lint + Type Check → Unit (Vitest) → Integration (Vitest) → Build → E2E (Playwright)
```

### 6.2 テストコマンド

```bash
# ユニット + 統合テスト
npm run test

# カバレッジ付き
npm run test:coverage

# E2E
npm run test:e2e

# 型チェック
npx tsc --noEmit
npm run typecheck:test
```

### 6.3 新規テストファイル一覧 (予定)

| ファイル | 種別 | 推定テスト数 |
|---------|------|------------|
| `src/lib/analytics/__tests__/ga4-client.test.ts` | Unit | 8 |
| `src/lib/analytics/__tests__/bigquery-client.test.ts` | Unit | 7 |
| `src/lib/analytics/__tests__/a8-revenue.test.ts` | Unit | 8 |
| `src/lib/analytics/__tests__/aggregator.test.ts` | Unit | 8 |
| `src/lib/analytics/__tests__/date-utils.test.ts` | Unit | 7 |
| `src/__tests__/api/admin/analytics-sync.test.ts` | Integration | 6 |
| `src/__tests__/api/admin/revenue-sync.test.ts` | Integration | 5 |
| `src/__tests__/config/gcp-credentials.test.ts` | Unit | 5 |
| `src/lib/supabase/__tests__/queries.test.ts` | Unit | 10 |
| `e2e/admin-articles-analytics.spec.ts` | E2E | 8 |
| `e2e/admin-dashboard-charts.spec.ts` | E2E | 5 |
| **合計** | | **~77** |

**既存テストとの合計**: 1,258 + 77 = **~1,335テスト**

---

## 7. 依存パッケージ追加

```json
{
  "dependencies": {
    "@google-analytics/data": "^4.x",
    "@google-cloud/bigquery": "^7.x"
  }
}
```

**テスト用追加パッケージ**: なし (Vitest + vi.mock で十分)
