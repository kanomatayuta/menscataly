/**
 * バッチ記事生成 型定義
 * 30キーワード一括生成用
 */

import type { Article, ContentCategory, ContentTone } from "@/types/content";

export type KeywordPriority = "high" | "medium" | "low";

export interface KeywordTarget {
  id: string;
  keyword: string;
  subKeywords: string[];
  category: ContentCategory;
  targetAudience: string;
  tone: ContentTone;
  targetLength: number;
  priority: KeywordPriority;
  searchVolume?: number;
  estimatedVolume?: number;
  difficulty?: number;
  competitionScore?: number;
  outlineHints?: string[];
}

export interface BatchGenerationRequest {
  /** Inline keyword targets for batch generation */
  keywords?: KeywordTarget[];
  /** Reference existing keyword IDs instead of inline data */
  keywordIds?: string[];
  categoryFilter?: ContentCategory;
  priorityFilter?: KeywordPriority;
  maxConcurrent?: number;
  complianceThreshold?: number;
  dryRun?: boolean;
  continueOnError?: boolean;
  requestedBy?: string;
  /** Callback invoked after each successful article generation */
  onArticleGenerated?: (article: Article, keyword: string) => Promise<void>;
}

export interface BatchGenerationProgress {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  total: number;
  completed: number;
  failed: number;
  progressPercent: number;
  currentKeywords: string[];
  estimatedRemainingSeconds?: number;
  totalCostUsd: number;
  startedAt: string;
  updatedAt: string;
}

export type KeywordGenerationStatus = "pending" | "generating" | "compliance_check" | "completed" | "failed";

export interface KeywordGenerationProgress {
  keywordId: string;
  keyword: string;
  status: KeywordGenerationStatus;
  articleId: string | null;
  complianceScore: number | null;
  costUsd: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

export type CostType = "article_generation" | "image_generation" | "analysis" | "compliance_check";

export interface GenerationCostRecord {
  id: string;
  jobId: string | null;
  articleId: string | null;
  costType: CostType;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  createdAt: string;
}

export interface CostSummary {
  totalCostUsd: number;
  articleGenerationCost: number;
  imageGenerationCost: number;
  analysisCost: number;
  articleCount: number;
  avgCostPerArticle: number;
  period: { startDate: string; endDate: string };
}
