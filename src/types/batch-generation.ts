/**
 * バッチ記事生成 型定義
 * 30キーワード一括生成用
 */

import type { ContentCategory, ContentTone } from "@/types/content";

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
  estimatedVolume?: number;
  competitionScore?: number;
}

export interface BatchGenerationRequest {
  keywordIds?: string[];
  categoryFilter?: ContentCategory;
  priorityFilter?: KeywordPriority;
  maxConcurrent?: number;
  complianceThreshold?: number;
  dryRun?: boolean;
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
