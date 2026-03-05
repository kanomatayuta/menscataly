# ASP収益データ連携 設計書

## 1. 概要

本設計書は、A8.netを皮切りにASP各社のパフォーマンスデータ（クリック・成果・報酬）を自動取得し、Supabase `affiliate_links` テーブルに同期するシステムの設計を定義する。GA4クリックイベントとの統合により、記事単位のROI可視化を実現する。

### 対象ASP（優先順）

| # | ASP | ステータス | API提供 | 備考 |
|---|------|-----------|---------|------|
| 1 | A8.net | 登録済み (a26030485942) | 確定API v3 + 成果連携API | メディアID設定済み |
| 2 | afb | 未申請 | API連携あり（管理画面から発行） | リアルタイムポストバック対応 |
| 3 | アクセストレード | 未申請 | APIリファレンスあり（要ログイン） | webサービス対応プログラム |
| 4 | バリューコマース | 未申請 | 商品検索API / レポートAPI | |
| 5 | felmat | 未申請 | 要確認 | クローズドASP |
| 6 | もしも | 未申請 | かんたんリンクAPI | W報酬対応 |

---

## 2. A8.net API 詳細調査

### 2.1 利用可能なAPI

A8.netはメディア会員向けに2種類のAPIを提供:

#### (A) 確定API v3（EC売上確定API）
- **用途**: 広告主側の成果確定・キャンセル処理用（広告主向け）
- **ベースURL**: `https://ecsales-api.a8.net/v3`
- **メディア側利用**: 直接利用不可（広告主APIのため）

| エンドポイント | メソッド | 説明 |
|---------------|---------|------|
| `/ins/{PROGRAM_ID}/unsealed` | GET | 未確定売上データ取得 |
| `/ins/{PROGRAM_ID}/unsealed/count` | GET | 未確定件数取得 |
| `/sp/{SP_ID}/unsealed/count` | GET | 広告主配下全プログラム未確定件数 |
| `/ins/{PROGRAM_ID}/sealed/today` | GET | 当日確定データ |
| `/ins/{PROGRAM_ID}/sealed` | GET | 確定済みデータ（91日以内） |
| `/ins/{PROGRAM_ID}/order/{ORDER_ID}/modify` | POST | 売上修正 |
| `/ins/{PROGRAM_ID}/order/{ORDER_ID}/decide` | POST | 売上確定 |
| `/ins/{PROGRAM_ID}/order/{ORDER_ID}/cancel` | POST | 売上キャンセル |

**認証**: APIキー + IP制限（登録IP以外は認証エラー）
**レート制限**: 100回/分（超過で問い合わせ）
**レスポンス**: JSON (`status_code`, `message`, `results[]`)
**メンテナンス**: 23:30〜01:00 JST（日次処理）

#### (B) 成果データ連携API（メディア向け）
- **用途**: A8.net成果データを広告プラットフォームに連携
- **対応PF**: Google広告、Meta広告、LINE広告、TikTok広告
- **データ反映**: 毎時
- **利用条件**:
  - リスティングOK/一部OKプログラムのみ
  - 専用フォームから申請 → 審査 → APIキー発行
  - 運用型広告利用メディア向け（上級者向け）
- **制約**: 詳細API仕様は申請・審査後に開示

### 2.2 メディア向けデータ取得の現実的アプローチ

A8.netはメディア会員向けの**レポートデータ取得API（REST）を公式に公開していない**。利用可能なデータ取得方法は:

| 方法 | 自動化 | データ | 制約 |
|------|--------|--------|------|
| 管理画面レポート（CSV手動DL） | 不可 | クリック/成果/確定/報酬 | 月別・日別・PG別 |
| 成果連携API（申請制） | 可 | 成果データ（毎時） | 運用型広告利用者限定、要審査 |
| 管理画面スクレイピング | 半自動 | 全データ | 規約違反リスク、非推奨 |
| A8レポートメール通知 | 半自動 | 日次サマリー | パース必要 |

### 2.3 推奨戦略

```
Phase A（即時）: 管理画面CSVを手動DL → パースしてSupabaseにインポート
Phase B（ASP申請後）: 成果連携API申請 → 自動連携フロー構築
Phase C（将来）: 各ASP API統合 → 完全自動化
```

---

## 3. データ同期フロー設計

### 3.1 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    Data Sources                          │
├──────────┬──────────┬──────────┬────────────────────────┤
│ A8.net   │ afb      │ AT       │ GA4                    │
│ CSV/API  │ API      │ API      │ Data API               │
└────┬─────┴────┬─────┴────┬─────┴──────┬─────────────────┘
     │          │          │            │
     ▼          ▼          ▼            ▼
┌────────────────────────────────────────────────────────┐
│            ASP Report Sync Service                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ IASPReportProvider (共通インターフェース)          │  │
│  │  ├─ A8ReportProvider                              │  │
│  │  ├─ AfbReportProvider                             │  │
│  │  ├─ AccessTradeReportProvider                     │  │
│  │  └─ GA4ClickProvider                              │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ReportSyncOrchestrator                            │  │
│  │  ├─ fetchReports()         日次バッチ             │  │
│  │  ├─ normalizeData()        共通フォーマット変換   │  │
│  │  ├─ matchArticles()        記事紐付け             │  │
│  │  └─ upsertToSupabase()     DB同期                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│                  Supabase                               │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐ │
│  │asp_programs   │  │affiliate    │  │revenue_daily  │ │
│  │(24 programs)  │  │_links       │  │(新規テーブル) │ │
│  └──────────────┘  └─────────────┘  └───────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 3.2 新規テーブル: `revenue_daily`

```sql
CREATE TABLE revenue_daily (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE NOT NULL,
  asp_name        TEXT NOT NULL,          -- a8|afb|accesstrade|...
  program_id      TEXT NOT NULL,          -- asp_programs.program_id
  article_slug    TEXT,                   -- microCMS slug (紐付け)
  impressions     INTEGER DEFAULT 0,
  clicks          INTEGER DEFAULT 0,
  conversions_pending   INTEGER DEFAULT 0,  -- 未確定CV
  conversions_confirmed INTEGER DEFAULT 0,  -- 確定CV
  conversions_cancelled INTEGER DEFAULT 0,  -- キャンセルCV
  revenue_pending       NUMERIC(12,2) DEFAULT 0,  -- 未確定報酬
  revenue_confirmed     NUMERIC(12,2) DEFAULT 0,  -- 確定報酬
  revenue_cancelled     NUMERIC(12,2) DEFAULT 0,  -- キャンセル報酬
  source          TEXT DEFAULT 'manual',  -- manual|api|csv
  raw_data        JSONB,                  -- 元データ保存
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (date, asp_name, program_id, article_slug)
);

CREATE INDEX idx_revenue_daily_date ON revenue_daily(date);
CREATE INDEX idx_revenue_daily_asp ON revenue_daily(asp_name);
CREATE INDEX idx_revenue_daily_article ON revenue_daily(article_slug);
```

### 3.3 成果ステータス管理

```
未発生 → 発生(pending) → 確定(confirmed) → 支払い済み(paid)
                       → キャンセル(cancelled)
```

```typescript
type ConversionStatus =
  | 'pending'      // 成果発生・未確定
  | 'confirmed'    // 確定済み
  | 'cancelled'    // キャンセル
  | 'paid';        // 支払い完了

interface ConversionRecord {
  id: string;
  aspName: AspName;
  programId: string;
  orderId: string;           // ASP側注文ID
  articleSlug?: string;       // 紐付け記事
  status: ConversionStatus;
  occurredAt: Date;          // 成果発生日
  confirmedAt?: Date;        // 確定日
  paidAt?: Date;             // 支払日
  rewardAmount: number;      // 報酬額
  orderAmount?: number;      // 注文金額
  rawData?: Record<string, unknown>;
}
```

### 3.4 article_id 紐付け方法

ASP成果データと記事の紐付けは以下の優先度で実行:

```typescript
// 1. program_id ベース (asp_programs → affiliate_links → articles)
// 最も確実: DBリレーションを辿る
async function matchByProgramId(
  programId: string
): Promise<string | null> {
  const link = await supabase
    .from('affiliate_links')
    .select('article_id, articles(slug)')
    .eq('program_id', programId)
    .single();
  return link?.articles?.slug ?? null;
}

// 2. URL パラメータベース
// A8のクリックURLに含まれるカスタムパラメータ (a8mat + 独自パラメータ)
// リンク生成時にarticle slugをパラメータに埋め込む
function extractArticleFromUrl(clickUrl: string): string | null {
  const url = new URL(clickUrl);
  return url.searchParams.get('article') ?? null;
}

// 3. カテゴリベース (フォールバック)
// program → category → 該当カテゴリの全記事に按分
async function matchByCategory(
  programId: string
): Promise<string[]> {
  const program = await getProgram(programId);
  if (!program) return [];
  const articles = await getArticlesByCategory(program.category);
  return articles.map(a => a.slug);
}
```

---

## 4. 共通インターフェース設計 (IASPReportProvider)

### 4.1 インターフェース定義

```typescript
// src/lib/asp/reports/types.ts

/** ASPレポートの正規化された1レコード */
interface NormalizedReportRecord {
  date: string;                    // YYYY-MM-DD
  aspName: AspName;
  programId: string;               // asp_programs.program_id
  programName: string;
  impressions: number;
  clicks: number;
  conversionsPending: number;
  conversionsConfirmed: number;
  conversionsCancelled: number;
  revenuePending: number;          // 未確定報酬 (円)
  revenueConfirmed: number;        // 確定報酬 (円)
  revenueCancelled: number;        // キャンセル報酬 (円)
  articleSlug?: string;            // 紐付け記事 (取得可能な場合)
  rawData?: Record<string, unknown>;
}

/** レポート取得のオプション */
interface ReportFetchOptions {
  startDate: string;               // YYYY-MM-DD
  endDate: string;                 // YYYY-MM-DD
  programIds?: string[];           // 絞り込み (省略で全プログラム)
}

/** ASPレポートプロバイダーの共通インターフェース */
interface IASPReportProvider {
  /** ASP名 */
  readonly aspName: AspName;

  /** 認証情報のバリデーション */
  validateCredentials(): Promise<boolean>;

  /** レポートデータ取得 */
  fetchReport(options: ReportFetchOptions): Promise<NormalizedReportRecord[]>;

  /** サポートするレポートの粒度 */
  supportedGranularity(): ('daily' | 'monthly' | 'program')[];

  /** API利用可能か（認証済み・制限内） */
  isAvailable(): Promise<boolean>;
}
```

### 4.2 A8ReportProvider 実装

```typescript
// src/lib/asp/reports/a8-report-provider.ts

class A8ReportProvider implements IASPReportProvider {
  readonly aspName: AspName = 'a8';

  /**
   * Phase A: CSV手動インポート
   * 管理画面からDLしたCSVをパースして正規化
   */
  async importFromCSV(csvContent: string): Promise<NormalizedReportRecord[]> {
    const rows = parseA8CSV(csvContent);
    return rows.map(row => ({
      date: row['日付'],
      aspName: 'a8',
      programId: this.resolveA8ProgramId(row['プログラム名']),
      programName: row['プログラム名'],
      impressions: parseInt(row['インプレッション'] || '0'),
      clicks: parseInt(row['クリック'] || '0'),
      conversionsPending: parseInt(row['発生件数'] || '0'),
      conversionsConfirmed: parseInt(row['確定件数'] || '0'),
      conversionsCancelled: parseInt(row['キャンセル件数'] || '0'),
      revenuePending: parseFloat(row['発生報酬'] || '0'),
      revenueConfirmed: parseFloat(row['確定報酬'] || '0'),
      revenueCancelled: parseFloat(row['キャンセル報酬'] || '0'),
      rawData: row,
    }));
  }

  /**
   * Phase B: 成果連携API (申請・審査後)
   * A8成果データをAPIで自動取得
   */
  async fetchReport(options: ReportFetchOptions): Promise<NormalizedReportRecord[]> {
    if (!this.apiKey) {
      throw new Error('A8 成果連携API未設定。CSVインポートを使用してください。');
    }

    const response = await fetch(this.apiEndpoint, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_date: options.startDate,
        end_date: options.endDate,
        program_ids: options.programIds,
      }),
    });

    const data = await response.json();
    return this.normalizeA8Response(data);
  }

  async validateCredentials(): Promise<boolean> {
    // Phase A: CSVモードでは常にtrue
    // Phase B: API認証テスト
    return true;
  }

  async isAvailable(): Promise<boolean> {
    // 23:30〜01:00 JSTはメンテナンス
    const now = new Date();
    const jstHour = (now.getUTCHours() + 9) % 24;
    const jstMin = now.getUTCMinutes();
    if (jstHour === 23 && jstMin >= 30) return false;
    if (jstHour === 0) return false;
    return true;
  }

  supportedGranularity() {
    return ['daily', 'monthly', 'program'] as const;
  }

  /** A8プログラム名 → program_id マッピング */
  private resolveA8ProgramId(programName: string): string {
    // asp_programs テーブルの program_name と照合
    // 見つからなければ a8-unknown-{hash} を返す
    return this.programNameMap.get(programName) ?? `a8-unknown-${hash(programName)}`;
  }
}
```

### 4.3 ASPプロバイダー一覧

| ASP | Provider | Phase | データソース | 備考 |
|-----|----------|-------|-------------|------|
| A8.net | `A8ReportProvider` | A: CSV, B: API | CSV手動 → API自動 | 成果連携API要申請 |
| afb | `AfbReportProvider` | B | API | 管理画面からAPIキー発行 |
| アクセストレード | `AccessTradeReportProvider` | B | API | APIリファレンスあり |
| バリューコマース | `ValueCommerceReportProvider` | C | API | 商品検索+レポートAPI |
| felmat | `FelmatReportProvider` | C | CSV/手動 | API未確認 |
| もしも | `MoshimoReportProvider` | C | API | W報酬計算ロジック必要 |
| GA4 | `GA4ClickProvider` | A | Data API | クリックデータのみ |

---

## 5. afb API 概要

### 5.1 利用可能なAPI
- **API連携機能**: パートナー管理画面からAPIキー発行
- **リアルタイムポストバック**: 成果発生時にリアルタイムでHTTPリクエスト送信
- **対応PF**: TikTok、Facebook等の広告プラットフォーム連携

### 5.2 特徴
- 管理画面内のAPIキー発行ページから取得
- 複数ASP一括管理に対応（外部BI連携）
- 詳細仕様は管理画面内ドキュメントで開示

### 5.3 AfbReportProvider（将来実装）

```typescript
class AfbReportProvider implements IASPReportProvider {
  readonly aspName: AspName = 'afb';

  async fetchReport(options: ReportFetchOptions): Promise<NormalizedReportRecord[]> {
    // afb API仕様は管理画面ログイン後に確認
    // 申請・承認後に実装
    throw new Error('afb API未実装。管理画面から仕様書を取得してください。');
  }

  async validateCredentials(): Promise<boolean> {
    return !!process.env.AFB_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    return !!process.env.AFB_API_KEY;
  }

  supportedGranularity() {
    return ['daily', 'program'] as const;
  }
}
```

---

## 6. アクセストレード API 概要

### 6.1 利用可能なAPI
- **APIリファレンス**: webサービス対応プログラムの商品データ提供
- **レポートDL**: 成果別/日別/月別/素材別/デバイス別/キャリア別

### 6.2 成果別レポート項目
- 発生日、確定日、成果ID、プログラム名、注文金額、報酬額
- 掲載URL（成果発生ページ）= article_slug紐付けに利用可能
- デバイス、キャリア情報

### 6.3 AccessTradeReportProvider（将来実装）

```typescript
class AccessTradeReportProvider implements IASPReportProvider {
  readonly aspName: AspName = 'accesstrade';

  async fetchReport(options: ReportFetchOptions): Promise<NormalizedReportRecord[]> {
    // アクセストレードAPI仕様は管理画面ログイン後に確認
    throw new Error('AccessTrade API未実装。');
  }

  supportedGranularity() {
    return ['daily', 'monthly', 'program'] as const;
  }
}
```

---

## 7. GA4クリックイベント → Supabase 同期

### 7.1 現状

- `AffiliateClickTracker` コンポーネントがクリック時にGA4へ `affiliate_link_click` イベント送信
- イベントパラメータ: `asp_name`, `program_id`, `article_category`, `click_text`, `page_path`
- GA4 → BigQuery Daily Export 設定済み

### 7.2 GA4 Data API によるクリック数取得

```typescript
// src/lib/asp/reports/ga4-click-provider.ts

import { BetaAnalyticsDataClient } from '@google-analytics/data';

class GA4ClickProvider implements IASPReportProvider {
  readonly aspName: AspName = 'a8'; // aspNameはレコード毎に動的

  private client: BetaAnalyticsDataClient;
  private propertyId: string; // GA4 property ID

  constructor() {
    this.client = new BetaAnalyticsDataClient();
    this.propertyId = process.env.GA4_PROPERTY_ID!;
  }

  async fetchReport(options: ReportFetchOptions): Promise<NormalizedReportRecord[]> {
    const [response] = await this.client.runReport({
      property: `properties/${this.propertyId}`,
      dateRanges: [{
        startDate: options.startDate,
        endDate: options.endDate,
      }],
      dimensions: [
        { name: 'date' },
        { name: 'customEvent:asp_name' },
        { name: 'customEvent:program_id' },
        { name: 'pagePath' },
      ],
      metrics: [
        { name: 'eventCount' },
      ],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: {
            value: 'affiliate_link_click',
          },
        },
      },
    });

    return (response.rows ?? []).map(row => {
      const [date, aspName, programId, pagePath] =
        row.dimensionValues!.map(d => d.value!);
      const clicks = parseInt(row.metricValues![0].value!);
      const articleSlug = this.extractSlugFromPath(pagePath);

      return {
        date: this.formatDate(date), // YYYYMMDD → YYYY-MM-DD
        aspName: aspName as AspName,
        programId,
        programName: '', // 後でasp_programsから補完
        impressions: 0,
        clicks,
        conversionsPending: 0,
        conversionsConfirmed: 0,
        conversionsCancelled: 0,
        revenuePending: 0,
        revenueConfirmed: 0,
        revenueCancelled: 0,
        articleSlug,
      };
    });
  }

  /** /articles/{slug} → slug 抽出 */
  private extractSlugFromPath(pagePath: string): string | undefined {
    const match = pagePath.match(/^\/articles\/([^/?]+)/);
    return match?.[1];
  }

  private formatDate(yyyymmdd: string): string {
    return `${yyyymmdd.slice(0,4)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(6,8)}`;
  }

  async validateCredentials(): Promise<boolean> {
    return !!process.env.GA4_PROPERTY_ID &&
           !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }

  async isAvailable(): Promise<boolean> {
    return this.validateCredentials();
  }

  supportedGranularity() {
    return ['daily'] as const;
  }
}
```

### 7.3 BigQuery 代替クエリ

GA4 Data APIの制限（カスタムディメンション登録上限等）がある場合、BigQuery直接クエリで取得:

```sql
-- GA4 → BigQuery エクスポートからクリックデータ集計
SELECT
  PARSE_DATE('%Y%m%d', event_date) AS date,
  (SELECT value.string_value FROM UNNEST(event_params)
   WHERE key = 'asp_name') AS asp_name,
  (SELECT value.string_value FROM UNNEST(event_params)
   WHERE key = 'program_id') AS program_id,
  (SELECT value.string_value FROM UNNEST(event_params)
   WHERE key = 'page_path') AS page_path,
  COUNT(*) AS clicks
FROM
  `menscataly-analytics.analytics_XXXXXXX.events_*`
WHERE
  event_name = 'affiliate_link_click'
  AND _TABLE_SUFFIX BETWEEN @start_date AND @end_date
GROUP BY
  date, asp_name, program_id, page_path
ORDER BY
  date DESC, clicks DESC;
```

---

## 8. ReportSyncOrchestrator（バッチ同期）

### 8.1 実行フロー

```typescript
// src/lib/asp/reports/sync-orchestrator.ts

class ReportSyncOrchestrator {
  private providers: IASPReportProvider[];

  constructor(providers: IASPReportProvider[]) {
    this.providers = providers;
  }

  /**
   * 日次バッチ同期
   * Vercel Cron (23:00 JST) or Cloud Scheduler から呼び出し
   */
  async syncDaily(date?: string): Promise<SyncResult> {
    const targetDate = date ?? this.yesterday();
    const results: SyncResult = {
      date: targetDate,
      providers: [],
      totalRecords: 0,
      errors: [],
    };

    for (const provider of this.providers) {
      try {
        // 1. 利用可能性チェック
        if (!await provider.isAvailable()) {
          results.providers.push({
            aspName: provider.aspName,
            status: 'skipped',
            reason: 'Provider not available',
          });
          continue;
        }

        // 2. レポートデータ取得
        const records = await provider.fetchReport({
          startDate: targetDate,
          endDate: targetDate,
        });

        // 3. 記事紐付け補完
        const enriched = await this.enrichWithArticleSlug(records);

        // 4. Supabase upsert
        const upserted = await this.upsertToRevenueDailyTable(enriched);

        // 5. affiliate_links テーブルも更新 (集計値)
        await this.updateAffiliateLinksTotals(enriched);

        results.providers.push({
          aspName: provider.aspName,
          status: 'success',
          recordCount: upserted,
        });
        results.totalRecords += upserted;
      } catch (error) {
        results.errors.push({
          aspName: provider.aspName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /** affiliate_links の click_count, conversion_count, revenue を集計更新 */
  private async updateAffiliateLinksTotals(
    records: NormalizedReportRecord[]
  ): Promise<void> {
    // program_id ごとに集計
    const totals = new Map<string, {
      clicks: number;
      conversions: number;
      revenue: number;
    }>();

    for (const r of records) {
      const key = `${r.aspName}:${r.programId}`;
      const current = totals.get(key) ?? { clicks: 0, conversions: 0, revenue: 0 };
      current.clicks += r.clicks;
      current.conversions += r.conversionsConfirmed;
      current.revenue += r.revenueConfirmed;
      totals.set(key, current);
    }

    for (const [key, total] of totals) {
      const [aspName, programId] = key.split(':');
      await supabase.rpc('increment_affiliate_link_totals', {
        p_asp_name: aspName,
        p_program_id: programId,
        p_clicks: total.clicks,
        p_conversions: total.conversions,
        p_revenue: total.revenue,
      });
    }
  }

  /** revenue_daily テーブルへの upsert */
  private async upsertToRevenueDailyTable(
    records: NormalizedReportRecord[]
  ): Promise<number> {
    const rows = records.map(r => ({
      date: r.date,
      asp_name: r.aspName,
      program_id: r.programId,
      article_slug: r.articleSlug ?? null,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions_pending: r.conversionsPending,
      conversions_confirmed: r.conversionsConfirmed,
      conversions_cancelled: r.conversionsCancelled,
      revenue_pending: r.revenuePending,
      revenue_confirmed: r.revenueConfirmed,
      revenue_cancelled: r.revenueCancelled,
      source: 'api',
      raw_data: r.rawData ?? null,
    }));

    const { data, error } = await supabase
      .from('revenue_daily')
      .upsert(rows, {
        onConflict: 'date,asp_name,program_id,article_slug',
      });

    if (error) throw error;
    return rows.length;
  }

  private yesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
}
```

### 8.2 API Route

```typescript
// src/app/api/cron/sync-revenue/route.ts

export async function GET(request: Request) {
  // CRON_SECRET 認証
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orchestrator = new ReportSyncOrchestrator([
    new GA4ClickProvider(),
    new A8ReportProvider(),
    // Phase B以降: new AfbReportProvider(), etc.
  ]);

  const result = await orchestrator.syncDaily();
  return Response.json(result);
}
```

### 8.3 Vercel Cron 設定

```json
// vercel.json (追加)
{
  "crons": [
    {
      "path": "/api/cron/sync-revenue",
      "schedule": "0 14 * * *"
    }
  ]
}
```
> 14:00 UTC = 23:00 JST（PDCA分析バッチと同時刻）

---

## 9. CSVインポート機能（Phase A）

### 9.1 管理画面UI

```
/admin/revenue → CSVアップロード画面
  - ファイル選択 (A8レポートCSV)
  - ASP選択ドロップダウン
  - プレビュー表示 (パース結果確認)
  - インポート実行ボタン
```

### 9.2 API Route

```typescript
// src/app/api/admin/revenue/import/route.ts

export async function POST(request: Request) {
  // ADMIN認証
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const aspName = formData.get('asp_name') as AspName;

  const content = await file.text();
  const provider = getProvider(aspName);

  // CSVパース → 正規化 → upsert
  const records = await provider.importFromCSV(content);
  const orchestrator = new ReportSyncOrchestrator([]);
  const enriched = await orchestrator.enrichWithArticleSlug(records);
  const count = await orchestrator.upsertToRevenueDailyTable(enriched);

  return Response.json({ imported: count });
}
```

---

## 10. 環境変数一覧

### 既存（設定済み）
```
A8_MEDIA_ID=a26030485942
NEXT_PUBLIC_A8_MEDIA_ID=a26030485942
NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID=fNJlQopxWhdG8A68EM39
```

### 新規（Phase B以降で追加）
```
# A8.net 成果連携API
A8_REPORT_API_KEY=           # 成果連携API申請後に発行
A8_REPORT_API_ENDPOINT=      # API仕様書で確認

# afb
AFB_API_KEY=                 # 管理画面からAPIキー発行
AFB_API_ENDPOINT=            # 管理画面内ドキュメントで確認

# アクセストレード
ACCESSTRADE_API_KEY=         # 管理画面から発行
ACCESSTRADE_API_ENDPOINT=    # APIリファレンスで確認

# GA4 Data API
GA4_PROPERTY_ID=             # GA4プロパティID
GOOGLE_APPLICATION_CREDENTIALS=  # GCPサービスアカウントJSON

# バリューコマース
VALUECOMMERCE_API_KEY=       # 承認後に発行
VALUECOMMERCE_SID=           # サイトID
```

---

## 11. 実装ロードマップ

### Phase A（即時実装可能）
1. `revenue_daily` テーブル作成（migration SQL）
2. `IASPReportProvider` インターフェース定義
3. `GA4ClickProvider` 実装（GA4 Data APIでクリック数同期）
4. `A8ReportProvider` CSV インポート機能
5. 管理画面 `/admin/revenue` CSVアップロードUI
6. Vercel Cron `/api/cron/sync-revenue` (GA4クリック同期)

### Phase B（ASP申請・承認後）
1. A8.net 成果連携API 申請
2. afb 申請 → APIキー取得 → `AfbReportProvider` 実装
3. アクセストレード 申請 → `AccessTradeReportProvider` 実装
4. `ReportSyncOrchestrator` にプロバイダー追加

### Phase C（運用安定後）
1. バリューコマース API連携
2. felmat/もしも 対応
3. Looker Studioダッシュボード（BigQuery + revenue_daily）
4. アラート機能（CV急減通知）
5. 予測モデル（記事別ROI予測）

---

## 12. テスト戦略

```typescript
// テストケース概要
describe('A8ReportProvider', () => {
  it('A8 CSV を正しくパースできる');
  it('プログラム名 → program_id マッピングが正確');
  it('メンテナンス時間帯で isAvailable() = false');
  it('不正CSVでエラーハンドリング');
});

describe('GA4ClickProvider', () => {
  it('GA4 Data API レスポンスを正規化できる');
  it('pagePath から article_slug を正確に抽出');
  it('認証情報未設定で isAvailable() = false');
});

describe('ReportSyncOrchestrator', () => {
  it('複数プロバイダーを順次実行');
  it('1プロバイダー失敗でも他は継続');
  it('revenue_daily に正しく upsert');
  it('affiliate_links の集計値を更新');
  it('重複データは上書き（冪等性）');
});
```

---

## 参考情報

- [A8.net 確定API v3 仕様書](https://document.a8.net/a8docs/ecsales-api/v3/ecsales-api-v3.html)
- [A8.net 成果データ連携API 案内](https://a8pr.jp/2024/12/04/cvapi/)
- [A8.net レポートリニューアル](https://support.a8.net/as/campaign/report_renewal/)
- [afb API連携ガイド](https://www.afi-b.com/guide/api-linkage/)
- [アクセストレード APIリファレンス](https://www.accesstrade.ne.jp/faq/after/detail/528)
- [GA4 Data API Overview](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [GA4 Dimensions & Metrics](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
