/**
 * publish-to-microcms ステップ ユニットテスト
 * Phase 3b: upsert方式、べき等性確保、ComplianceGateOutput入力対応
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { publishToMicroCMSStep } from '../publish-to-microcms'
import type { GeneratedArticleData } from '../../types'
import type { ComplianceGateOutput } from '../compliance-gate'
import { createMockPipelineContext } from '@/test/helpers'

// ============================================================
// モック: compliance-gate の updateQueueEntryStatus
// ============================================================

vi.mock('../compliance-gate', () => ({
  updateQueueEntryStatus: vi.fn().mockResolvedValue(undefined),
}))

// ============================================================
// テストデータ
// ============================================================

function createTestArticle(overrides?: Partial<GeneratedArticleData>): GeneratedArticleData {
  return {
    microcmsId: null,
    slug: 'test-aga-treatment',
    title: 'AGA治療の基礎知識',
    content: '<p>テスト記事コンテンツ</p>',
    excerpt: 'テスト記事の概要',
    category: 'aga',
    seoTitle: 'AGA治療の基礎知識',
    seoDescription: 'AGA治療の基礎知識を解説',
    authorName: 'MENS CATALY 編集部',
    tags: ['AGA'],
    isPr: false,
    qualityScore: 80,
    complianceScore: 96,
    ...overrides,
  }
}

function createTestComplianceGateOutput(articles: GeneratedArticleData[]): ComplianceGateOutput {
  return {
    articles,
    results: articles.map(a => ({
      decision: 'auto-publish' as const,
      complianceScore: a.complianceScore,
      violationCount: 0,
      reason: 'テスト',
    })),
    reviewQueueCount: 0,
    rejectedCount: 0,
    queueEntries: [],
  }
}

// ============================================================
// テスト
// ============================================================

describe('publishToMicroCMSStep', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.MICROCMS_SERVICE_DOMAIN
    delete process.env.MICROCMS_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ----------------------------------------------------------
  // 環境変数未設定時
  // ----------------------------------------------------------

  describe('microCMS未設定時', () => {
    it('GeneratedArticleData[] 入力でモックレスポンスを返すこと', async () => {
      const context = createMockPipelineContext()
      const articles = [createTestArticle()]

      const result = await publishToMicroCMSStep.execute(articles, context)

      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('test-aga-treatment')
      expect(result[0].microcmsId).toMatch(/^mock-/)
    })

    it('ComplianceGateOutput 入力でも正常に動作すること', async () => {
      const context = createMockPipelineContext()
      const articles = [createTestArticle({ slug: 'article-1' }), createTestArticle({ slug: 'article-2' })]
      const gateOutput = createTestComplianceGateOutput(articles)

      const result = await publishToMicroCMSStep.execute(gateOutput, context)

      expect(result).toHaveLength(2)
      expect(result[0].slug).toBe('article-1')
      expect(result[1].slug).toBe('article-2')
    })

    it('空の articles 配列でも正常に動作すること', async () => {
      const context = createMockPipelineContext()
      const gateOutput = createTestComplianceGateOutput([])

      const result = await publishToMicroCMSStep.execute(gateOutput, context)

      expect(result).toHaveLength(0)
    })
  })

  // ----------------------------------------------------------
  // Dry run モード
  // ----------------------------------------------------------

  describe('dryRunモード', () => {
    it('dryRunモードでモックIDが返されること', async () => {
      process.env.MICROCMS_SERVICE_DOMAIN = 'test-domain'
      process.env.MICROCMS_API_KEY = 'test-key'

      const context = createMockPipelineContext({
        config: {
          type: 'manual',
          maxConcurrentSteps: 1,
          retryDelayMs: 0,
          timeoutMs: 30000,
          enableSupabaseLogging: false,
          dryRun: true,
        },
      })

      const articles = [createTestArticle()]
      const result = await publishToMicroCMSStep.execute(articles, context)

      expect(result).toHaveLength(1)
      expect(result[0].microcmsId).toMatch(/^dryrun-/)
    })
  })

  // ----------------------------------------------------------
  // 入力正規化
  // ----------------------------------------------------------

  describe('入力の正規化', () => {
    it('配列入力がそのまま処理されること', async () => {
      const context = createMockPipelineContext()
      const articles = [createTestArticle()]

      const result = await publishToMicroCMSStep.execute(articles, context)

      expect(result).toHaveLength(1)
    })

    it('ComplianceGateOutput の articles フィールドが抽出されること', async () => {
      const context = createMockPipelineContext()
      const output: ComplianceGateOutput = {
        articles: [createTestArticle()],
        results: [],
        reviewQueueCount: 0,
        rejectedCount: 0,
        queueEntries: [],
      }

      const result = await publishToMicroCMSStep.execute(output, context)

      expect(result).toHaveLength(1)
    })
  })

  // ----------------------------------------------------------
  // sharedData 保存
  // ----------------------------------------------------------

  describe('コンテキスト共有データ', () => {
    it('publishedArticles が sharedData に保存されること', async () => {
      const context = createMockPipelineContext()
      const articles = [createTestArticle()]

      await publishToMicroCMSStep.execute(articles, context)

      expect(context.sharedData['publishedArticles']).toBeDefined()
    })
  })
})
