/**
 * パイプライン型定義
 * 自動投稿パイプライン実行エンジン用
 */

// ============================================================
// パイプラインステータス
// ============================================================

export type PipelineStatus = 'idle' | 'running' | 'success' | 'failed' | 'partial'

export type PipelineType = 'daily' | 'pdca' | 'manual'

// ============================================================
// ステップ定義
// ============================================================

export type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface StepLog {
  stepName: string
  status: StepStatus
  startedAt: string    // ISO 8601
  completedAt: string | null
  durationMs: number | null
  error: string | null
  metadata: Record<string, unknown>
}

export interface PipelineStep<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  maxRetries?: number
  /** ステップ個別のタイムアウト（ms）。未指定時は PipelineConfig.timeoutMs を使用 */
  timeoutMs?: number
  execute: (input: TInput, context: PipelineContext) => Promise<TOutput>
}

// ============================================================
// パイプライン設定
// ============================================================

export interface PipelineConfig {
  type: PipelineType
  maxConcurrentSteps: number
  retryDelayMs: number
  timeoutMs: number
  enableSupabaseLogging: boolean
  dryRun: boolean
}

// ============================================================
// パイプライン間で共有されるデータの型定義
// ============================================================

/** パイプライン間で共有されるデータの型定義 */
export interface PipelineSharedData {
  trends?: TrendData[];
  analytics?: AnalyticsData[];
  generatedArticles?: GeneratedArticleData[];
  maxArticles?: number;
  enabledCategories?: string[];
  healthScores?: unknown;
  depublishResult?: unknown;
  performanceAlerts?: unknown;
  rewriteResults?: unknown;
  publishedArticles?: unknown;
  aspRevenue?: unknown;
  syncResults?: unknown;
  complianceGateResults?: unknown;
  improvementCandidates?: unknown;
  maxRewrites?: number;
  autoDepublish?: unknown;
  [key: string]: unknown; // 後方互換性
}

// ============================================================
// パイプライン実行コンテキスト
// ============================================================

export interface PipelineContext {
  runId: string
  type: PipelineType
  startedAt: string
  config: PipelineConfig
  stepLogs: StepLog[]
  sharedData: PipelineSharedData
  signal?: AbortSignal
}

// ============================================================
// パイプライン実行結果
// ============================================================

export interface PipelineResult {
  runId: string
  type: PipelineType
  status: PipelineStatus
  startedAt: string
  completedAt: string
  durationMs: number
  stepLogs: StepLog[]
  error: string | null
  metadata: Record<string, unknown>
}

// ============================================================
// パイプライン実行レコード (Supabase保存用)
// ============================================================

export interface PipelineRunRecord {
  id: string
  type: PipelineType
  status: PipelineStatus
  started_at: string
  completed_at: string | null
  steps_json: StepLog[]
  error: string | null
  created_at: string
}

export interface PipelineLogRecord {
  id: string
  run_id: string
  step_name: string
  level: 'info' | 'warn' | 'error'
  message: string
  created_at: string
}

// ============================================================
// ステップ間データ転送型
// ============================================================

export interface TrendData {
  keyword: string
  relativeValue: number   // 0-100 (Google Trends スケール)
  category: string
  fetchedAt: string
}

export interface AnalyticsData {
  articleId: string
  pageviews: number
  uniqueUsers: number
  avgTime: number
  bounceRate: number
  ctr: number
  date: string
}

export interface AspRevenueData {
  aspName: string
  programName: string
  clicks: number
  conversions: number
  revenue: number
  date: string
}

export interface GeneratedArticleData {
  microcmsId: string | null
  slug: string
  title: string
  content: string
  excerpt: string
  category: string
  seoTitle: string
  seoDescription: string
  authorName: string
  tags: string[]
  isPr: boolean
  qualityScore: number
  complianceScore: number
}

export interface PublishedArticleData {
  microcmsId: string
  supabaseId: string
  slug: string
  title: string
  publishedAt: string
}

// ============================================================
// APIレスポンス型
// ============================================================

export interface PipelineRunResponse {
  success: boolean
  runId: string
  message: string
  status: PipelineStatus
}

export interface PipelineStatusResponse {
  runId: string | null
  type: PipelineType | null
  status: PipelineStatus
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  stepLogs: StepLog[]
  error: string | null
}

export interface PipelineHistoryResponse {
  runs: PipelineRunRecord[]
  total: number
  limit: number
  offset: number
}
