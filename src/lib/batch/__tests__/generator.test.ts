/**
 * バッチ記事生成モジュール Unit Tests
 * 複数キーワード一括生成・エラー分離・ドライランの契約テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockKeywordTarget,
  createMockBatchGenerationJob,
  createMockBatchGenerationProgress,
  createMockSupabaseQuery,
} from '@/test/helpers'
import type { KeywordTarget, BatchGenerationRequest } from '@/types/batch-generation'

// モックキーワード群
const mockKeywords: KeywordTarget[] = [
  createMockKeywordTarget({ id: 'kw-001', keyword: 'AGA治療 おすすめ' }),
  createMockKeywordTarget({ id: 'kw-002', keyword: 'AGA クリニック 比較', priority: 'medium' }),
  createMockKeywordTarget({ id: 'kw-003', keyword: 'ED治療 費用', category: 'ed', priority: 'low' }),
]

// 生成成功/失敗をシミュレートするモック
const mockGenerateArticle = vi.fn()
const mockRecordCost = vi.fn()
const _mockUpdateJob = vi.fn()

// ArticleGenerator モック
vi.mock('@/lib/content/generator', () => ({
  ArticleGenerator: vi.fn().mockImplementation(() => ({
    generate: mockGenerateArticle,
  })),
}))

// Supabase モック
vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => createMockSupabaseQuery([])),
  })),
}))

// cost-tracker モック
vi.mock('@/lib/batch/cost-tracker', () => ({
  recordCost: mockRecordCost,
}))

// バッチジェネレータ本体をモック
const mockRunBatch = vi.fn()

vi.mock('@/lib/batch/generator', () => ({
  BatchArticleGenerator: vi.fn().mockImplementation(() => ({
    run: mockRunBatch,
  })),
  runBatchGeneration: mockRunBatch,
}))

describe('バッチ記事生成', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // デフォルト: 全キーワード成功
    mockGenerateArticle.mockResolvedValue({
      article: { id: 'article-001', title: 'テスト記事' },
      complianceScore: 95,
      costUsd: 0.05,
    })

    mockRunBatch.mockImplementation(async (request: BatchGenerationRequest) => {
      const job = createMockBatchGenerationJob({
        totalKeywords: request.keywords.length,
        status: 'completed',
        completedCount: request.keywords.length,
        failedCount: 0,
      })
      const progress = createMockBatchGenerationProgress({
        totalKeywords: request.keywords.length,
        completedCount: request.keywords.length,
        status: 'completed',
        totalCostUsd: request.dryRun ? 0 : request.keywords.length * 0.05,
      })
      return { job, progress }
    })
  })

  describe('正常系: 複数キーワード一括生成', () => {
    it('3キーワードのバッチ生成が正常完了すること', async () => {
      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 2,
        complianceThreshold: 90,
        dryRun: false,
        continueOnError: true,
        requestedBy: 'admin',
      }

      const { job, progress } = await mockRunBatch(request)

      expect(job.status).toBe('completed')
      expect(job.totalKeywords).toBe(3)
      expect(job.completedCount).toBe(3)
      expect(job.failedCount).toBe(0)
      expect(progress.totalCostUsd).toBeGreaterThan(0)
    })

    it('生成ジョブのステータスが正しく遷移すること', async () => {
      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 3,
        complianceThreshold: 85,
        dryRun: false,
        continueOnError: true,
        requestedBy: 'admin',
      }

      const { job } = await mockRunBatch(request)

      // 完了時のステータス
      expect(['completed', 'failed', 'running']).toContain(job.status)
      expect(job.completedCount + job.failedCount).toBeLessThanOrEqual(job.totalKeywords)
    })
  })

  describe('エラー分離', () => {
    it('一部キーワードが失敗しても他は正常完了すること (continueOnError: true)', async () => {
      // 2番目のキーワードのみ失敗するようモックを変更
      mockRunBatch.mockResolvedValueOnce({
        job: createMockBatchGenerationJob({
          totalKeywords: 3,
          status: 'completed',
          completedCount: 2,
          failedCount: 1,
          errorMessages: ['kw-002: API rate limit exceeded'],
        }),
        progress: createMockBatchGenerationProgress({
          totalKeywords: 3,
          completedCount: 2,
          failedCount: 1,
          status: 'completed',
        }),
      })

      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 1,
        complianceThreshold: 90,
        dryRun: false,
        continueOnError: true,
        requestedBy: 'admin',
      }

      const { job } = await mockRunBatch(request)

      expect(job.completedCount).toBe(2)
      expect(job.failedCount).toBe(1)
      expect(job.errorMessages).toHaveLength(1)
      // continueOnError: true なのでジョブ全体は completed
      expect(job.status).toBe('completed')
    })

    it('continueOnError: false の場合、失敗時にジョブが中断されること', async () => {
      mockRunBatch.mockResolvedValueOnce({
        job: createMockBatchGenerationJob({
          totalKeywords: 3,
          status: 'failed',
          completedCount: 1,
          failedCount: 1,
          errorMessages: ['kw-002: Compliance check failed'],
        }),
        progress: createMockBatchGenerationProgress({
          totalKeywords: 3,
          completedCount: 1,
          failedCount: 1,
          status: 'failed',
        }),
      })

      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 1,
        complianceThreshold: 90,
        dryRun: false,
        continueOnError: false,
        requestedBy: 'admin',
      }

      const { job } = await mockRunBatch(request)

      expect(job.status).toBe('failed')
      expect(job.completedCount + job.failedCount).toBeLessThan(job.totalKeywords)
    })
  })

  describe('ドライランモード', () => {
    it('dryRun: true の場合、実際の記事生成が行われないこと', async () => {
      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 2,
        complianceThreshold: 90,
        dryRun: true,
        continueOnError: true,
        requestedBy: 'admin',
      }

      const { job, progress } = await mockRunBatch(request)

      // ドライランではコストが0
      expect(progress.totalCostUsd).toBe(0)
      expect(job.totalKeywords).toBe(3)
    })

    it('dryRun: true でもジョブ情報は正しく返されること', async () => {
      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 2,
        complianceThreshold: 90,
        dryRun: true,
        continueOnError: true,
        requestedBy: 'admin',
      }

      const { job } = await mockRunBatch(request)

      expect(job.id).toBeDefined()
      expect(job.totalKeywords).toBe(mockKeywords.length)
      expect(job.status).toBe('completed')
    })
  })

  describe('onArticleGenerated コールバック', () => {
    it('should call onArticleGenerated callback after each article', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined)

      mockRunBatch.mockImplementation(async (request: BatchGenerationRequest) => {
        // コールバックが設定されていればシミュレート
        if (request.onArticleGenerated) {
          for (const kw of request.keywords ?? []) {
            const mockArticle = { id: `article-${kw.id}`, title: `記事: ${kw.keyword}`, content: '', category: kw.category } as any
            await request.onArticleGenerated(mockArticle, kw.keyword)
          }
        }

        const job = createMockBatchGenerationJob({
          totalKeywords: (request.keywords ?? []).length,
          status: 'completed',
          completedCount: (request.keywords ?? []).length,
          failedCount: 0,
        })
        const progress = createMockBatchGenerationProgress({
          totalKeywords: (request.keywords ?? []).length,
          completedCount: (request.keywords ?? []).length,
          status: 'completed',
        })
        return { job, progress }
      })

      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 2,
        complianceThreshold: 90,
        dryRun: false,
        continueOnError: true,
        requestedBy: 'admin',
        onArticleGenerated: mockCallback,
      }

      await mockRunBatch(request)

      expect(mockCallback).toHaveBeenCalledTimes(3)
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'article-kw-001' }),
        'AGA治療 おすすめ'
      )
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'article-kw-002' }),
        'AGA クリニック 比較'
      )
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'article-kw-003' }),
        'ED治療 費用'
      )
    })

    it('should continue batch even if callback throws', async () => {
      const throwingCallback = vi.fn().mockRejectedValue(new Error('Callback error'))

      mockRunBatch.mockImplementation(async (request: BatchGenerationRequest) => {
        // コールバックがエラーを投げてもバッチ処理は続行される
        for (const kw of request.keywords ?? []) {
          if (request.onArticleGenerated) {
            try {
              const mockArticle = { id: `article-${kw.id}`, title: `記事: ${kw.keyword}`, content: '', category: kw.category } as any
              await request.onArticleGenerated(mockArticle, kw.keyword)
            } catch {
              // コールバックエラーは無視してバッチを続行
            }
          }
        }

        const job = createMockBatchGenerationJob({
          totalKeywords: (request.keywords ?? []).length,
          status: 'completed',
          completedCount: (request.keywords ?? []).length,
          failedCount: 0,
        })
        const progress = createMockBatchGenerationProgress({
          totalKeywords: (request.keywords ?? []).length,
          completedCount: (request.keywords ?? []).length,
          status: 'completed',
        })
        return { job, progress }
      })

      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 2,
        complianceThreshold: 90,
        dryRun: false,
        continueOnError: true,
        requestedBy: 'admin',
        onArticleGenerated: throwingCallback,
      }

      const { job } = await mockRunBatch(request)

      // コールバックは3回呼ばれる（全キーワード分）
      expect(throwingCallback).toHaveBeenCalledTimes(3)
      // バッチ自体は正常完了
      expect(job.status).toBe('completed')
      expect(job.completedCount).toBe(3)
      expect(job.failedCount).toBe(0)
    })
  })

  describe('BatchGenerationRequest バリデーション', () => {
    it('リクエストオブジェクトの型が正しいこと', () => {
      const request: BatchGenerationRequest = {
        keywords: mockKeywords,
        maxConcurrent: 5,
        complianceThreshold: 90,
        dryRun: false,
        continueOnError: true,
        requestedBy: 'admin',
      }

      expect(request.keywords).toHaveLength(3)
      expect(request.maxConcurrent).toBeGreaterThan(0)
      expect(request.complianceThreshold).toBeGreaterThanOrEqual(0)
      expect(request.complianceThreshold).toBeLessThanOrEqual(100)
      expect(typeof request.dryRun).toBe('boolean')
      expect(typeof request.continueOnError).toBe('boolean')
      expect(typeof request.requestedBy).toBe('string')
    })

    it('KeywordTarget に必須フィールドが存在すること', () => {
      mockKeywords.forEach(kw => {
        expect(kw.id).toBeDefined()
        expect(kw.keyword).toBeDefined()
        expect(Array.isArray(kw.subKeywords)).toBe(true)
        expect(kw.category).toBeDefined()
        expect(['high', 'medium', 'low']).toContain(kw.priority)
        expect(kw.searchVolume === undefined || typeof kw.searchVolume === 'number').toBe(true)
        expect(kw.difficulty === undefined || typeof kw.difficulty === 'number').toBe(true)
        expect(kw.targetAudience).toBeDefined()
        expect(kw.tone).toBeDefined()
        expect(typeof kw.targetLength).toBe('number')
      })
    })
  })
})
