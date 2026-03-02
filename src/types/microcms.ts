// microCMS 型定義
// microcms-js-sdk v3 に対応
// version: 2.0

// ============================================================
// microCMS 共通フィールド
// ============================================================

export interface MicroCMSDate {
  createdAt: string   // ISO 8601
  updatedAt: string
  publishedAt: string
  revisedAt: string
}

export interface MicroCMSImage {
  url: string
  height: number
  width: number
}

export interface MicroCMSRef<T = Record<string, unknown>> {
  id: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
  fieldId?: string
  [key: string]: unknown
  content?: T
}

// ============================================================
// カテゴリ
// ============================================================

export interface MicroCMSCategory extends MicroCMSDate {
  id: string
  name: string
  slug: string
  description?: string
  display_order?: number
}

// ============================================================
// 記事
// ============================================================

export interface MicroCMSArticle extends MicroCMSDate {
  id: string
  title: string
  slug?: string         // カスタムスラッグ (未設定時は id を使用)
  content: string       // リッチテキスト HTML
  excerpt?: string      // 抜粋 (プレーンテキスト)
  category?: MicroCMSCategory
  thumbnail?: MicroCMSImage
  seo_title?: string
  seo_description?: string
  author_name?: string
  tags?: string[]
  status?: 'published' | 'draft'
  is_pr?: boolean       // PR記事フラグ (ステマ規制対応)
}

// ============================================================
// microCMS リストレスポンス
// ============================================================

export interface MicroCMSListResponse<T> {
  contents: T[]
  totalCount: number
  offset: number
  limit: number
}

// ============================================================
// microCMS クエリパラメータ
// ============================================================

// MicroCMSArticleQueries: microcms-js-sdk の MicroCMSQueries を拡張
// depth は microcms-js-sdk の depthNumber (0|1|2|3) に合わせるため省略
export interface MicroCMSArticleQueries {
  draftKey?: string
  limit?: number
  offset?: number
  orders?: string        // e.g. '-publishedAt' (降順: prefix '-')
  q?: string             // 全文検索
  fields?: string        // カンマ区切りのフィールド絞り込み
  ids?: string           // カンマ区切りのID絞り込み
  filters?: string       // e.g. 'category[equals]aga'
  depth?: 0 | 1 | 2 | 3 // 参照コンテンツの取得深さ
  richEditorFormat?: 'html' | 'object'
  category?: string      // カテゴリスラッグでフィルタ (クライアント側で filters に変換)
}

// ============================================================
// Webhook ペイロード
// ============================================================

export interface MicroCMSWebhookContent {
  id: string
  title?: string
  slug?: string
  category?: Pick<MicroCMSCategory, 'id' | 'name' | 'slug'>
  status?: string[]
  [key: string]: unknown
}

export interface MicroCMSWebhookPayload {
  service: string
  api: string                       // API名 (e.g. 'articles')
  id: string                        // コンテンツID
  type: 'new' | 'edit' | 'delete'  // イベント種別
  contents?: {
    new?: {
      id: string
      status: string[]
      draftKey: string | null
      publishValue: MicroCMSWebhookContent | null
      draftValue: MicroCMSWebhookContent | null
    }
    old?: {
      id: string
      status: string[]
      draftKey: string | null
      publishValue: MicroCMSWebhookContent | null
      draftValue: MicroCMSWebhookContent | null
    }
  }
}
