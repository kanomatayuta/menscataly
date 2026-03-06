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
  color?: string         // UIバッジの色指定 (例: #D32F2F)
}

// ============================================================
// タグ
// ============================================================

export interface MicroCMSTag extends MicroCMSDate {
  id: string
  name: string
  slug: string
}

// ============================================================
// 参考文献 (繰り返しフィールド)
// ============================================================

export interface MicroCMSReference {
  fieldId: string
  ref_title?: string
  ref_url?: string
  ref_publisher?: string
  ref_year?: string
}

// ============================================================
// 記事
// ============================================================

export interface MicroCMSArticle extends MicroCMSDate {
  id: string
  // 基本情報
  title: string
  slug?: string                // カスタムスラッグ (未設定時は id を使用)
  content: string              // リッチテキスト HTML
  excerpt?: string             // 抜粋 (プレーンテキスト, 最大160文字)
  category?: MicroCMSCategory  // コンテンツ参照
  article_type?: string        // セレクト: クリニック比較/ロングテール/コラム/レビュー・体験談/ガイド・まとめ
  tags?: MicroCMSTag[]         // 複数コンテンツ参照 (tags API)
  thumbnail?: MicroCMSImage    // OGP・カード用 (1200×630px) — microCMS管理画面から手動設定用
  thumbnail_url?: string       // 外部画像URL (Cloudinary等) — AI自動生成時に使用
  // SEO
  seo_title?: string           // 検索結果用タイトル (最大60文字)
  seo_description?: string     // 検索結果用ディスクリプション (最大160文字)
  target_keyword?: string      // メインキーワード (管理用)
  reading_time?: number        // 読了時間 (分)
  // 著者・監修者 (E-E-A-T)
  author_name?: string         // 通常「MENS CATALY 編集部」
  supervisor_name?: string     // 医師・専門家の氏名
  supervisor_creds?: string    // 監修者資格 (例: 皮膚科専門医)
  supervisor_bio?: string      // 監修者プロフィール
  supervisor_image?: MicroCMSImage // 監修者画像 (400×400px)
  // 参考文献 (E-E-A-T)
  references?: MicroCMSReference[] // 繰り返しフィールド
  // コンプライアンス
  is_pr?: boolean              // PR記事フラグ (景表法・ステマ規制対応)
  disclaimer_type?: string     // セレクト: 医療行為に関する免責/一般的な医療情報免責/化粧品・効果の免責/免責なし
  compliance_score?: number    // 0-100 (AI生成時に自動算出)
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
