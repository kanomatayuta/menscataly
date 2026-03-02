// Supabase PostgreSQL 型定義
// schema.sql から手動生成 (src/lib/db/schema.sql 参照)
// version: 2.0

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ============================================================
// ENUM 型
// ============================================================

export type ArticleStatus = 'draft' | 'published' | 'archived'

export type ComplianceCheckType = 'yakuji_ho' | 'keihyo_ho' | 'ymyl' | 'stealth_marketing'

export type ComplianceResult = 'passed' | 'warning' | 'failed'

// ============================================================
// テーブル行型 (Row)
// ============================================================

export interface CategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
  created_at: string
  updated_at: string
}

export interface ArticleRow {
  id: string
  microcms_id: string | null
  slug: string
  title: string
  content: string | null
  excerpt: string | null
  category: string
  category_id: string | null
  status: ArticleStatus
  seo_title: string | null
  seo_description: string | null
  author_name: string
  quality_score: number
  pv_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface KeywordRow {
  id: string
  keyword: string
  search_volume: number
  difficulty: number
  trend_score: number
  category: string
  category_id: string | null
  tracked_at: string
  created_at: string
  updated_at: string
}

export interface AnalyticsDailyRow {
  id: string
  article_id: string
  date: string        // ISO 8601 date string (YYYY-MM-DD)
  pageviews: number
  unique_users: number
  avg_time: number    // seconds
  bounce_rate: number // 0.0000 ~ 1.0000
  ctr: number         // 0.0000 ~ 1.0000
  conversions: number
  created_at: string
}

export interface AffiliateLinkRow {
  id: string
  article_id: string | null
  asp_name: string
  program_name: string
  url: string
  click_count: number
  conversion_count: number
  revenue: number
  created_at: string
  updated_at: string
}

export interface ComplianceViolation {
  text: string
  rule: string
  suggestion: string
}

export interface ComplianceLogRow {
  id: string
  article_id: string | null
  check_type: ComplianceCheckType
  result: ComplianceResult
  violations: ComplianceViolation[]
  checked_at: string
  created_at: string
}

// ============================================================
// INSERT 型
// ============================================================

export type CategoryInsert = {
  id?: string
  name: string
  slug: string
  description?: string | null
  display_order?: number
}

export type ArticleInsert = {
  id?: string
  microcms_id?: string | null
  slug: string
  title: string
  content?: string | null
  excerpt?: string | null
  category?: string
  category_id?: string | null
  status?: ArticleStatus
  seo_title?: string | null
  seo_description?: string | null
  author_name?: string
  quality_score?: number
  pv_count?: number
  published_at?: string | null
  created_at?: string
  updated_at?: string
}

export type KeywordInsert = {
  id?: string
  keyword: string
  search_volume?: number
  difficulty?: number
  trend_score?: number
  category?: string
  category_id?: string | null
  tracked_at?: string
}

export type AnalyticsDailyInsert = {
  id?: string
  article_id: string
  date: string
  pageviews?: number
  unique_users?: number
  avg_time?: number
  bounce_rate?: number
  ctr?: number
  conversions?: number
}

export type AffiliateLinkInsert = {
  id?: string
  article_id?: string | null
  asp_name: string
  program_name: string
  url: string
  click_count?: number
  conversion_count?: number
  revenue?: number
}

export type ComplianceLogInsert = {
  id?: string
  article_id?: string | null
  check_type: ComplianceCheckType
  result: ComplianceResult
  violations?: ComplianceViolation[]
  checked_at?: string
}

// ============================================================
// UPDATE 型
// ============================================================

export type CategoryUpdate = Partial<Omit<CategoryRow, 'id' | 'created_at'>>

export type ArticleUpdate = Partial<Omit<ArticleRow, 'id' | 'created_at'>>

export type KeywordUpdate = Partial<Omit<KeywordRow, 'id' | 'created_at'>>

export type AnalyticsDailyUpdate = Partial<Omit<AnalyticsDailyRow, 'id' | 'created_at'>>

export type AffiliateLinkUpdate = Partial<Omit<AffiliateLinkRow, 'id' | 'created_at'>>

// ============================================================
// View 型
// ============================================================

export interface ArticlePerformanceView {
  id: string
  microcms_id: string | null
  slug: string
  title: string
  category: string
  status: ArticleStatus
  quality_score: number
  pv_count: number
  total_pv_30d: number
  avg_ctr_30d: number
  total_conversions_30d: number
  published_at: string | null
  updated_at: string
}

export interface ComplianceStatusView {
  article_id: string
  title: string
  check_type: ComplianceCheckType
  result: ComplianceResult
  violations: ComplianceViolation[]
  checked_at: string
}

// ============================================================
// Supabase Database 型 (supabase-js v2 用)
// ============================================================

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: CategoryRow
        Insert: CategoryInsert
        Update: CategoryUpdate
        Relationships: []
      }
      articles: {
        Row: ArticleRow
        Insert: ArticleInsert
        Update: ArticleUpdate
        Relationships: [
          {
            foreignKeyName: 'articles_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      keywords: {
        Row: KeywordRow
        Insert: KeywordInsert
        Update: KeywordUpdate
        Relationships: [
          {
            foreignKeyName: 'keywords_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      analytics_daily: {
        Row: AnalyticsDailyRow
        Insert: AnalyticsDailyInsert
        Update: AnalyticsDailyUpdate
        Relationships: [
          {
            foreignKeyName: 'analytics_daily_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'articles'
            referencedColumns: ['id']
          },
        ]
      }
      affiliate_links: {
        Row: AffiliateLinkRow
        Insert: AffiliateLinkInsert
        Update: AffiliateLinkUpdate
        Relationships: [
          {
            foreignKeyName: 'affiliate_links_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'articles'
            referencedColumns: ['id']
          },
        ]
      }
      compliance_logs: {
        Row: ComplianceLogRow
        Insert: ComplianceLogInsert
        Update: Partial<Omit<ComplianceLogRow, 'id' | 'created_at'>>
        Relationships: [
          {
            foreignKeyName: 'compliance_logs_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'articles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      v_article_performance: {
        Row: ArticlePerformanceView
        Relationships: []
      }
      v_compliance_status: {
        Row: ComplianceStatusView
        Relationships: []
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Functions: Record<string, any>
  }
}

// ============================================================
// ユーティリティ型 (supabase-js v2 パターン)
// ============================================================

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row']
