// Supabase PostgreSQL 型定義
// schema.sql から手動生成 (src/lib/db/schema.sql 参照)

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ============================================================
// テーブル行型
// ============================================================

export interface ArticleRow {
  id: string
  microcms_id: string
  title: string
  slug: string
  category: string
  quality_score: number
  pv_count: number
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
  collected_at: string
  created_at: string
  updated_at: string
}

export interface AspLinkRow {
  id: string
  asp_name: string
  program_name: string
  url: string
  reward_amount: number
  category: string
  itp_tag: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AnalyticsRow {
  id: string
  article_id: string
  date: string
  pv: number
  ux_signals: {
    scroll_depth?: number
    time_on_page?: number
    bounce_rate?: number
    [key: string]: number | undefined
  }
  ctr: number
  conversions: number
  created_at: string
}

export interface ComplianceLogRow {
  id: string
  article_id: string
  check_type: 'yakuji_ho' | 'keihyo_ho' | 'ymyl' | 'stealth_marketing'
  result: 'passed' | 'warning' | 'failed'
  violations: ComplianceViolation[]
  checked_at: string
  created_at: string
}

export interface ComplianceViolation {
  text: string
  rule: string
  suggestion: string
}

// ============================================================
// INSERT / UPDATE 型
// ============================================================

export type ArticleInsert = {
  id?: string
  microcms_id: string
  title: string
  slug: string
  category: string
  quality_score?: number
  pv_count?: number
  updated_at?: string
}

export type ArticleUpdate = Partial<Omit<ArticleRow, 'id' | 'created_at'>>

export type AnalyticsInsert = Omit<AnalyticsRow, 'id' | 'created_at'> & {
  id?: string
}

export type ComplianceLogInsert = Omit<ComplianceLogRow, 'id' | 'created_at'> & {
  id?: string
}

// ============================================================
// View 型
// ============================================================

export interface ArticlePerformanceView {
  id: string
  microcms_id: string
  title: string
  category: string
  quality_score: number
  pv_count: number
  total_pv_30d: number
  avg_ctr_30d: number
  total_conversions_30d: number
  updated_at: string
}

export interface ComplianceStatusView {
  article_id: string
  title: string
  check_type: string
  result: 'passed' | 'warning' | 'failed'
  violations: ComplianceViolation[]
  checked_at: string
}

// ============================================================
// Supabase Database 型 (supabase-js v2 用)
// ============================================================

export interface Database {
  public: {
    Tables: {
      articles: {
        Row: ArticleRow
        Insert: ArticleInsert
        Update: ArticleUpdate
      }
      keywords: {
        Row: KeywordRow
        Insert: Omit<KeywordRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<KeywordRow, 'id' | 'created_at'>>
      }
      asp_links: {
        Row: AspLinkRow
        Insert: Omit<AspLinkRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<AspLinkRow, 'id' | 'created_at'>>
      }
      analytics: {
        Row: AnalyticsRow
        Insert: AnalyticsInsert
        Update: Partial<Omit<AnalyticsRow, 'id' | 'created_at'>>
      }
      compliance_logs: {
        Row: ComplianceLogRow
        Insert: ComplianceLogInsert
        Update: never
      }
    }
    Views: {
      v_article_performance: { Row: ArticlePerformanceView }
      v_compliance_status: { Row: ComplianceStatusView }
    }
    Functions: Record<string, never>
  }
}
