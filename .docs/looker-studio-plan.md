# Looker Studio ダッシュボード設計書

## 概要

GA4 + BigQuery データが蓄積した後に構築する Looker Studio ダッシュボードの設計。
構築タイミング: GA4 BigQuery Export 開始から **1ヶ月後**（2026年4月上旬目安）。

---

## ダッシュボード構成（4ページ）

### Page 1: サイト概況

| 指標 | データソース | ビジュアライゼーション |
|------|-------------|----------------------|
| PV推移（日次/週次/月次） | BigQuery `events_*` | 折れ線グラフ |
| ユーザー数（新規/リピーター） | BigQuery `events_*` | 棒グラフ + スコアカード |
| セッション数 | BigQuery `events_*` | 折れ線グラフ |
| デバイス比率（PC/SP/タブレット） | BigQuery `events_*` | 円グラフ |
| 直帰率・平均セッション時間 | BigQuery `events_*` | スコアカード |
| ページ別PVランキング（Top 20） | BigQuery `events_*` | テーブル |

**フィルタ**: 日付範囲、デバイス、流入元

### Page 2: 記事パフォーマンス

| 指標 | データソース | ビジュアライゼーション |
|------|-------------|----------------------|
| 記事別 PV / CTR / CVR | BigQuery + Supabase `articles` | テーブル（ソート可能） |
| カテゴリ別集計（AGA/脱毛/スキンケア/ED/コラム） | BigQuery `events_*` | 棒グラフ |
| ヘルススコア分布 | Supabase `articles` | ヒストグラム |
| コンプライアンススコア分布 | Supabase `articles` | ヒストグラム |
| 記事公開数推移 | Supabase `articles` | 棒グラフ（月次） |
| 検索クエリ Top 50 | GSC API (BigQuery経由) | テーブル |

**フィルタ**: カテゴリ、日付範囲、ヘルススコア閾値

### Page 3: ASP収益

| 指標 | データソース | ビジュアライゼーション |
|------|-------------|----------------------|
| ASP別売上推移（月次） | Supabase `revenue_daily` | 積み上げ棒グラフ |
| コンバージョンファネル（表示→クリック→CV） | BigQuery + Supabase | ファネルチャート |
| クリック→CV率（ASP別） | Supabase `revenue_daily` | テーブル |
| 月次収益合計 | Supabase `revenue_daily` | スコアカード（目標30万円対比） |
| プログラム別成果ランキング | Supabase `revenue_daily` | テーブル |
| アフィリエイトリンククリック数 | BigQuery `events_*` (affiliate_link_click) | 折れ線グラフ |

**フィルタ**: ASP名、カテゴリ、日付範囲

### Page 4: コスト分析

| 指標 | データソース | ビジュアライゼーション |
|------|-------------|----------------------|
| API使用量推移（Claude API） | Supabase `generation_costs` | 折れ線グラフ |
| 記事単価（生成コスト / 記事数） | Supabase `generation_costs` | スコアカード + 推移グラフ |
| ROI（月次収益 / 月次APIコスト） | Supabase `revenue_daily` + `generation_costs` | スコアカード + 折れ線 |
| モデル別コスト内訳（Sonnet / Haiku） | Supabase `generation_costs` | 円グラフ |
| 月次コスト合計 | Supabase `generation_costs` | スコアカード |
| コスト対収益比率推移 | 計算フィールド | 折れ線グラフ |

**フィルタ**: 日付範囲、モデル名

---

## データソース

### BigQuery

- **プロジェクト**: `menscataly-analytics` (ID: 649938798660)
- **データセット**: `analytics_526721106`
- **テーブルパターン**: `events_*` (日付シャーディング, e.g. `events_20260308`)
- **リージョン**: asia-northeast1 (東京)

主要イベント:
- `page_view` — PV計測
- `session_start` — セッション計測
- `affiliate_link_click` — アフィリエイトリンククリック (カスタムイベント)
- `scroll` — スクロール深度

### Supabase (PostgreSQL)

- **接続方式**: Looker Studio PostgreSQL コネクタ
- **ホスト**: Supabase プロジェクトの接続情報を使用

主要テーブル:
- `revenue_daily` — ASP別日次収益データ
- `generation_costs` — 記事生成APIコスト
- `articles` — 記事メタデータ（ヘルススコア、コンプライアンススコア等）
- `asp_programs` — ASPプログラムマスタ

---

## KPI定義

### 収益KPI

| KPI | 計算式 | 目標値 |
|-----|--------|--------|
| 月次収益 | `SUM(revenue_daily.total_revenue_jpy)` WHERE month = target | 30万円/月 (12ヶ月以内) |
| CVR | `SUM(conversions) / SUM(clicks) * 100` | 3%以上 |
| EPC (1クリック当り収益) | `SUM(revenue) / SUM(clicks)` | 50円以上 |

### コストKPI

| KPI | 計算式 | 目標値 |
|-----|--------|--------|
| 記事単価 | `SUM(generation_costs.cost_usd) / COUNT(DISTINCT article_id)` | $0.50以下 |
| 月次APIコスト | `SUM(generation_costs.cost_usd)` WHERE month = target | $50以下 |
| ROI | `月次収益 / (月次APIコスト * 為替レート)` | 10倍以上 |

### コンテンツKPI

| KPI | 計算式 | 目標値 |
|-----|--------|--------|
| 平均ヘルススコア | `AVG(articles.health_score)` | 80以上 |
| コンプライアンス通過率 | `COUNT(compliance_score >= 70) / COUNT(*) * 100` | 95%以上 |
| 月間記事公開数 | `COUNT(articles)` WHERE published_at in month | 30記事/月 |

---

## 構築タイミング

| マイルストーン | 時期 | 内容 |
|---------------|------|------|
| データ蓄積開始 | 2026-03-05 (完了) | GA4 BigQuery Export 有効化 |
| 最低1ヶ月分蓄積 | 2026-04-05 | 日次データが30日分溜まる |
| ダッシュボード構築 | 2026-04-上旬 | Page 1-2 を先行構築 |
| 収益データ蓄積 | 2026-04-中旬 | ASP成果データが溜まり始める |
| 全ページ完成 | 2026-04-下旬 | Page 3-4 を追加、KPIアラート設定 |

---

## 接続設定手順

### BigQuery Connector

1. Looker Studio で「データを追加」→「BigQuery」を選択
2. GCPプロジェクト `menscataly-analytics` を選択
3. データセット `analytics_526721106` を選択
4. テーブル `events_*` を選択（日付シャーディング対応）
5. サービスアカウント `menscataly-api@menscataly-analytics.iam.gserviceaccount.com` に Looker Studio 用の権限を付与:
   - `roles/bigquery.dataViewer`
   - `roles/bigquery.jobUser`

### PostgreSQL Connector (Supabase)

1. Looker Studio で「データを追加」→「PostgreSQL」を選択
2. Supabase ダッシュボード → Settings → Database から接続情報を取得:
   - Host: `db.<project-ref>.supabase.co`
   - Port: `5432`
   - Database: `postgres`
   - Username: Supabase の DB ユーザー
   - Password: Supabase の DB パスワード
3. SSL を有効化（必須）
4. 必要なテーブルごとにデータソースを作成:
   - `revenue_daily`
   - `generation_costs`
   - `articles`

### 注意事項

- BigQuery のクエリコストに注意: 月間10万PV程度なら無料枠内に収まる見込み
- Supabase の接続数制限: Looker Studio からの同時接続は最小限にする
- データの鮮度: BigQuery は日次エクスポート（前日分）、Supabase はリアルタイム
- ダッシュボードの共有: チーム内のみ（外部公開しない）
