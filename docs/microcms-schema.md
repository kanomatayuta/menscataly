# microCMS スキーマ定義 v2.0

**プロジェクト**: MENS CATALY (menscataly.com)
**バージョン**: 2.0.0 (4エージェント議論反映版)
**更新日**: 2026-03-04

---

## 設計方針

1. **microCMS = 読者に届けるコンテンツ専用** (CDNキャッシュ対象)
2. **管理メタデータ (コスト・分析・ログ) は将来Supabaseへ**
3. **API枠は2つに抑える** (無料プラン上限3のうち1枠を将来用に確保)
4. **カテゴリはデータとして管理** → 追加・変更がスキーマ変更なしで可能

---

## API一覧

| # | API名 | エンドポイント | 種類 | 用途 |
|---|--------|---------------|------|------|
| 1 | `articles` | `GET /api/v1/articles` | リスト形式 | 記事コンテンツ |
| 2 | `categories` | `GET /api/v1/categories` | リスト形式 | カテゴリマスタ |
| 3 | `tags` | `GET /api/v1/tags` | リスト形式 | タグマスタ |

> **authors API は廃止** → 著者・監修者情報は articles API 内のテキストフィールドとして管理。
> 理由: 著者は「編集部」固定、監修者も数名で更新頻度が低い。API枠を節約し将来の拡張に備える。

---

## API 1: articles (記事)

**エンドポイント**: `GET /api/v1/articles`
**種類**: リスト形式

### 基本情報フィールド

| # | フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|---|
| 1 | `title` | タイトル | テキストフィールド | ✅ | 記事タイトル (最大100文字) |
| 2 | `slug` | スラッグ | テキストフィールド | ✅ | URL用スラッグ (半角英数・ハイフン) 例: `aga-online-clinic-comparison` |
| 3 | `content` | 本文 | リッチエディタ | ✅ | 記事本文 (HTML) |
| 4 | `excerpt` | 抜粋文 | テキストエリア | ✅ | 記事の要約文 (最大160文字)。meta description・OGP・カード表示に使用 |
| 5 | `category` | カテゴリ | コンテンツ参照 (categories) | ✅ | categories API への参照 |
| 6 | `article_type` | 記事タイプ | セレクトフィールド | ✅ | 記事の種類 (下記参照) |
| 7 | `tags` | タグ | 複数コンテンツ参照 (tags) | - | SEOタグ (tags APIへの参照) |
| 8 | `thumbnail` | サムネイル画像 | 画像 | ✅ | OGP・カード用 (1200×630px推奨) |

### SEOフィールド

| # | フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|---|
| 9 | `seo_title` | SEOタイトル | テキストフィールド | - | 検索結果用タイトル (最大60文字)。未設定時は `title` を使用 |
| 10 | `target_keyword` | ターゲットKW | テキストフィールド | - | メインキーワード (管理・分析用) |
| 11 | `reading_time` | 読了時間 | 数値 | - | 分単位。AI生成時に自動計算 |

### 著者・監修者フィールド (E-E-A-T対応)

| # | フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|---|
| 12 | `author_name` | 著者名 | テキストフィールド | ✅ | 通常は「MENS CATALY 編集部」固定 |
| 13 | `supervisor_name` | 監修者名 | テキストフィールド | - | 医師・専門家の氏名。YMYL記事(aga/ed/hair-removal)では必須 |
| 14 | `supervisor_creds` | 監修者資格 | テキストフィールド | - | 例: 「皮膚科専門医」「泌尿器科医」 |
| 15 | `supervisor_bio` | 監修者プロフィール | テキストエリア | - | 経歴・所属機関 (E-E-A-T強化) |
| 16 | `supervisor_image` | 監修者画像 | 画像 | - | プロフィール画像 (400×400px推奨) |

### 参考文献 (E-E-A-T対応)

| # | フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|---|
| 17 | `references` | 参考文献 | 繰り返しフィールド | - | 下記構造。YMYL記事では1件以上推奨 |

**`references` の繰り返し構造:**

| フィールドID | 表示名 | 種類 | 説明 |
|---|---|---|---|
| `ref_title` | 文献タイトル | テキスト | 論文・ガイドライン名 |
| `ref_url` | URL | テキスト | PubMed等のリンク |
| `ref_publisher` | 発行機関 | テキスト | 例: 日本皮膚科学会 |
| `ref_year` | 発行年 | テキスト | 例: 2024 |

### コンプライアンスフィールド (薬機法・景表法対応)

| # | フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|---|
| 18 | `is_pr` | PR記事 | 真偽値 | ✅ | true = PR表記を表示 (景表法・ステマ規制対応) |
| 19 | `disclaimer_type` | 免責事項タイプ | セレクトフィールド | ✅ | 免責事項テンプレートの選択 (下記参照) |
| 20 | `compliance_score` | コンプライアンススコア | 数値 | - | 0-100。AI生成時に自動算出。管理画面でのフィルタ用 |

**合計: 20フィールド** (microCMS上限30に対して余裕あり)

---

### `article_type` セレクト値

| 値 | 表示名 | 用途 |
|---|---|---|
| `clinic_comparison` | クリニック比較 | CVR最高。比較表・CTA重視 |
| `longtail` | ロングテール | 競合回避。情報提供型 |
| `column` | コラム | SNS拡散・リンク獲得。断言調 |
| `review` | レビュー・体験談 | E-E-A-T (Experience) 強化 |
| `guide` | ガイド・まとめ | 包括的な入門記事 |

> 将来追加可能: `ranking` (ランキング), `news` (ニュース), `interview` (インタビュー)

### `disclaimer_type` セレクト値

| 値 | 表示名 | 使用場面 |
|---|---|---|
| `medical_treatment` | 医療行為に関する免責 | AGA・ED・脱毛クリニック記事 |
| `medical_general` | 一般的な医療情報免責 | 医療知識系の解説記事 |
| `cosmetic` | 化粧品・効果の免責 | スキンケア・ヘアケア記事 |
| `none` | 免責なし | コラム・一般記事 |

> 将来追加可能: `supplement` (サプリメント免責), `diet` (ダイエット免責)

---

## API 2: categories (カテゴリ)

**エンドポイント**: `GET /api/v1/categories`
**種類**: リスト形式

### フィールド

| # | フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|---|
| 1 | `name` | カテゴリ名 | テキストフィールド | ✅ | 表示名 |
| 2 | `slug` | スラッグ | テキストフィールド | ✅ | URL用。半角英数・ハイフン |
| 3 | `description` | 説明文 | テキストエリア | - | カテゴリページのSEO用説明 |
| 4 | `display_order` | 表示順 | 数値 | - | 並び順 (小さい順) |
| 5 | `color` | テーマカラー | テキストフィールド | - | UIバッジの色指定 (例: `#D32F2F`) |

### 初期カテゴリデータ (Phase 2)

| slug | name | description | display_order |
|---|---|---|---|
| `aga` | AGA・薄毛 | AGA治療・薄毛ケアに関する記事 | 1 |
| `hair-removal` | メンズ脱毛 | 医療脱毛・ヒゲ脱毛に関する記事 | 2 |
| `skincare` | スキンケア | 男性向けスキンケア記事 | 3 |
| `ed` | ED治療 | ED治療に関する記事 | 4 |
| `column` | コラム | メンズ美容・ライフスタイルのコラム | 5 |

### 将来追加予定カテゴリ (Phase 5+)

| slug | name | 追加時期 | 備考 |
|---|---|---|---|
| `hair-style` | 理容・ヘアスタイル | Phase 5 | SNS拡散の入口記事 |
| `diet` | ダイエット | Phase 5 | 需要あるが薬機法リスク注意 |
| `supplement` | サプリ・栄養 | Phase 6 | 薬機法リスク最高、慎重に |
| `mental-health` | メンタルヘルス | Phase 7 | YMYL最重要カテゴリ |

> **カテゴリ追加はmicroCMS管理画面でデータを追加するだけ。スキーマ変更不要。**
> コード側は `ContentCategory` 型にユニオンを追加し、Badge色を設定するだけで対応完了。

---

## 将来の拡張性

### カテゴリ追加時の変更箇所 (コード側)

```typescript
// 1. src/types/content.ts — 型にユニオン追加
export type ContentCategory = "aga" | "hair-removal" | "skincare" | "ed" | "column"
  | "hair-style"  // ← 追加するだけ
  | "diet"        // ← 追加するだけ

// 2. src/components/ui/Badge.tsx — バッジ色追加
const categoryColors = {
  aga: "bg-red-100 text-red-800",
  "hair-style": "bg-green-100 text-green-800",  // ← 追加
  // ...
}

// 3. src/lib/asp/config.ts — ASPプログラム追加 (収益化する場合)
```

### API枠の将来利用

残り1枠の候補:

| API名候補 | 用途 | 追加時期 |
|---|---|---|
| `clinics` | クリニック構造化データ (名前/住所/価格/URL) | Phase 4 |
| `products` | 商品比較データ | Phase 5 |
| `faqs` | FAQ構造化データ (JSON-LD生成用) | Phase 3 |

> 有料プラン (Team: 4,900円/月) にアップグレードすれば10 APIまで利用可能

---

## microCMS ↔ コード 対応表

| microCMS フィールドID | TypeScript 型 (`MicroCMSArticle`) | 変換先 (`Article`) |
|---|---|---|
| `title` | `title: string` | `title` |
| `slug` | `slug: string` | `slug` |
| `content` | `content: string` | `content` (HTML→MD変換) |
| `excerpt` | `excerpt: string` | `seo.description` / `lead` |
| `category` | `category: MicroCMSCategory` | `category: ContentCategory` |
| `article_type` | `article_type: string` | — (フロント表示切替用) |
| `tags` | `tags: MicroCMSTag[]` | `tags` |
| `thumbnail` | `thumbnail: MicroCMSImage` | `seo.ogImage` |
| `seo_title` | `seo_title: string` | `seo.title` |
| `target_keyword` | `target_keyword: string` | — (管理用) |
| `reading_time` | `reading_time: number` | `readingTime` |
| `author_name` | `author_name: string` | `author.name` |
| `supervisor_name` | `supervisor_name: string` | `supervisor.name` |
| `supervisor_creds` | `supervisor_creds: string` | `supervisor.credentials` |
| `supervisor_bio` | `supervisor_bio: string` | `supervisor.bio` |
| `supervisor_image` | `supervisor_image: MicroCMSImage` | `supervisor.imageUrl` |
| `references` | `references: Reference[]` | `references` |
| `is_pr` | `is_pr: boolean` | `hasPRDisclosure` |
| `disclaimer_type` | `disclaimer_type: string` | — (フロント免責表示用) |
| `compliance_score` | `compliance_score: number` | `complianceScore` |

---

## バリデーションルール (パイプライン側で実装)

| ルール | 条件 | アクション |
|--------|------|-----------|
| YMYL監修者必須 | category が `aga`/`ed`/`hair-removal` かつ `supervisor_name` 未設定 | 公開ブロック → draft保存 |
| コンプライアンス閾値 | `compliance_score` < 80 | 公開ブロック → draft保存 |
| PR表記整合性 | `is_pr` = true の記事 | フロントで必ず「PR」ラベル表示 + rel="sponsored" |
| 参考文献推奨 | YMYL記事で `references` = 0件 | 警告ログ (ブロックはしない) |
| タイトル長 | `title` > 60文字 | 警告 (SEO的に長すぎる) |
| 抜粋長 | `excerpt` > 160文字 | 警告 (meta descriptionが切れる) |

---

## 注意事項

- `is_pr` が true の記事は、フロントエンドで必ずPR表記を表示すること (景表法・ステマ規制対応)
- `supervisor_name` が未設定のYMYL記事は、パイプラインの公開前バリデーションで draft として保存すること
- `references` は最低1件以上設定することを推奨 (E-E-A-T対応)
- `compliance_score` が80未満の記事は自動公開せず、人間レビューを経ること
- microCMS の `revisedAt` (システムフィールド) を記事更新日として使用。カスタム `updated_at` は不要
