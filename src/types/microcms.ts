// microCMS API 型定義
// ドキュメント: docs/microcms-schema.md

export type PrLabel = 'none' | 'pr' | 'ad' | 'sponsored'

export interface MicroCMSImage {
  url: string
  width: number
  height: number
}

export interface MicroCMSListResponse<T> {
  contents: T[]
  totalCount: number
  offset: number
  limit: number
}

// ============================================================
// authors API
// ============================================================
export interface Author {
  id: string
  name: string
  credentials: string[]
  profile_image: MicroCMSImage
  bio: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
}

// ============================================================
// categories API
// ============================================================
export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
}

// ============================================================
// articles API
// ============================================================
export interface Reference {
  fieldId: string
  title: string
  url: string
  publisher?: string
  published_at?: string
}

export interface Article {
  id: string
  title: string
  body: string
  category: Category
  tags: string[]
  thumbnail: MicroCMSImage
  author: Author
  supervisor?: Author
  references: Reference[]
  pr_label: PrLabel
  updated_at: string
  createdAt: string
  updatedAt: string
  publishedAt: string
  revisedAt: string
}

// 一覧取得時の軽量型 (body除外)
export type ArticleSummary = Omit<Article, 'body' | 'references'>

// microCMS Webhook ペイロード
export interface MicroCMSWebhookPayload {
  service: string
  api: string
  id: string
  type: 'new' | 'edit' | 'delete'
  contents?: {
    new?: { publishValue?: Article; draftValue?: Article }
    old?: { publishValue?: Article; draftValue?: Article }
  }
}
