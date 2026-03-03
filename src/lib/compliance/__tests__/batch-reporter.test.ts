/**
 * バッチコンプライアンスレポーター Unit Tests
 * レポート生成・マークダウンエクスポートの契約テスト
 *
 * Content エージェントが @/lib/compliance/batch-reporter を実装する前に、
 * インターフェース契約をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface ComplianceBatchReport {
  id: string
  generatedAt: string
  totalArticles: number
  passedCount: number
  failedCount: number
  avgScore: number
  results: Array<{
    articleId: string
    title: string
    score: number
    passed: boolean
    violations: Array<{ id: string; severity: string; description: string }>
  }>
}

// 契約模倣関数
const generateReport = vi.fn()
const exportMarkdown = vi.fn()

describe('バッチコンプライアンスレポーター', () => {
  const sampleReport: ComplianceBatchReport = {
    id: 'report-001',
    generatedAt: '2026-03-01T00:00:00Z',
    totalArticles: 5,
    passedCount: 4,
    failedCount: 1,
    avgScore: 87.4,
    results: [
      { articleId: 'a1', title: 'AGA治療ガイド', score: 96, passed: true, violations: [] },
      { articleId: 'a2', title: 'ED治療の基礎', score: 94, passed: true, violations: [] },
      { articleId: 'a3', title: 'スキンケア入門', score: 92, passed: true, violations: [] },
      { articleId: 'a4', title: '脱毛クリニック比較', score: 88, passed: true, violations: [] },
      {
        articleId: 'a5',
        title: '育毛剤ランキング',
        score: 67,
        passed: false,
        violations: [
          { id: 'aga_001', severity: 'high', description: '薬機法違反: 確実に髪が生える' },
          { id: 'stealth_missing_pr', severity: 'medium', description: 'PR表記欠如' },
        ],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    generateReport.mockReturnValue(sampleReport)

    const markdown = [
      '# コンプライアンスレポート',
      '',
      `生成日時: ${sampleReport.generatedAt}`,
      `記事数: ${sampleReport.totalArticles}`,
      `合格: ${sampleReport.passedCount} / 不合格: ${sampleReport.failedCount}`,
      `平均スコア: ${sampleReport.avgScore}`,
      '',
      '## 結果一覧',
      '',
      '| 記事 | スコア | 結果 |',
      '|------|--------|------|',
      ...sampleReport.results.map(r => `| ${r.title} | ${r.score} | ${r.passed ? 'PASS' : 'FAIL'} |`),
      '',
      '## 違反詳細',
      '',
      ...sampleReport.results
        .filter(r => !r.passed)
        .map(r => `### ${r.title}\n${r.violations.map(v => `- [${v.severity}] ${v.description}`).join('\n')}`),
    ].join('\n')
    exportMarkdown.mockReturnValue(markdown)
  })

  describe('generateReport()', () => {
    it('バッチレポートを正しい形式で生成すること', () => {
      const report: ComplianceBatchReport = generateReport(['a1', 'a2', 'a3', 'a4', 'a5'])

      expect(report.id).toBeDefined()
      expect(report.generatedAt).toBeDefined()
      expect(report.totalArticles).toBe(5)
      expect(report.passedCount + report.failedCount).toBe(report.totalArticles)
      expect(typeof report.avgScore).toBe('number')
    })

    it('各結果にarticleId, title, score, passed, violationsが含まれること', () => {
      const report: ComplianceBatchReport = generateReport(['a1'])

      report.results.forEach(result => {
        expect(result.articleId).toBeDefined()
        expect(result.title).toBeDefined()
        expect(typeof result.score).toBe('number')
        expect(typeof result.passed).toBe('boolean')
        expect(Array.isArray(result.violations)).toBe(true)
      })
    })

    it('不合格記事には違反リストが含まれること', () => {
      const report: ComplianceBatchReport = generateReport(['a5'])

      const failedResults = report.results.filter(r => !r.passed)
      failedResults.forEach(result => {
        expect(result.violations.length).toBeGreaterThan(0)
        result.violations.forEach(v => {
          expect(v.id).toBeDefined()
          expect(v.severity).toBeDefined()
          expect(v.description).toBeDefined()
        })
      })
    })

    it('平均スコアが個別スコアの平均と一致すること', () => {
      const report: ComplianceBatchReport = generateReport(['a1', 'a2', 'a3', 'a4', 'a5'])

      const totalScore = report.results.reduce((sum, r) => sum + r.score, 0)
      const expectedAvg = totalScore / report.results.length
      expect(report.avgScore).toBeCloseTo(expectedAvg, 1)
    })
  })

  describe('exportMarkdown()', () => {
    it('マークダウン形式のレポートを返すこと', () => {
      const md: string = exportMarkdown(sampleReport)

      expect(md).toContain('# コンプライアンスレポート')
      expect(md).toContain('合格:')
      expect(md).toContain('不合格:')
      expect(md).toContain('AGA治療ガイド')
      expect(md).toContain('育毛剤ランキング')
      expect(md).toContain('FAIL')
      expect(md).toContain('薬機法違反')
    })

    it('マークダウンにテーブル形式が含まれること', () => {
      const md: string = exportMarkdown(sampleReport)

      expect(md).toContain('|')
      expect(md).toContain('---')
    })
  })
})
