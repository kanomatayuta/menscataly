/**
 * コスト追跡モジュール Unit Tests
 * コスト記録・サマリ取得・閾値チェックの契約テスト
 *
 * Backend エージェントが @/lib/batch/cost-tracker を実装する前に、
 * インターフェース契約をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockGenerationCostRecord,
} from '@/test/helpers'
import type { GenerationCostRecord, CostSummary } from '@/types/batch-generation'

// 契約模倣関数
const recordCost = vi.fn()
const getCostSummary = vi.fn()
const checkCostThreshold = vi.fn()

describe('コスト追跡モジュール', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    recordCost.mockImplementation(async (record: Partial<GenerationCostRecord>, dryRun = false) => {
      if (dryRun) {
        return createMockGenerationCostRecord({ ...record, id: 'dry-run', costUsd: 0 })
      }
      return createMockGenerationCostRecord(record)
    })

    getCostSummary.mockResolvedValue({
      totalCostUsd: 2.50,
      articleGenerationCost: 1.80,
      imageGenerationCost: 0.50,
      analysisCost: 0.20,
      articleCount: 10,
      avgCostPerArticle: 0.25,
      period: { startDate: '2026-02-01', endDate: '2026-03-01' },
    } satisfies CostSummary)

    checkCostThreshold.mockImplementation(async (thresholdUsd: number) => ({
      exceeded: 2.50 > thresholdUsd,
      currentCost: 2.50,
      threshold: thresholdUsd,
    }))
  })

  describe('recordCost()', () => {
    it('コストレコードを正常に記録できること', async () => {
      const record = await recordCost({
        jobId: 'job-001',
        articleId: 'article-001',
        costType: 'article_generation',
        inputTokens: 1500,
        outputTokens: 4000,
        costUsd: 0.05,
        model: 'claude-sonnet-4-6',
      })

      expect(record).toBeDefined()
      expect(record.id).toBeDefined()
      expect(record.costType).toBe('article_generation')
      expect(record.costUsd).toBeGreaterThanOrEqual(0)
      expect(record.model).toBe('claude-sonnet-4-6')
    })

    it('記録されたレコードに必須フィールドが含まれること', async () => {
      const record = await recordCost({
        jobId: 'job-002',
        articleId: 'article-002',
        costType: 'image_generation',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0.02,
        model: 'ideogram',
      })

      expect(record.id).toBeDefined()
      expect(record.jobId).toBe('job-002')
      expect(record.articleId).toBe('article-002')
      expect(['article_generation', 'image_generation', 'analysis', 'compliance_check']).toContain(record.costType)
      expect(typeof record.inputTokens).toBe('number')
      expect(typeof record.outputTokens).toBe('number')
      expect(typeof record.costUsd).toBe('number')
      expect(record.createdAt).toBeDefined()
    })

    it('コストタイプごとに記録できること', async () => {
      const costTypes = ['article_generation', 'image_generation', 'analysis', 'compliance_check'] as const
      for (const costType of costTypes) {
        const record = await recordCost({
          jobId: 'job-001',
          articleId: null,
          costType,
          inputTokens: 100,
          outputTokens: 200,
          costUsd: 0.01,
          model: 'test-model',
        })
        expect(record.costType).toBe(costType)
      }
    })
  })

  describe('getCostSummary()', () => {
    it('コストサマリを正しい形式で返すこと', async () => {
      const summary: CostSummary = await getCostSummary({
        startDate: '2026-02-01',
        endDate: '2026-03-01',
      })

      expect(summary).toBeDefined()
      expect(typeof summary.totalCostUsd).toBe('number')
      expect(typeof summary.articleGenerationCost).toBe('number')
      expect(typeof summary.imageGenerationCost).toBe('number')
      expect(typeof summary.analysisCost).toBe('number')
      expect(typeof summary.articleCount).toBe('number')
      expect(typeof summary.avgCostPerArticle).toBe('number')
      expect(summary.period).toBeDefined()
      expect(summary.period.startDate).toBe('2026-02-01')
      expect(summary.period.endDate).toBe('2026-03-01')
    })

    it('合計コストが内訳の合計と整合すること', async () => {
      const summary: CostSummary = await getCostSummary({
        startDate: '2026-02-01',
        endDate: '2026-03-01',
      })

      const sumOfParts = summary.articleGenerationCost + summary.imageGenerationCost + summary.analysisCost
      expect(summary.totalCostUsd).toBeCloseTo(sumOfParts, 2)
    })

    it('平均コストが正しく計算されていること', async () => {
      const summary: CostSummary = await getCostSummary({
        startDate: '2026-02-01',
        endDate: '2026-03-01',
      })

      if (summary.articleCount > 0) {
        const expected = summary.totalCostUsd / summary.articleCount
        expect(summary.avgCostPerArticle).toBeCloseTo(expected, 2)
      }
    })
  })

  describe('checkCostThreshold()', () => {
    it('閾値を超えていない場合、exceeded: false を返すこと', async () => {
      const result = await checkCostThreshold(10.0)

      expect(result.exceeded).toBe(false)
      expect(result.currentCost).toBe(2.50)
      expect(result.threshold).toBe(10.0)
    })

    it('閾値を超えている場合、exceeded: true を返すこと', async () => {
      const result = await checkCostThreshold(2.0)

      expect(result.exceeded).toBe(true)
      expect(result.currentCost).toBeGreaterThan(result.threshold)
    })

    it('返却オブジェクトに必須フィールドが含まれること', async () => {
      const result = await checkCostThreshold(5.0)

      expect(typeof result.exceeded).toBe('boolean')
      expect(typeof result.currentCost).toBe('number')
      expect(typeof result.threshold).toBe('number')
      expect(result.currentCost).toBeGreaterThanOrEqual(0)
      expect(result.threshold).toBeGreaterThan(0)
    })
  })

  describe('ドライランモード', () => {
    it('dryRun: true の場合、コストが0で記録されること', async () => {
      const record = await recordCost(
        {
          jobId: 'job-dry',
          articleId: 'article-dry',
          costType: 'article_generation',
          inputTokens: 1500,
          outputTokens: 4000,
          costUsd: 0.05,
          model: 'claude-sonnet-4-6',
        },
        true  // dryRun
      )

      expect(record.costUsd).toBe(0)
      expect(record.id).toBe('dry-run')
    })

    it('dryRun: true でもレコード構造は正しいこと', async () => {
      const record = await recordCost(
        {
          jobId: 'job-dry',
          articleId: null,
          costType: 'analysis',
          inputTokens: 500,
          outputTokens: 1000,
          costUsd: 0.01,
          model: 'claude-haiku-4-5',
        },
        true
      )

      expect(record.jobId).toBe('job-dry')
      expect(record.costType).toBe('analysis')
      expect(record.model).toBe('claude-haiku-4-5')
      expect(record.createdAt).toBeDefined()
    })
  })
})
