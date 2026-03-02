// microCMS 型定義
// microCMS Webhook ペイロードおよびコンテンツ型

// ============================================================
// microCMS Webhook ペイロード型
// ============================================================

export interface MicroCMSWebhookPayload {
  /** API識別子 (例: "articles") */
  api: string
  /** コンテンツID */
  id: string
  /** イベント種別 */
  type: 'new' | 'edit' | 'delete'
  /** コンテンツデータ */
  contents?: {
    new?: {
      /** 公開中のコンテンツ */
      publishValue?: MicroCMSArticle | null
      /** 下書きコンテンツ */
      draftValue?: MicroCMSArticle | null
    }
    old?: {
      publishValue?: MicroCMSArticle | null
      draftValue?: MicroCMSArticle | null
    }
  }
}

// ============================================================
// microCMS カテゴリ型
// ============================================================

export interface MicroCMSCategory {
  id: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
  name: string
  slug: string
}

// ============================================================
// microCMS 監修者型
// ============================================================

export interface MicroCMSSupervisor {
  id: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
  name: string
  title: string
  profile?: string
  imageUrl?: string
}

// ============================================================
// microCMS 画像型
// ============================================================

export interface MicroCMSImage {
  url: string
  width: number
  height: number
}

// ============================================================
// microCMS 記事型
// ============================================================

export interface MicroCMSArticle {
  id: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
  title: string
  /** リッチテキスト本文 (HTML文字列) */
  content: string
  /** リード文 / 記事概要 */
  excerpt?: string
  /** カテゴリ（リレーション） */
  category?: MicroCMSCategory
  /** アイキャッチ画像 */
  eyecatch?: MicroCMSImage
  /** 監修者（リレーション） */
  supervisor?: MicroCMSSupervisor
  /** タグ */
  tags?: string[]
}

// ============================================================
// microCMS APIレスポンス型
// ============================================================

export interface MicroCMSListResponse<T> {
  contents: T[]
  totalCount: number
  offset: number
  limit: number
}

export type MicroCMSArticleListResponse = MicroCMSListResponse<MicroCMSArticle>
