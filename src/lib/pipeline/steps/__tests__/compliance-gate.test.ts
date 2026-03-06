/**
 * コンプライアンスゲート ユニットテスト
 * Phase 3b: キュー永続化、ComplianceQueueEntry、updateQueueEntryStatus
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { complianceGateStep, updateQueueEntryStatus } from '../compliance-gate'
import type { ComplianceGateOutput, ComplianceQueueEntry } from '../compliance-gate'
import type { GeneratedArticleData } from '../../types'
import { createMockPipelineContext } from '@/test/helpers'

// ============================================================
// モック: ComplianceChecker
// ============================================================

const mockCheckWithArticle = vi.fn()

vi.mock('@/lib/compliance/checker', () => ({
  ComplianceChecker: class MockComplianceChecker {
    checkWithArticle = mockCheckWithArticle
  },
}))

// ============================================================
// モック: AlertManager
// ============================================================

const mockCreateAlert = vi.fn().mockResolvedValue({
  id: 'alert-001',
  level: 'warning',
  status: 'active',
  title: 'test',
  message: 'test',
  createdAt: '2026-03-01T00:00:00Z',
})

vi.mock('@/lib/monitoring/alert-manager', () => ({
  AlertManager: class MockAlertManager {
    createAlert = mockCreateAlert
  },
}))

// ============================================================
// モック: Supabase client (キュー永続化用)
// ============================================================

const mockUpsertResult = vi.fn().mockResolvedValue({ error: null })
const mockUpdateResult = vi.fn().mockResolvedValue({ error: null })
const mockSelectSingle = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation(() => ({
      upsert: mockUpsertResult,
      update: vi.fn().mockReturnValue({
        eq: mockUpdateResult,
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: mockSelectSingle,
        }),
      }),
    })),
  }),
}))

// ============================================================
// テスト用データ
// ============================================================

function createTestArticle(overrides?: Partial<GeneratedArticleData>): GeneratedArticleData {
  return {
    microcmsId: null,
    slug: 'test-aga-article',
    title: 'AGA治療の基礎知識',
    content: '<p>テスト記事コンテンツです。</p>',
    excerpt: 'テスト記事の概要です。',
    category: 'aga',
    seoTitle: 'AGA治療の基礎知識 | テスト',
    seoDescription: 'AGA治療についての基礎知識を解説します。',
    authorName: 'MENS CATALY 編集部',
    tags: ['AGA', '治療'],
    isPr: false,
    qualityScore: 80,
    complianceScore: 90,
    ...overrides,
  }
}

// ============================================================
// テスト
// ============================================================

describe('complianceGateStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルト: Supabase環境変数未設定
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('高スコア記事は auto-publish 判定となること', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 97,
      violations: [],
      fixedText: '<p>修正済みテキスト</p>',
      eeatScore: { total: 80 },
    })

    const context = createMockPipelineContext()
    const articles = [createTestArticle()]

    const result = await complianceGateStep.execute(articles, context) as ComplianceGateOutput

    expect(result.articles).toHaveLength(1)
    expect(result.results[0].decision).toBe('auto-publish')
    expect(result.results[0].complianceScore).toBe(97)
    expect(result.rejectedCount).toBe(0)
    expect(result.reviewQueueCount).toBe(0)
  })

  it('中間スコア記事は conditional 判定となること（E-E-AT が閾値以上）', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 90,
      violations: [{ type: 'yakuji_ho', severity: 'warning', ngText: 'NG', suggestedText: 'OK' }],
      fixedText: '<p>修正済み</p>',
      eeatScore: { total: 65 },
    })

    const context = createMockPipelineContext()
    const articles = [createTestArticle()]

    const result = await complianceGateStep.execute(articles, context) as ComplianceGateOutput

    expect(result.results[0].decision).toBe('conditional')
    expect(result.articles).toHaveLength(1)
  })

  it('低スコア記事は review-queue 判定となること', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 75,
      violations: [
        { type: 'yakuji_ho', severity: 'error', ngText: 'NG1', suggestedText: 'OK1' },
        { type: 'yakuji_ho', severity: 'error', ngText: 'NG2', suggestedText: 'OK2' },
      ],
      fixedText: '<p>修正済み</p>',
      eeatScore: { total: 40 },
    })

    const context = createMockPipelineContext()
    const articles = [createTestArticle()]

    const result = await complianceGateStep.execute(articles, context) as ComplianceGateOutput

    expect(result.results[0].decision).toBe('review-queue')
    expect(result.reviewQueueCount).toBe(1)
    expect(result.articles).toHaveLength(0) // 公開可能記事に含まれない
    expect(mockCreateAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'compliance_violation',
        severity: 'warning',
      })
    )
  })

  it('スコア70未満は reject 判定となること', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 50,
      violations: [
        { type: 'yakuji_ho', severity: 'critical', ngText: 'NG', suggestedText: 'OK' },
      ],
      fixedText: '<p>修正済み</p>',
      eeatScore: { total: 20 },
    })

    const context = createMockPipelineContext()
    const articles = [createTestArticle()]

    const result = await complianceGateStep.execute(articles, context) as ComplianceGateOutput

    expect(result.results[0].decision).toBe('reject')
    expect(result.rejectedCount).toBe(1)
    expect(result.articles).toHaveLength(0)
    expect(mockCreateAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'compliance_violation',
        severity: 'critical',
      })
    )
  })

  it('全記事のキューエントリが生成されること', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 97,
      violations: [],
      fixedText: '<p>修正済み</p>',
      eeatScore: { total: 80 },
    })

    const context = createMockPipelineContext()
    const articles = [
      createTestArticle({ slug: 'article-1', title: 'Article 1' }),
      createTestArticle({ slug: 'article-2', title: 'Article 2' }),
    ]

    const result = await complianceGateStep.execute(articles, context) as ComplianceGateOutput

    expect(result.queueEntries).toHaveLength(2)
    expect(result.queueEntries[0].slug).toBe('article-1')
    expect(result.queueEntries[0].decision).toBe('auto-publish')
    expect(result.queueEntries[0].queueStatus).toBe('pending')
    expect(result.queueEntries[0].retryCount).toBe(0)
    expect(result.queueEntries[0].runId).toBe(context.runId)
  })

  it('キューエントリが sharedData に保存されること', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 97,
      violations: [],
      fixedText: '<p>修正済み</p>',
      eeatScore: { total: 80 },
    })

    const context = createMockPipelineContext()
    const articles = [createTestArticle()]

    await complianceGateStep.execute(articles, context)

    expect(context.sharedData['complianceQueueEntries']).toBeDefined()
    const entries = context.sharedData['complianceQueueEntries'] as ComplianceQueueEntry[]
    expect(entries).toHaveLength(1)
  })
})

describe('updateQueueEntryStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('Supabase未設定時はエラーなく完了すること', async () => {
    await expect(updateQueueEntryStatus('test-slug', 'completed')).resolves.not.toThrow()
  })
})
