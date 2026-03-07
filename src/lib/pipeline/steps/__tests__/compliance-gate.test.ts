/**
 * コンプライアンスゲート ユニットテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { complianceGateStep } from '../compliance-gate'
import type { ComplianceGateOutput } from '../compliance-gate'
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
      score: 65,
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
      score: 55,
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

  it('スコア50未満は reject 判定となること', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 35,
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

  it('complianceGateResults が sharedData に保存されること', async () => {
    mockCheckWithArticle.mockReturnValue({
      score: 97,
      violations: [],
      fixedText: '<p>修正済み</p>',
      eeatScore: { total: 80 },
    })

    const context = createMockPipelineContext()
    const articles = [createTestArticle()]

    await complianceGateStep.execute(articles, context)

    expect(context.sharedData['complianceGateResults']).toBeDefined()
    expect(context.sharedData['complianceGateResults']).toHaveLength(1)
  })
})
