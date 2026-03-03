/**
 * バッチ記事生成 型定義
 * 30キーワード一括生成、進捗管理、コスト追跡
 */

import type { ContentCategory, ContentTone } from './content'
import type { BatchJobStatus } from './admin'

// ============================================================
// キーワードターゲット
// ============================================================

export type KeywordPriority = 'high' | 'medium' | 'low'

export interface KeywordTarget {
  id: string
  keyword: string
  subKeywords: string[]
  category: ContentCategory
  priority: KeywordPriority
  searchVolume: number
  difficulty: number
  targetAudience: string
  tone: ContentTone
  /** 目標文字数 */
  targetLength: number
  /** 記事構成のヒント */
  outlineHints?: string[]
}

// ============================================================
// バッチ生成リクエスト
// ============================================================

export interface BatchGenerationRequest {
  /** 生成対象キーワードリスト */
  keywords: KeywordTarget[]
  /** 最大並行生成数 */
  maxConcurrent: number
  /** コンプライアンス合格閾値 (0-100) */
  complianceThreshold: number
  /** ドライランモード */
  dryRun: boolean
  /** 失敗時も続行するか */
  continueOnError: boolean
  /** リクエスト元 */
  requestedBy: string
}

// ============================================================
// バッチ生成進捗
// ============================================================

export type KeywordGenerationStatus = 'pending' | 'generating' | 'compliance_check' | 'completed' | 'failed'

export interface KeywordGenerationProgress {
  keywordId: string
  keyword: string
  status: KeywordGenerationStatus
  articleId: string | null
  complianceScore: number | null
  costUsd: number | null
  startedAt: string | null
  completedAt: string | null
  error: string | null
}

export interface BatchGenerationProgress {
  jobId: string
  status: BatchJobStatus
  totalKeywords: number
  completedCount: number
  failedCount: number
  inProgressCount: number
  progress: KeywordGenerationProgress[]
  totalCostUsd: number
  estimatedRemainingMs: number | null
  startedAt: string
  updatedAt: string
}

// ============================================================
// コスト追跡
// ============================================================

export type CostType = 'article_generation' | 'image_generation' | 'analysis' | 'compliance_check'

export interface GenerationCostRecord {
  id: string
  jobId: string | null
  articleId: string | null
  costType: CostType
  inputTokens: number
  outputTokens: number
  costUsd: number
  model: string
  createdAt: string
}

export interface CostSummary {
  totalCostUsd: number
  articleGenerationCost: number
  imageGenerationCost: number
  analysisCost: number
  articleCount: number
  avgCostPerArticle: number
  period: {
    startDate: string
    endDate: string
  }
}
