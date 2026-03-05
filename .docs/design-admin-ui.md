# 管理画面 UI/UX 設計書 — トレンドチャート・ランキング

> 対象ページ: `/admin/articles`
> 作成日: 2026-03-05
> ステータス: 設計完了 → 実装待ち

---

## 1. 現状分析

### 既存コンポーネント
| コンポーネント | 種別 | 場所 |
|---|---|---|
| `ArticleTable` | Server Component | `src/components/admin/ArticleTable.tsx` |
| `StatCard` | Server Component | `src/components/admin/StatCard.tsx` |
| `RevenueChart` | Client Component (`"use client"`) | `src/components/admin/RevenueChart.tsx` |
| `PipelineSuccessChart` | Client Component (`"use client"`) | `src/components/admin/PipelineSuccessChart.tsx` |
| `AdminHeader` | Server Component | `src/components/admin/AdminHeader.tsx` |

### 既存 recharts 使用パターン
- `ResponsiveContainer` で width="100%" height={250-300}
- `CartesianGrid` strokeDasharray="3 3" stroke="#e5e7eb"
- `XAxis`/`YAxis`: fontSize 12, fill "#6b7280", tickLine false
- `Tooltip`: 白背景, border #e5e7eb, borderRadius 8px, fontSize 12px
- カード: `rounded-lg border border-neutral-200 bg-white p-4 shadow-sm`

### データソース
- **analytics_daily** テーブル: `article_id, date, pageviews, unique_users, bounce_rate, ctr, conversions`
- **affiliate_links** テーブル: `article_id, click_count, conversion_count, revenue`
- **fetchAnalyticsData()** (page.tsx:53-110): 30日間の PV + affiliate集計を `Map<string, ArticleAnalytics>` で返却

---

## 2. ページレイアウト設計

```
┌─────────────────────────────────────────────────────────────┐
│ AdminHeader: "記事管理"                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ 総PV       │ │ 総クリック │ │ 総CV       │ │ 総収益   │ │
│  │ 12,345     │ │ 2,890      │ │ 45         │ │ ¥89,000  │ │
│  │ +12% vs先月│ │ +8% vs先月 │ │ +5%        │ │ +15%     │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│                                                             │
│  ┌──────────────────────────────┬──────────────────────────┐│
│  │ トレンドチャート              │ ランキング               ││
│  │ [7日] [30日] [90日]          │ [PV] [CTR] [収益]        ││
│  │                              │                          ││
│  │  📈 PV + クリック + CV       │  1. 記事タイトルA  ↑ 2   ││
│  │  (LineChart, 複数ライン)     │  2. 記事タイトルB  → 0   ││
│  │                              │  3. 記事タイトルC  ↓ 1   ││
│  │  height: 300px               │  ...                     ││
│  │                              │  10. 記事タイトルJ ↑ 3   ││
│  └──────────────────────────────┴──────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ArticleTable (ソート可能)                                ││
│  │ タイトル | カテゴリ | コンプラ | ステータス | PV↕ ...   ││
│  │ ─────────────────────────────────────────────────────── ││
│  │ ...                                                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### レスポンシブ対応
| ブレークポイント | レイアウト |
|---|---|
| `lg` (1024px+) | サマリーカード 4列 / チャート+ランキング 横並び (7:5) |
| `sm`-`md` (640-1023px) | サマリーカード 2列 / チャート+ランキング 縦積み |
| `< sm` (〜639px) | サマリーカード 1列 / すべて縦積み |

---

## 3. コンポーネント設計

### 3.1 AnalyticsSummaryCards (Server Component)

**ファイル**: `src/components/admin/AnalyticsSummaryCards.tsx`

```typescript
interface AnalyticsSummaryCardsProps {
  totalPageviews: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  // 前期比（オプション、データ蓄積後に有効化）
  pageviewsChange?: number;  // パーセント
  clicksChange?: number;
  conversionsChange?: number;
  revenueChange?: number;
}
```

- 既存 `StatCard` を4つ並べるラッパー
- `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4`
- 収益カードは `variant="success"` (収益 > 0 の場合)
- 前期比: 正数は緑 `+12%`、負数は赤 `-5%`、0 はグレー `±0%`

### 3.2 TrendChart (Client Component)

**ファイル**: `src/components/admin/TrendChart.tsx`

```typescript
"use client";

interface TrendDataPoint {
  date: string;         // "3/1", "3/2" etc.
  pageviews: number;
  clicks: number;
  conversions: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  period: 7 | 30 | 90;
  onPeriodChange: (period: 7 | 30 | 90) => void;
}
```

**recharts 構成**:
- `LineChart` + `ResponsiveContainer` (height: 300)
- 3本のライン:
  - PV: `stroke="#3b82f6"` (blue-500) — 左Y軸
  - クリック: `stroke="#10b981"` (emerald-500) — 左Y軸
  - CV: `stroke="#f59e0b"` (amber-500) — 右Y軸 (スケールが異なるため)
- `YAxis` 左: PV・クリック用、`YAxis` 右 (yAxisId="right"): CV用
- 期間選択タブ: `7日 / 30日 / 90日` — ボタンスタイル:
  - Active: `bg-neutral-900 text-white`
  - Inactive: `bg-white text-neutral-600 hover:bg-neutral-100`
  - `rounded-lg px-3 py-1.5 text-sm font-medium`
- ツールチップ: 日付 + 各指標値をフォーマット表示

**データフロー**:
```
page.tsx (Server) → fetchTrendData(period) → TrendChartWrapper (Client)
                                                ↓
                                       TrendChart (recharts)
```

期間切替はクライアントで `useState` 管理 → `useEffect` で API 呼び出し、
または Server Actions 経由でデータ再取得。

初期実装では30日固定データをSSR、期間切替はフェーズ2で API Route追加。

### 3.3 ArticleRanking (Server Component)

**ファイル**: `src/components/admin/ArticleRanking.tsx`

```typescript
interface RankingItem {
  rank: number;
  articleId: string;
  title: string;
  slug: string;
  value: number;          // PV数 or CTR or 収益額
  previousRank?: number;  // 前期の順位（変動表示用）
}

type RankingTab = "pageviews" | "ctr" | "revenue";

interface ArticleRankingProps {
  rankings: Record<RankingTab, RankingItem[]>;
}
```

**UI仕様**:
- タブ: `[PV] [クリック率] [収益]`
  - タブスタイル: 下線アクティブ (`border-b-2 border-neutral-900`)
- リスト: 1〜10位
  - 各行: `rank | title (truncate) | value | 変動`
  - 変動インジケータ:
    - `↑ N` (緑 text-green-600): 順位上昇
    - `↓ N` (赤 text-red-600): 順位下降
    - `→` (グレー text-neutral-400): 変動なし
    - `NEW` (青 text-blue-600): 新規ランクイン
  - 1位: `font-bold` + 左ボーダー `border-l-4 border-amber-400`
  - 2〜3位: `font-semibold`
- タイトルクリックで `/admin/articles/[id]` に遷移
- 値フォーマット:
  - PV: `toLocaleString("ja-JP")` (例: 1,234)
  - CTR: `(value * 100).toFixed(1) + "%"` (例: 3.2%)
  - 収益: `¥${value.toLocaleString("ja-JP")}` (例: ¥12,000)

**初期実装**: タブはクライアントサイドで `useState` 切替。
ランキングデータはSSRで全タブ分を事前計算して渡す。

### 3.4 ArticleTable 拡張 (既存ファイル修正)

**ファイル**: `src/components/admin/ArticleTable.tsx` (既存)

#### 変更点

**a) ソート機能追加**:
- Client Componentに変更 (`"use client"` 追加)
- `useState` でソートカラム・方向管理
- ソート可能カラム: `pageviews`, `clicks`, `conversions`, `revenue`
- ヘッダークリックでソートトグル (asc → desc → none)
- ソートアイコン: `▲▼` (アクティブ時はハイライト)

```typescript
type SortColumn = "pageviews" | "clicks" | "conversions" | "revenue" | null;
type SortDirection = "asc" | "desc";

const [sortColumn, setSortColumn] = useState<SortColumn>(null);
const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
```

**b) 数値表示改善**:
- 値が0の場合: `<span className="text-neutral-300">-</span>`
- 収益が ¥1,000 以上: `<span className="font-bold text-green-700">¥1,000</span>`
- 収益が ¥10,000 以上: 上記に加えて `bg-green-50 rounded px-1`

**c) ソート可能ヘッダーのスタイル**:
```typescript
// ヘッダーセルコンポーネント
function SortableHeader({ label, column, active, direction, onClick }) {
  return (
    <th
      className="px-4 py-3 font-medium text-neutral-600 text-right cursor-pointer
                 hover:text-neutral-900 hover:bg-neutral-100 select-none"
      onClick={() => onClick(column)}
    >
      {label}
      <span className="ml-1 text-xs">
        {active ? (direction === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  );
}
```

---

## 4. データ取得設計

### 4.1 トレンドデータ取得

**新規関数**: `fetchTrendData(days: number)` in `page.tsx`

```typescript
interface TrendDataPoint {
  date: string;
  pageviews: number;
  clicks: number;
  conversions: number;
}

async function fetchTrendData(days: number): Promise<TrendDataPoint[]> {
  // Supabase: analytics_daily を date で GROUP BY
  // SELECT date, SUM(pageviews), SUM(conversions) FROM analytics_daily
  // WHERE date >= NOW() - days
  // GROUP BY date ORDER BY date ASC

  // affiliate_links からクリック数は日次粒度がないため、
  // 初期実装では analytics_daily.ctr * pageviews で概算
  // Phase 2 で affiliate_clicks_daily テーブル追加
}
```

### 4.2 ランキングデータ取得

**新規関数**: `fetchRankingData()` in `page.tsx`

```typescript
async function fetchRankingData(): Promise<Record<RankingTab, RankingItem[]>> {
  // 既存の fetchAnalyticsData() の結果を再利用
  // Map<string, ArticleAnalytics> → ソート → Top 10 抽出

  // PVランキング: sort by pageviews desc
  // CTRランキング: sort by (clicks / pageviews) desc (pageviews > 0)
  // 収益ランキング: sort by revenue desc
}
```

### 4.3 サマリーデータ

既存の `fetchAnalyticsData()` 結果から集計:
```typescript
const totalPageviews = [...analytics.values()].reduce((s, a) => s + a.pageviews, 0);
const totalClicks = [...analytics.values()].reduce((s, a) => s + a.clicks, 0);
const totalConversions = [...analytics.values()].reduce((s, a) => s + a.conversions, 0);
const totalRevenue = [...analytics.values()].reduce((s, a) => s + a.revenue, 0);
```

---

## 5. page.tsx 改修設計

### 新しいページ構造

```tsx
export default function AdminArticlesPage() {
  return (
    <>
      <AdminHeader title="記事管理" breadcrumbs={[{ label: "記事管理" }]} />

      {/* サマリーカード */}
      <Suspense fallback={<SummaryCardsSkeleton />}>
        <ArticlesSummarySection />
      </Suspense>

      {/* トレンドチャート + ランキング */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Suspense fallback={<ChartSkeleton />}>
            <TrendChartSection />
          </Suspense>
        </div>
        <div className="lg:col-span-5">
          <Suspense fallback={<RankingSkeleton />}>
            <RankingSection />
          </Suspense>
        </div>
      </div>

      {/* 記事テーブル */}
      <div className="mt-6">
        <Suspense fallback={<TableSkeleton />}>
          <ArticlesTableSection />
        </Suspense>
      </div>
    </>
  );
}
```

### Suspense境界

各セクションを独立した async Server Component にして Suspense でラップ:
- `ArticlesSummarySection`: サマリーカード4枚
- `TrendChartSection`: トレンドグラフ (内部で Client Component をレンダリング)
- `RankingSection`: ランキング Top 10
- `ArticlesTableSection`: ソート可能テーブル

データ取得は各セクションで独立して `Promise.all` せず、
PPR の streaming を活用してセクションごとに漸進的に表示。

### スケルトンUI

```tsx
function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-200" />
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[380px] animate-pulse rounded-lg bg-neutral-200" />;
}

function RankingSkeleton() {
  return <div className="h-[380px] animate-pulse rounded-lg bg-neutral-200" />;
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-neutral-200" />
      ))}
    </div>
  );
}
```

---

## 6. カラーパレット

既存コードベースのカラー規約に準拠:

| 用途 | カラー | Tailwind |
|---|---|---|
| PV ライン | Blue 500 | `text-blue-500` / `#3b82f6` |
| クリックライン | Emerald 500 | `text-emerald-500` / `#10b981` |
| CV ライン | Amber 500 | `text-amber-500` / `#f59e0b` |
| 収益ハイライト | Green 700 | `text-green-700` |
| ランク上昇 | Green 600 | `text-green-600` |
| ランク下降 | Red 600 | `text-red-600` |
| ランク変動なし | Neutral 400 | `text-neutral-400` |
| 新規ランクイン | Blue 600 | `text-blue-600` |
| カードボーダー | Neutral 200 | `border-neutral-200` |
| 背景 | White / Neutral 50 | `bg-white` / `bg-neutral-50` |

---

## 7. 型定義追加

**ファイル**: `src/types/admin.ts` に追記

```typescript
// ============================================================
// トレンド・ランキング
// ============================================================

/** トレンドチャート用データポイント */
export interface TrendDataPoint {
  date: string;
  pageviews: number;
  clicks: number;
  conversions: number;
}

/** ランキングタブ種別 */
export type RankingTab = "pageviews" | "ctr" | "revenue";

/** ランキングアイテム */
export interface RankingItem {
  rank: number;
  articleId: string;
  title: string;
  slug: string;
  value: number;
  formattedValue: string;
  previousRank?: number;
}

/** ランキングデータ（全タブ分） */
export type RankingData = Record<RankingTab, RankingItem[]>;

/** サマリーカードデータ */
export interface ArticlesSummary {
  totalPageviews: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  pageviewsChange?: number;
  clicksChange?: number;
  conversionsChange?: number;
  revenueChange?: number;
}
```

---

## 8. ファイル一覧 (実装時に作成/変更)

| ファイル | 操作 | 説明 |
|---|---|---|
| `src/types/admin.ts` | 変更 | 型定義追加 |
| `src/components/admin/AnalyticsSummaryCards.tsx` | 新規 | サマリーカード4枚 |
| `src/components/admin/TrendChart.tsx` | 新規 | recharts LineChart (Client) |
| `src/components/admin/ArticleRanking.tsx` | 新規 | ランキング Top 10 (タブ付き Client) |
| `src/components/admin/ArticleTable.tsx` | 変更 | ソート機能 + 数値表示改善 |
| `src/app/admin/articles/page.tsx` | 変更 | レイアウト再構成 + データ取得追加 |

---

## 9. 実装優先度

| 順序 | コンポーネント | 理由 |
|---|---|---|
| 1 | 型定義追加 | 全コンポーネントの基盤 |
| 2 | AnalyticsSummaryCards | 既存 StatCard 再利用で低コスト |
| 3 | ArticleTable 拡張 | 既存コード修正、即効性あり |
| 4 | ArticleRanking | 既存データから計算可能 |
| 5 | TrendChart | analytics_daily にデータ蓄積後に有効 |
| 6 | page.tsx レイアウト統合 | 全コンポーネント完成後 |

---

## 10. 将来拡張 (Phase 2 以降)

- **期間切替 API Route**: `/api/admin/articles/trend?days=7|30|90`
- **記事別トレンド**: 記事詳細ページに個別チャート追加
- **affiliate_clicks_daily テーブル**: 日次クリック粒度の正確なトレンド
- **前期比計算**: 30日前のランキングと比較 → 順位変動インジケータ
- **エクスポート**: CSV ダウンロードボタン
- **リアルタイム更新**: Server-Sent Events でダッシュボード自動更新
