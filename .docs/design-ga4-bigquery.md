# GA4 Data API + BigQuery 連携設計書

## 1. 概要

GA4 Data API v1 と BigQuery を統合し、menscataly.com の記事パフォーマンスを自動取得・分析する。

**データフロー:**
```
GA4 → Daily Export → BigQuery (長期分析DWH)
GA4 → Data API v1 → Supabase analytics_daily (運用DB)
GSC → API v1 → Supabase analytics_daily (CTR/検索データ)
```

**スケジュール:** Vercel Cron 23:00 JST (14:00 UTC) = PDCAサイクル

---

## 2. GA4 Data API 統合設計

### 2.1 認証フロー

```
GCPサービスアカウント
  ↓ GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY
  ↓ google-auth-library の JWT 認証
  ↓
@google-analytics/data (BetaAnalyticsDataClient)
  ↓
GA4 Data API v1
```

**認証方式:** サービスアカウントキー (JSON鍵ファイルではなく環境変数で秘密鍵を渡す)

Vercel環境では `GOOGLE_APPLICATION_CREDENTIALS` (ファイルパス) が使えないため、環境変数から直接JWTクレデンシャルを組み立てる。

```typescript
import { BetaAnalyticsDataClient } from '@google-analytics/data'

function createGA4Client(): BetaAnalyticsDataClient {
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')
  const projectId = requireEnv('GOOGLE_PROJECT_ID')

  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    projectId,
  })
}
```

**GCP側の準備:**
1. サービスアカウント作成 (`menscataly-analytics@menscataly-analytics.iam.gserviceaccount.com`)
2. GA4プロパティの「プロパティアクセス管理」でサービスアカウントに「閲覧者」ロール付与
3. `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`, `GA4_PROPERTY_ID` を Vercel環境変数に設定

### 2.2 取得メトリクス・ディメンション

**runReport リクエスト:**

```typescript
const [response] = await client.runReport({
  property: `properties/${propertyId}`,
  dimensions: [
    { name: 'pagePath' },
    { name: 'date' },
  ],
  metrics: [
    { name: 'screenPageViews' },     // → pageviews
    { name: 'totalUsers' },           // → unique_users
    { name: 'averageSessionDuration' }, // → avg_time (秒)
    { name: 'bounceRate' },           // → bounce_rate (0-1)
    { name: 'sessions' },            // セッション数 (参考)
  ],
  dateRanges: [
    { startDate: 'yesterday', endDate: 'yesterday' }, // 日次バッチ: 前日分
  ],
  dimensionFilter: {
    filter: {
      fieldName: 'pagePath',
      stringFilter: {
        matchType: 'BEGINS_WITH',
        value: '/articles/',  // 記事ページのみ
      },
    },
  },
  orderBys: [
    { metric: { metricName: 'screenPageViews' }, desc: true },
  ],
  limit: 500, // 記事数上限
})
```

### 2.3 pagePath → article_id マッピング

```
GA4 pagePath: /articles/aga-clinic-ranking-2025
                         ↓ slug抽出
Supabase articles WHERE slug = 'aga-clinic-ranking-2025'
                         ↓
article_id (UUID)
```

**実装:**
```typescript
interface SlugToIdMap {
  [slug: string]: string  // slug → article_id (UUID)
}

async function buildSlugMap(supabase: SupabaseClient): Promise<SlugToIdMap> {
  const { data } = await supabase
    .from('articles')
    .select('id, slug')

  const map: SlugToIdMap = {}
  for (const row of data ?? []) {
    map[row.slug] = row.id
  }
  return map
}

function extractSlugFromPath(pagePath: string): string | null {
  // /articles/aga-clinic-ranking-2025 → aga-clinic-ranking-2025
  // /articles/aga-clinic-ranking-2025/ → aga-clinic-ranking-2025
  // /articles/aga-clinic-ranking-2025?ref=top → aga-clinic-ranking-2025
  const match = pagePath.match(/^\/articles\/([^/?#]+)/)
  return match ? match[1] : null
}
```

### 2.4 analytics_daily への同期

```typescript
async function syncGA4ToSupabase(
  ga4Data: GA4AnalyticsRow[],
  slugMap: SlugToIdMap,
  supabase: SupabaseClient
): Promise<{ synced: number; skipped: number }> {
  let synced = 0
  let skipped = 0

  for (const row of ga4Data) {
    const slug = extractSlugFromPath(row.pagePath)
    if (!slug) { skipped++; continue }

    const articleId = slugMap[slug]
    if (!articleId) { skipped++; continue }

    const { error } = await supabase
      .from('analytics_daily')
      .upsert({
        article_id: articleId,
        date: row.date,           // YYYY-MM-DD
        pageviews: row.pageviews,
        unique_users: row.uniqueUsers,
        avg_time: row.avgTime,
        bounce_rate: row.bounceRate,
        ctr: 0,                   // GSCから別途マージ
        conversions: 0,           // ASPから別途マージ
      }, { onConflict: 'article_id,date' })

    if (error) {
      console.error(`[ga4-sync] upsert failed for ${slug}:`, error.message)
      skipped++
    } else {
      synced++
    }
  }

  return { synced, skipped }
}
```

### 2.5 GSC (Search Console) データマージ

GSCからはCTRと検索順位を取得し、同じ `analytics_daily` レコードにマージする。

```typescript
import { google } from 'googleapis'

async function fetchGSCData(date: string): Promise<GSCRow[]> {
  const auth = new google.auth.JWT({
    email: requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    key: requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })

  const searchconsole = google.searchconsole({ version: 'v1', auth })

  const response = await searchconsole.searchanalytics.query({
    siteUrl: 'https://menscataly.com',
    requestBody: {
      startDate: date,
      endDate: date,
      dimensions: ['page'],
      rowLimit: 500,
    },
  })

  return (response.data.rows ?? []).map(row => ({
    page: row.keys?.[0] ?? '',
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }))
}
```

**マージ:** GA4同期後、同じ `article_id + date` の行にCTRを UPDATE。

### 2.6 エラーハンドリング・リトライ

| エラー種別 | 対応 |
|---|---|
| 認証エラー (401/403) | ログ出力して即終了、アラート通知 |
| レート制限 (429) | exponential backoff (1s→2s→4s), 最大3回リトライ |
| タイムアウト | 30秒タイムアウト、リトライ2回 |
| データ不整合 (slug不一致) | スキップしてログ、集計結果に反映 |
| GA4未設定 | モックデータにフォールバック (既存動作維持) |

**リトライ実装:**
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) throw err
      const isRetryable = isRetryableError(err)
      if (!isRetryable) throw err
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return msg.includes('429') ||
           msg.includes('rate limit') ||
           msg.includes('timeout') ||
           msg.includes('econnreset')
  }
  return false
}
```

### 2.7 実装ファイル構成

```
src/lib/analytics/
├── ga4-client.ts          # GA4 Data API クライアント
├── gsc-client.ts          # Search Console クライアント
├── sync-analytics.ts      # analytics_daily 同期ロジック
├── types.ts               # GA4/GSC共通型定義
└── __tests__/
    ├── ga4-client.test.ts
    ├── gsc-client.test.ts
    └── sync-analytics.test.ts
```

**既存ファイルの変更:**
- `src/lib/pipeline/steps/fetch-analytics.ts` — モック実装を `src/lib/analytics/ga4-client.ts` に委譲
- `src/lib/config/env.ts` — GA4/GSC関連の環境変数定義を追加
- `vercel.json` — PDCAの Cron (14:00 UTC) は既存で対応済み

### 2.8 環境変数

| 変数名 | 説明 | 必須 |
|---|---|---|
| `GA4_PROPERTY_ID` | GA4プロパティID | Yes |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | サービスアカウントメール | Yes |
| `GOOGLE_PRIVATE_KEY` | サービスアカウント秘密鍵 (PEM) | Yes |
| `GOOGLE_PROJECT_ID` | GCPプロジェクトID | Yes |
| `GSC_SITE_URL` | GSCサイトURL (`https://menscataly.com`) | Yes |

### 2.9 依存パッケージ

```json
{
  "@google-analytics/data": "^4.x",
  "googleapis": "^140.x"
}
```

`googleapis` は GSC用。GA4は専用SDK `@google-analytics/data` を使用。

---

## 3. BigQuery 連携設計

### 3.1 データソース

GA4 → BigQuery Daily Export (設定済み)

**テーブル:** `menscataly-analytics.analytics_XXXXXX.events_YYYYMMDD`
- パーティション: 日付 (`_TABLE_SUFFIX`)
- リージョン: `asia-northeast1` (東京)
- データ保持: 無期限 (ストレージ: 90日後にlong-term pricing自動適用)

### 3.2 認証

GA4 Data APIと同じサービスアカウントを共有。BigQuery閲覧権限が必要。

```typescript
import { BigQuery } from '@google-cloud/bigquery'

function createBigQueryClient(): BigQuery {
  const email = requireEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = requireEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')
  const projectId = requireEnv('GOOGLE_PROJECT_ID')

  return new BigQuery({
    projectId,
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    location: 'asia-northeast1',
  })
}
```

**GCP IAM:** サービスアカウントに `roles/bigquery.dataViewer` + `roles/bigquery.jobUser` を付与。

### 3.3 GA4 BigQuery Export テーブル構造

```sql
-- events_YYYYMMDD のキーカラム
event_date         STRING    -- "20260305"
event_name         STRING    -- "page_view", "affiliate_link_click", etc.
event_params       RECORD[]  -- key-value ペア
user_pseudo_id     STRING    -- ユーザー識別子
traffic_source     RECORD    -- 流入元
device             RECORD    -- デバイス情報
geo                RECORD    -- 地域情報

-- event_params 内の主要パラメータ
-- page_location: "https://menscataly.com/articles/aga-clinic-ranking"
-- page_title: 記事タイトル
-- engagement_time_msec: エンゲージメント時間(ms)
-- ga_session_id: セッションID
-- asp_name: ASP名 (affiliate_link_click イベント)
-- program_name: プログラム名 (affiliate_link_click イベント)
```

### 3.4 分析クエリ

#### 3.4.1 記事別PV推移 (30日/90日)

```sql
-- 記事別・日別PV (直近30日)
SELECT
  PARSE_DATE('%Y%m%d', event_date) AS date,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_url,
  COUNT(*) AS pageviews,
  COUNT(DISTINCT user_pseudo_id) AS unique_users
FROM `menscataly-analytics.analytics_XXXXXX.events_*`
WHERE
  _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                     AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'page_view'
  AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location')
      LIKE '%/articles/%'
GROUP BY date, page_url
ORDER BY date DESC, pageviews DESC
```

**コスト最適化:**
- `_TABLE_SUFFIX` で日付範囲を限定 → パーティションプルーニング
- `event_name = 'page_view'` でフィルタリング → 不要イベントスキャン回避
- `SELECT` で必要カラムのみ指定 → カラムスキャン最小化

#### 3.4.2 アフィリエイトクリック分析

```sql
-- ASP別・記事別クリック数
SELECT
  PARSE_DATE('%Y%m%d', event_date) AS date,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location') AS page_url,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'asp_name') AS asp_name,
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'program_name') AS program_name,
  COUNT(*) AS click_count
FROM `menscataly-analytics.analytics_XXXXXX.events_*`
WHERE
  _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                     AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'affiliate_link_click'
GROUP BY date, page_url, asp_name, program_name
ORDER BY click_count DESC
```

#### 3.4.3 流入元分析

```sql
-- トラフィックソース別セッション数 (30日)
SELECT
  traffic_source.source AS source,
  traffic_source.medium AS medium,
  COUNT(DISTINCT CONCAT(user_pseudo_id, '-',
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')
  )) AS sessions,
  COUNT(DISTINCT user_pseudo_id) AS users
FROM `menscataly-analytics.analytics_XXXXXX.events_*`
WHERE
  _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY))
                     AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'page_view'
GROUP BY source, medium
ORDER BY sessions DESC
```

#### 3.4.4 デバイス・地域分析

```sql
-- デバイスカテゴリ別
SELECT
  device.category AS device_category,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNT(*) AS events
FROM `menscataly-analytics.analytics_XXXXXX.events_*`
WHERE
  _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))
                     AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  AND event_name = 'page_view'
GROUP BY device_category
ORDER BY users DESC
```

### 3.5 TypeScript クライアント

```typescript
// src/lib/analytics/bigquery-client.ts

export interface BigQueryArticleMetrics {
  date: string
  slug: string
  pageviews: number
  uniqueUsers: number
  avgEngagementSec: number
}

export interface BigQueryDateRange {
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
}

export async function queryArticleMetrics(
  range: BigQueryDateRange
): Promise<BigQueryArticleMetrics[]> {
  const bq = createBigQueryClient()
  const datasetId = requireEnv('BQ_DATASET_ID') // analytics_XXXXXX

  const query = `
    SELECT
      PARSE_DATE('%Y%m%d', event_date) AS date,
      REGEXP_EXTRACT(
        (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location'),
        r'/articles/([^/?#]+)'
      ) AS slug,
      COUNT(*) AS pageviews,
      COUNT(DISTINCT user_pseudo_id) AS unique_users,
      AVG(
        CAST((SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'engagement_time_msec') AS FLOAT64)
      ) / 1000 AS avg_engagement_sec
    FROM \`${projectId}.${datasetId}.events_*\`
    WHERE
      _TABLE_SUFFIX BETWEEN @start_suffix AND @end_suffix
      AND event_name = 'page_view'
      AND (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'page_location')
          LIKE '%/articles/%'
    GROUP BY date, slug
    HAVING slug IS NOT NULL
    ORDER BY date DESC, pageviews DESC
  `

  const [rows] = await bq.query({
    query,
    params: {
      start_suffix: range.startDate.replace(/-/g, ''),
      end_suffix: range.endDate.replace(/-/g, ''),
    },
    location: 'asia-northeast1',
  })

  return rows as BigQueryArticleMetrics[]
}
```

### 3.6 コスト最適化戦略

| 対策 | 効果 |
|---|---|
| `_TABLE_SUFFIX` パーティションフィルタ | スキャン対象テーブルを日付範囲に限定 |
| `event_name` フィルタ | 不要イベント行をスキップ |
| 必要カラムのみ SELECT | カラムストレージのスキャン最小化 |
| パラメータ化クエリ (`@param`) | クエリキャッシュ活用 |
| クエリ結果キャッシュ (Supabase) | 同じクエリの再実行回避 |
| 管理画面のアクセス頻度制限 | 不要なクエリ実行防止 |

**コスト見積もり (月間10万PV以下):**
- BigQuery ストレージ: ~100MB/月 → $0 (10GB無料枠内)
- BigQuery クエリ: ~1GB/月スキャン → $0 (1TB/月無料枠内)
- GA4 Data API: 無料 (Core Reporting API)
- **合計: $0/月** (無料枠内で十分)

### 3.7 実装ファイル構成

```
src/lib/analytics/
├── ga4-client.ts          # (§2 GA4 Data API)
├── gsc-client.ts          # (§2 GSC API)
├── bigquery-client.ts     # BigQuery クエリクライアント
├── bigquery-queries.ts    # 再利用可能なSQLクエリ定数
├── sync-analytics.ts      # analytics_daily 同期ロジック
├── types.ts               # 共通型定義
└── __tests__/
    ├── ga4-client.test.ts
    ├── gsc-client.test.ts
    ├── bigquery-client.test.ts
    └── sync-analytics.test.ts
```

### 3.8 追加環境変数

| 変数名 | 説明 | 必須 |
|---|---|---|
| `BQ_DATASET_ID` | BigQuery データセットID (e.g. `analytics_XXXXXX`) | BigQuery利用時 |

### 3.9 依存パッケージ

```json
{
  "@google-cloud/bigquery": "^7.x"
}
```

---

## 4. パイプライン統合

### 4.1 fetch-analytics ステップ改修

既存の `src/lib/pipeline/steps/fetch-analytics.ts` を改修し、モック実装を実API呼び出しに置き換える。

```typescript
// 改修後のexecute関数
async execute(_input: unknown, context: PipelineContext): Promise<AnalyticsData[]> {
  const hasGA4Config =
    process.env.GA4_PROPERTY_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY

  if (!hasGA4Config) {
    console.log('[fetch-analytics] GA4 env vars not set — using mock data')
    return generateMockAnalyticsData()
  }

  try {
    // 1. GA4 Data API から前日分データ取得
    const ga4Data = await fetchGA4DailyMetrics('yesterday')

    // 2. GSC からCTRデータ取得 (失敗してもGA4データは使う)
    let gscData: GSCRow[] = []
    try {
      gscData = await fetchGSCData('yesterday')
    } catch (err) {
      console.warn('[fetch-analytics] GSC fetch failed:', err)
    }

    // 3. Supabase analytics_daily に同期
    const { synced, skipped } = await syncToAnalyticsDaily(ga4Data, gscData)
    console.log(`[fetch-analytics] Synced: ${synced}, Skipped: ${skipped}`)

    // 4. PipelineContext用にAnalyticsData[]形式で返す
    return ga4Data.map(row => ({
      articleId: row.articleId,
      pageviews: row.pageviews,
      uniqueUsers: row.uniqueUsers,
      avgTime: row.avgTime,
      bounceRate: row.bounceRate,
      ctr: findCTR(gscData, row.pagePath),
      date: row.date,
    }))
  } catch (err) {
    console.error('[fetch-analytics] GA4 API error, falling back to mock:', err)
    return generateMockAnalyticsData()
  }
}
```

### 4.2 Vercel Cron 統合

```json
// vercel.json (既存)
{
  "crons": [
    {
      "path": "/api/pipeline/run?type=daily",
      "schedule": "0 21 * * *"    // 06:00 JST — 記事生成
    },
    {
      "path": "/api/pipeline/run?type=pdca",
      "schedule": "0 14 * * *"    // 23:00 JST — 分析・PDCA
    }
  ]
}
```

PDCAパイプライン (`type=pdca`) が fetch-analytics ステップを実行し、GA4/GSC → analytics_daily 同期を行う。

### 4.3 管理画面 API

BigQuery クエリは管理画面 (`/admin`) の API Route から呼び出す:

```
GET /api/admin/analytics/trends?range=30d
  → BigQuery: 記事別PV推移 (30日)

GET /api/admin/analytics/traffic-sources?range=30d
  → BigQuery: 流入元分析

GET /api/admin/analytics/affiliate-clicks?range=30d
  → BigQuery: アフィリエイトクリック分析

GET /api/admin/analytics/overview
  → Supabase: analytics_daily サマリー (直近のKPI)
```

**使い分け:**
- **Supabase** — 日常運用のKPI表示 (直近データ、高速レスポンス)
- **BigQuery** — 長期トレンド分析 (30日/90日推移、詳細ブレイクダウン)

---

## 5. セキュリティ

| 項目 | 対策 |
|---|---|
| サービスアカウント権限 | 最小権限原則: GA4閲覧者 + BQ dataViewer + jobUser |
| 秘密鍵管理 | Vercel環境変数 (暗号化), ソースコードにハードコードしない |
| API Route認証 | 既存の `validateAdminAuth` (timingSafeEqual) を継続使用 |
| BigQueryコスト暴走防止 | `maximumBytesBilled` パラメータでクエリ上限設定 |
| レート制限 | 管理画面API: 既存スライディングウィンドウ (60req/min) |

---

## 6. テスト計画

| テスト | 内容 |
|---|---|
| `ga4-client.test.ts` | モック認証、runReport応答パース、slugマッピング |
| `gsc-client.test.ts` | GSCデータ取得、CTRマージ |
| `bigquery-client.test.ts` | クエリ構築、結果マッピング、コスト制限パラメータ |
| `sync-analytics.test.ts` | Supabase upsert、重複処理、エラーハンドリング |
| `fetch-analytics.test.ts` (既存改修) | GA4→モックフォールバック、統合フロー |

---

## 7. 実装優先度

| 優先度 | 項目 | 依存 |
|---|---|---|
| P0 | GA4 Data API クライアント (`ga4-client.ts`) | GCPサービスアカウント |
| P0 | analytics_daily 同期 (`sync-analytics.ts`) | ga4-client |
| P1 | fetch-analytics ステップ改修 | sync-analytics |
| P1 | GSC クライアント (`gsc-client.ts`) | GCPサービスアカウント |
| P2 | BigQuery クライアント (`bigquery-client.ts`) | BQデータ蓄積(1週間+) |
| P2 | 管理画面 BigQuery API Routes | bigquery-client |
| P3 | Looker Studio 連携 | BQデータ蓄積(1ヶ月+) |
