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
// Revenue Daily テーブル (ASP収益日次データ)
// ============================================================

export interface RevenueDailyRow {
  id: string
  date: string
  asp_name: string
  program_id: string
  article_slug: string | null
  impressions: number
  clicks: number
  conversions_pending: number
  conversions_confirmed: number
  conversions_cancelled: number
  revenue_pending: number
  revenue_confirmed: number
  revenue_cancelled: number
  source: string
  raw_data: Json | null
  created_at: string
  updated_at: string
}

export type RevenueDailyInsert = {
  id?: string
  date: string
  asp_name: string
  program_id: string
  article_slug?: string | null
  impressions?: number
  clicks?: number
  conversions_pending?: number
  conversions_confirmed?: number
  conversions_cancelled?: number
  revenue_pending?: number
  revenue_confirmed?: number
  revenue_cancelled?: number
  source?: string
  raw_data?: Json | null
}

export type RevenueDailyUpdate = Partial<Omit<RevenueDailyRow, 'id' | 'created_at'>>

// ============================================================
// ASP Programs テーブル
// ============================================================

export interface AspProgramRow {
  id: string
  asp_name: string
  program_name: string
  program_id: string
  category: string
  reward_tiers: Json
  approval_rate: number
  epc: number
  itp_support: boolean
  cookie_duration: number
  is_active: boolean
  priority: number
  recommended_anchors: string[]
  notes: string | null
  ad_creatives: Json | null
  advertiser_name: string
  asp_category: string
  confirmation_period_days: number
  partnership_status: string
  last_approval_date: string | null
  created_at: string
  updated_at: string
}

export type AspProgramInsert = {
  id?: string
  asp_name: string
  program_name: string
  program_id: string
  category: string
  reward_tiers?: Json
  approval_rate?: number
  epc?: number
  itp_support?: boolean
  cookie_duration?: number
  is_active?: boolean
  priority?: number
  recommended_anchors?: string[]
  notes?: string | null
  ad_creatives?: Json | null
  advertiser_name?: string
  asp_category?: string
  confirmation_period_days?: number
  partnership_status?: string
  last_approval_date?: string | null
}

export type AspProgramUpdate = Partial<Omit<AspProgramRow, 'id' | 'created_at'>>

// ============================================================
// Heatmap Events テーブル
// ============================================================

export type HeatmapEventType = 'click' | 'scroll'

export interface HeatmapEventRow {
  id: string
  article_slug: string
  event_type: HeatmapEventType
  x_pct: number        // 0.0 ~ 100.0 (クリック位置 水平%)
  y_pct: number        // 0.0 ~ 100.0 (クリック位置 垂直%)
  scroll_depth: number  // 0 ~ 100 (スクロール到達%)
  viewport_width: number
  created_at: string
}

export type HeatmapEventInsert = {
  id?: string
  article_slug: string
  event_type: HeatmapEventType
  x_pct?: number
  y_pct?: number
  scroll_depth?: number
  viewport_width?: number
}

// ============================================================
// Pipeline Runs テーブル
// ============================================================

export interface PipelineRunRow {
  id: string
  type: string
  status: string
  started_at: string
  completed_at: string | null
  steps_json: Json
  error: string | null
  created_at: string
}

export type PipelineRunInsert = {
  id?: string
  type: string
  status?: string
  started_at?: string
  completed_at?: string | null
  steps_json?: Json
  error?: string | null
}

export type PipelineRunUpdate = Partial<Omit<PipelineRunRow, 'id' | 'created_at'>>

// ============================================================
// Article Reviews テーブル
// ============================================================

export interface ArticleReviewRow {
  id: string
  article_id: string
  content_id: string | null
  status: string
  reviewer: string | null
  comment: string | null
  action: string | null
  compliance_score: number | null
  eeat_score: number | null
  created_at: string
  updated_at: string
}

export type ArticleReviewInsert = {
  id?: string
  article_id: string
  content_id?: string | null
  status?: string
  reviewer?: string | null
  comment?: string | null
  action?: string | null
  compliance_score?: number | null
  eeat_score?: number | null
}

export type ArticleReviewUpdate = Partial<Omit<ArticleReviewRow, 'id' | 'created_at'>>

// ============================================================
// Batch Generation Jobs テーブル
// ============================================================

export interface BatchGenerationJobRow {
  id: string
  status: string
  total_keywords: number
  completed_count: number
  failed_count: number
  total_cost_usd: number
  created_by: string | null
  error_messages: string[] | null
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type BatchGenerationJobInsert = {
  id?: string
  status?: string
  total_keywords: number
  completed_count?: number
  failed_count?: number
  total_cost_usd?: number
  created_by?: string | null
  error_messages?: string[] | null
  started_at?: string
  completed_at?: string | null
}

export type BatchGenerationJobUpdate = Partial<Omit<BatchGenerationJobRow, 'id' | 'created_at'>>

// ============================================================
// Monitoring Alerts テーブル
// ============================================================

export interface MonitoringAlertRow {
  id: string
  type: string | null
  severity: string
  status: string
  title: string
  message: string
  source: string | null
  metadata: Json | null
  acknowledged_at: string | null
  resolved_at: string | null
  created_at: string
}

export type MonitoringAlertInsert = {
  id?: string
  type?: string | null
  severity: string
  status?: string
  title: string
  message: string
  source?: string | null
  metadata?: Json | null
}

export type MonitoringAlertUpdate = Partial<Omit<MonitoringAlertRow, 'id' | 'created_at'>>

// ============================================================
// Generation Costs テーブル
// ============================================================

export interface GenerationCostRow {
  id: string
  job_id: string | null
  article_id: string | null
  cost_type: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  model: string
  created_at: string
}

export type GenerationCostInsert = {
  id?: string
  job_id?: string | null
  article_id?: string | null
  cost_type: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  model: string
}

export type GenerationCostUpdate = Partial<Omit<GenerationCostRow, 'id' | 'created_at'>>

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
      asp_programs: {
        Row: AspProgramRow
        Insert: AspProgramInsert
        Update: AspProgramUpdate
        Relationships: []
      }
      heatmap_events: {
        Row: HeatmapEventRow
        Insert: HeatmapEventInsert
        Update: Partial<Omit<HeatmapEventRow, 'id' | 'created_at'>>
        Relationships: []
      }
      pipeline_runs: {
        Row: PipelineRunRow
        Insert: PipelineRunInsert
        Update: PipelineRunUpdate
        Relationships: []
      }
      article_reviews: {
        Row: ArticleReviewRow
        Insert: ArticleReviewInsert
        Update: ArticleReviewUpdate
        Relationships: [
          {
            foreignKeyName: 'article_reviews_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'articles'
            referencedColumns: ['id']
          },
        ]
      }
      batch_generation_jobs: {
        Row: BatchGenerationJobRow
        Insert: BatchGenerationJobInsert
        Update: BatchGenerationJobUpdate
        Relationships: []
      }
      monitoring_alerts: {
        Row: MonitoringAlertRow
        Insert: MonitoringAlertInsert
        Update: MonitoringAlertUpdate
        Relationships: []
      }
      generation_costs: {
        Row: GenerationCostRow
        Insert: GenerationCostInsert
        Update: GenerationCostUpdate
        Relationships: []
      }
      revenue_daily: {
        Row: RevenueDailyRow
        Insert: RevenueDailyInsert
        Update: RevenueDailyUpdate
        Relationships: []
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
