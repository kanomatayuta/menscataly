# microCMS スキーマ定義

**プロジェクト**: MENS CATALY
**バージョン**: 1.0.0
**作成日**: 2026-03-02

---

## 概要

メンズカタリで使用するmicroCMS APIのスキーマ定義。
薬機法・景表法・E-E-A-T要件を満たすフィールド構成。

---

## 1. articles API

**エンドポイント**: `GET /api/v1/articles`
**種類**: リスト形式

| フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|
| `title` | タイトル | テキストフィールド | ✅ | 記事タイトル (最大100文字) |
| `body` | 本文 | リッチエディタ | ✅ | 記事本文 (HTML) |
| `category` | カテゴリ | コンテンツ参照 | ✅ | categoriesAPIへの参照 |
| `tags` | タグ | テキストフィールド (複数) | - | SEOタグ (最大10件) |
| `thumbnail` | サムネイル | 画像 | ✅ | OGP用画像 (1200×630px推奨) |
| `author` | 著者 | コンテンツ参照 | ✅ | authorsAPIへの参照 |
| `supervisor` | 監修者 | コンテンツ参照 | - | authorsAPIへの参照 (医師・専門家) |
| `references` | 参考文献 | 繰り返しフィールド | - | 参考URL・書籍情報 |
| `pr_label` | PR表記 | セレクトフィールド | ✅ | `none` / `pr` / `ad` / `sponsored` |
| `updated_at` | 最終更新日 | 日時 | ✅ | 記事内容の最終更新日 |

### `references` 繰り返しフィールドの構造

```json
{
  "title": "参考文献タイトル",
  "url": "https://example.com",
  "publisher": "発行機関名",
  "published_at": "2025-01-01"
}
```

### `pr_label` の値

| 値 | 表示テキスト | 用途 |
|---|---|---|
| `none` | なし | 通常記事 |
| `pr` | PR | アフィリエイト含む記事 |
| `ad` | 広告 | 純広告記事 |
| `sponsored` | Sponsored | スポンサードコンテンツ |

---

## 2. categories API

**エンドポイント**: `GET /api/v1/categories`
**種類**: リスト形式

| フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|
| `name` | カテゴリ名 | テキストフィールド | ✅ | 表示名 (例: AGA・薄毛) |
| `slug` | スラッグ | テキストフィールド | ✅ | URL用スラッグ (例: aga) |
| `description` | 説明 | テキストエリア | - | カテゴリ説明文 (SEO用) |

### カテゴリ一覧 (初期データ)

| slug | name | 説明 |
|---|---|---|
| `aga` | AGA・薄毛 | AGA治療・薄毛ケアに関する記事 |
| `skin` | スキンケア | 男性向けスキンケア記事 |
| `ed` | ED・性機能 | ED治療に関する記事 |
| `diet` | ダイエット | 男性向けダイエット記事 |
| `supplement` | サプリ・栄養 | サプリメント・栄養に関する記事 |
| `clinic` | クリニック | 医療機関情報記事 |

---

## 3. authors API

**エンドポイント**: `GET /api/v1/authors`
**種類**: リスト形式

| フィールドID | 表示名 | 種類 | 必須 | 説明 |
|---|---|---|---|---|
| `name` | 氏名 | テキストフィールド | ✅ | フルネーム |
| `credentials` | 資格・肩書 | テキストフィールド (複数) | - | 例: 医師・皮膚科専門医 |
| `profile_image` | プロフィール画像 | 画像 | ✅ | 正方形推奨 (400×400px) |
| `bio` | プロフィール | テキストエリア | ✅ | 経歴・専門領域 (E-E-A-T対応) |

### E-E-A-T 要件

監修者 (`supervisor`) フィールドは YMYL コンテンツ (医療・美容) において必須。
以下の情報を `bio` に含めること：

- 学歴・専門医資格
- 所属機関
- 専門領域
- 著書・論文実績 (あれば)

---

## API レスポンス例

### `GET /api/v1/articles/[id]`

```json
{
  "id": "article_abc123",
  "title": "AGAとは？原因・症状・治療法を医師が解説",
  "body": "<h2>AGAとは</h2><p>...</p>",
  "category": {
    "id": "cat_001",
    "name": "AGA・薄毛",
    "slug": "aga"
  },
  "tags": ["AGA", "薄毛", "フィナステリド"],
  "thumbnail": {
    "url": "https://images.microcms-assets.io/...",
    "width": 1200,
    "height": 630
  },
  "author": {
    "id": "author_001",
    "name": "編集部",
    "profile_image": { "url": "..." },
    "bio": "メンズカタリ編集部..."
  },
  "supervisor": {
    "id": "author_002",
    "name": "田中 太郎",
    "credentials": ["医師", "皮膚科専門医"],
    "profile_image": { "url": "..." },
    "bio": "○○大学医学部卒業..."
  },
  "references": [
    {
      "title": "AGAの診断と治療ガイドライン",
      "url": "https://example.org/guideline",
      "publisher": "日本皮膚科学会",
      "published_at": "2024-01-01"
    }
  ],
  "pr_label": "pr",
  "updated_at": "2026-03-01T00:00:00.000Z",
  "createdAt": "2026-01-15T09:00:00.000Z",
  "revisedAt": "2026-03-01T00:00:00.000Z"
}
```

---

## Supabase連携

microCMS の `id` (文字列) を Supabase の `articles.microcms_id` で紐付け。
ISRキャッシュ更新時に webhook → Supabase の `articles` テーブルを同期。

```
microCMS (記事公開) → Webhook → Next.js API Route
                                  ↓
                            Supabase articles テーブル更新
                            (microcms_id, title, slug, category, updated_at)
```

---

## 注意事項

- `pr_label` が `pr` / `ad` / `sponsored` の場合、フロントエンドで必ずPR表記を表示すること (景表法・ステマ規制対応)
- `supervisor` が未設定の場合、YMYL記事として公開しないこと
- `references` は最低1件以上設定することを推奨 (E-E-A-T対応)
