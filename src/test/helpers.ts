/**
 * テストヘルパー: モックファクトリ
 * microCMS / Supabase / Pipeline / Phase2 型のテスト用スタブを生成する
 */

import type { AspProgram, ItpMitigationConfig } from '@/types/asp-config'
import type { ArticleAnalytics, ArticleReviewItem, BatchGenerationJob, MonitoringAlert, RevenueSummary } from '@/types/admin'
import type { BatchGenerationProgress, GenerationCostRecord, KeywordTarget } from '@/types/batch-generation'
import type { PipelineContext, PipelineStep, PipelineConfig } from '@/lib/pipeline/types'
import type { AnalyticsDailyRow } from '@/types/database'

// =============================================================================
// microCMS モックファクトリ
// =============================================================================

export interface MockMicroCMSArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  isPR: boolean;
  publishedAt: string;
  updatedAt: string;
  revisedAt: string;
  createdAt: string;
}

export interface MockMicroCMSListResponse<T> {
  contents: T[];
  totalCount: number;
  offset: number;
  limit: number;
}

/**
 * microCMS 記事モックを生成する
 */
export function createMockArticle(
  overrides: Partial<MockMicroCMSArticle> = {}
): MockMicroCMSArticle {
  return {
    id: 'mock-article-001',
    title: 'AGA治療の基礎知識',
    content: '<p>記事本文のサンプルテキストです。</p>',
    category: 'aga',
    isPR: false,
    publishedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    revisedAt: '2026-01-15T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * microCMS リストレスポンスモックを生成する
 */
export function createMockListResponse<T>(
  contents: T[],
  overrides: Partial<Omit<MockMicroCMSListResponse<T>, 'contents'>> = {}
): MockMicroCMSListResponse<T> {
  return {
    contents,
    totalCount: contents.length,
    offset: 0,
    limit: 10,
    ...overrides,
  };
}

// =============================================================================
// Supabase モックファクトリ
// =============================================================================

export interface MockSupabaseArticleStats {
  article_id: string;
  pv_count: number;
  cv_count: number;
  revenue: number;
  created_at: string;
}

/**
 * Supabase 記事統計モックを生成する
 */
export function createMockArticleStats(
  overrides: Partial<MockSupabaseArticleStats> = {}
): MockSupabaseArticleStats {
  return {
    article_id: 'mock-article-001',
    pv_count: 1000,
    cv_count: 10,
    revenue: 5000,
    created_at: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Supabase クエリビルダーのモックを生成する
 * vitest の vi.fn() を使ってチェーン可能なモックを返す
 */
export function createMockSupabaseQuery<T>(data: T[], error: null | Error = null) {
  const response = { data, error, count: data.length };

  const query = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn().mockImplementation((resolve: (value: typeof response) => void) => {
      return Promise.resolve(response).then(resolve);
    }),
  };

  return query;
}

// =============================================================================
// Phase 2: ASP / Admin / Batch モックファクトリ
// =============================================================================

/**
 * ASPプログラムモックを生成する
 */
export function createMockAspProgram(overrides?: Partial<AspProgram>): AspProgram {
  return {
    id: 'asp-001',
    aspName: 'afb',
    programName: 'AGAクリニック テスト',
    programId: 'afb-aga-001',
    category: 'aga',
    rewardTiers: [{ condition: '初回来院完了', amount: 15000, type: 'fixed' }],
    approvalRate: 45,
    epc: 120,
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    recommendedAnchors: ['AGAクリニックの詳細を見る'],
    ...overrides,
  }
}

/**
 * バッチ生成ジョブモックを生成する
 */
export function createMockBatchGenerationJob(overrides?: Partial<BatchGenerationJob>): BatchGenerationJob {
  return {
    id: 'job-001',
    status: 'queued',
    totalKeywords: 5,
    completedCount: 0,
    failedCount: 0,
    startedAt: '2026-03-01T00:00:00Z',
    totalCostUsd: 0,
    results: [],
    ...overrides,
  }
}

/**
 * 記事レビューアイテムモックを生成する
 */
export function createMockArticleReviewItem(overrides?: Partial<ArticleReviewItem>): ArticleReviewItem {
  return {
    id: 'review-001',
    contentId: 'article-001',
    title: 'AGA治療の基礎知識',
    slug: 'aga-basics',
    category: 'aga',
    complianceScore: 96,
    status: 'pending',
    generatedAt: '2026-03-01T00:00:00Z',
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  }
}

/**
 * モニタリングアラートモックを生成する
 */
export function createMockMonitoringAlert(overrides?: Partial<MonitoringAlert>): MonitoringAlert {
  return {
    id: 'alert-001',
    type: 'pipeline_failure',
    level: 'warning',
    status: 'active',
    title: 'Pipeline step failed',
    message: 'fetch-trends step failed after 3 retries',
    metadata: {},
    createdAt: '2026-03-01T00:00:00Z',
    acknowledgedAt: null,
    resolvedAt: null,
    ...overrides,
  }
}

/**
 * 収益サマリモックを生成する
 */
export function createMockRevenueSummary(overrides?: Partial<RevenueSummary>): RevenueSummary {
  return {
    aspName: 'afb',
    totalClicks: 500,
    totalConversions: 5,
    totalRevenue: 50000,
    conversionRate: 1.0,
    monthlyConversions: 5,
    monthlyRevenueJpy: 50000,
    monthOverMonthChange: 12.5,
    topArticles: [],
    ...overrides,
  }
}

/**
 * バッチ生成進捗モックを生成する
 */
export function createMockBatchGenerationProgress(overrides?: Partial<BatchGenerationProgress>): BatchGenerationProgress {
  return {
    jobId: 'job-001',
    status: 'running',
    total: 10,
    completed: 3,
    failed: 0,
    progressPercent: 30,
    currentKeywords: ['AGA治療 おすすめ', '医療脱毛 メンズ'],
    totalCostUsd: 0.15,
    estimatedRemainingSeconds: 60,
    startedAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:05:00Z',
    ...overrides,
  }
}

/**
 * 生成コストレコードモックを生成する
 */
export function createMockGenerationCostRecord(overrides?: Partial<GenerationCostRecord>): GenerationCostRecord {
  return {
    id: 'cost-001',
    jobId: 'job-001',
    articleId: 'article-001',
    costType: 'article_generation',
    inputTokens: 1500,
    outputTokens: 4000,
    costUsd: 0.05,
    model: 'claude-sonnet-4-6',
    createdAt: '2026-03-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * キーワードターゲットモックを生成する
 */
export function createMockKeywordTarget(overrides?: Partial<KeywordTarget>): KeywordTarget {
  return {
    id: 'kw-001',
    keyword: 'AGA治療 おすすめ',
    subKeywords: ['AGA クリニック', 'AGA 費用'],
    category: 'aga',
    priority: 'high',
    estimatedVolume: 5400,
    competitionScore: 45,
    targetAudience: '20代〜40代男性',
    tone: 'informative',
    targetLength: 3000,
    ...overrides,
  }
}

/**
 * ITPミティゲーション設定モックを生成する
 */
export function createMockItpMitigationConfig(overrides?: Partial<ItpMitigationConfig>): ItpMitigationConfig {
  return {
    aspName: 'afb',
    scriptUrl: 'https://t.afb.ne.jp/itp.js',
    scriptAttributes: { 'data-asp': 'afb', async: 'true' },
    lazyLoad: true,
    sameSiteCookie: 'None',
    ...overrides,
  }
}

// =============================================================================
// Phase 2a: Pipeline / Health モックファクトリ
// =============================================================================

/**
 * PipelineContext モックを生成する
 */
export function createMockPipelineContext(
  overrides?: Partial<PipelineContext>
): PipelineContext {
  const defaultConfig: PipelineConfig = {
    type: 'manual',
    maxConcurrentSteps: 1,
    retryDelayMs: 0,
    timeoutMs: 1800000,
    enableSupabaseLogging: false,
    dryRun: false,
  }

  return {
    runId: 'test-run-001',
    type: 'manual',
    startedAt: '2026-03-01T00:00:00Z',
    config: defaultConfig,
    stepLogs: [],
    sharedData: {},
    ...overrides,
  }
}

/**
 * PipelineStep モックを生成する
 */
export function createMockPipelineStep(
  overrides?: Partial<PipelineStep> & { execute?: ReturnType<typeof vi.fn> }
): PipelineStep {
  return {
    name: 'mock-step',
    description: 'A mock pipeline step for testing',
    maxRetries: 3,
    execute: vi.fn().mockResolvedValue({ mock: true }),
    ...overrides,
  }
}

/**
 * ヘルスチェックスコアモックを生成する
 */
export interface MockHealthScore {
  status: 'healthy' | 'degraded' | 'unhealthy'
  services: Array<{
    name: string
    status: 'up' | 'down'
    latencyMs: number | null
    error?: string
  }>
  timestamp: string
  version: string
}

export function createMockHealthScore(
  overrides?: Partial<MockHealthScore>
): MockHealthScore {
  return {
    status: 'healthy',
    services: [
      { name: 'microCMS', status: 'up', latencyMs: 45 },
      { name: 'Supabase', status: 'up', latencyMs: 32 },
    ],
    timestamp: '2026-03-01T00:00:00Z',
    version: '0.1.0',
    ...overrides,
  }
}

// =============================================================================
// Phase 6: Analytics / Revenue モックファクトリ
// =============================================================================

/**
 * analytics_daily upsert テスト用モック
 */
export function createMockAnalyticsDailyUpsert(overrides?: Partial<AnalyticsDailyRow>): AnalyticsDailyRow {
  return {
    id: 'analytics-001',
    article_id: 'article-001',
    date: '2026-03-05',
    pageviews: 500,
    unique_users: 350,
    avg_time: 120,
    bounce_rate: 0.45,
    ctr: 0.03,
    conversions: 2,
    created_at: '2026-03-05T06:00:00Z',
    ...overrides,
  }
}

/**
 * revenue_daily upsert テスト用モック (新テーブル)
 */
export function createMockRevenueDailyUpsert(overrides?: Record<string, unknown>) {
  return {
    id: 'rev-001',
    date: '2026-03-05',
    asp_name: 'a8',
    program_id: 'a8-aga-001',
    clicks: 50,
    conversions: 1,
    confirmed_conversions: 0,
    revenue_jpy: 15000,
    status: 'pending',
    imported_at: '2026-03-06T00:00:00Z',
    created_at: '2026-03-06T00:00:00Z',
    ...overrides,
  }
}

// =============================================================================
// Phase 6: ArticleAnalytics モックファクトリ (GA4 アフィリエイトクリック対応)
// =============================================================================

/**
 * 記事アナリティクスモックの拡張型
 *
 * 別エージェントが ArticleAnalytics に searchClicks / affiliateClicks を
 * 追加予定。型の変更が反映されるまではこの拡張型を使う。
 * 変更反映後は ArticleAnalytics をそのまま使用可能。
 */
export interface MockArticleAnalytics extends ArticleAnalytics {
  /** GSC 検索クリック数 (旧 clicks フィールドに相当) */
  searchClicks: number
  /** GA4 アフィリエイトリンクのクリック数 */
  affiliateClicks: number
}

/**
 * 記事アナリティクスモックを生成する
 *
 * searchClicks (旧 clicks) と affiliateClicks を含む。
 * 別エージェントの型変更後も後方互換で動作する。
 */
export function createMockArticleAnalytics(
  overrides?: Partial<MockArticleAnalytics>
): MockArticleAnalytics {
  return {
    articleId: 'article-001',
    pageviews: 500,
    clicks: 50,
    searchClicks: 50,
    affiliateClicks: 12,
    conversions: 2,
    revenue: 30000,
    ...overrides,
  }
}
