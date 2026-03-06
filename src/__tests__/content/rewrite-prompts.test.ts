/**
 * Q2: リライトプロンプト テスト
 * Phase 3 SEO強化 — rewrite-prompts.ts
 *
 * - 各理由タイプのプロンプト生成
 * - 必須フィールドの検証
 * - オプション反映テスト
 * - ユーティリティ関数テスト
 */

import { describe, it, expect } from 'vitest'
import {
  generateRewritePrompt,
  getRewriteReasonLabel,
  getAllRewriteReasons,
  type RewriteReason,
  type RewritePromptOptions,
} from '@/lib/content/rewrite-prompts'
import type { Article } from '@/types/content'

// ==============================================================
// テスト用データ
// ==============================================================

function createMockArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'article-test-001',
    title: 'AGA治療の費用相場と選び方ガイド',
    slug: 'aga-treatment-cost-guide',
    lead: 'AGA治療の費用について詳しく解説します。',
    content: 'AGA治療の費用相場は月額3,000円〜30,000円程度です。クリニック選びのポイントも解説します。',
    sections: [
      { heading: 'AGA治療とは', level: 'h2', content: 'AGAとは男性型脱毛症のことです。' },
      { heading: '費用相場', level: 'h2', content: '月額3,000円〜30,000円が目安です。' },
      { heading: 'クリニックの選び方', level: 'h2', content: 'オンライン診療対応のクリニックが便利です。' },
    ],
    category: 'aga',
    seo: {
      title: 'AGA治療の費用相場と選び方',
      description: 'AGA治療の費用を徹底解説',
      keywords: ['AGA治療', '費用', 'クリニック'],
    },
    author: {
      name: 'MENS CATALY 編集部',
      credentials: '医療メディア編集',
      bio: 'メンズ医療に特化した編集部です。',
    },
    supervisor: {
      name: '田中太郎',
      credentials: '日本皮膚科学会認定 皮膚科専門医',
      bio: '皮膚科専門医として15年以上の診療経験。',
    },
    references: [
      { title: '日本皮膚科学会ガイドライン', url: 'https://www.dermatol.or.jp/', source: '日本皮膚科学会' },
      { title: 'AGA診療ガイドライン', url: 'https://pubmed.ncbi.nlm.nih.gov/12345/', source: 'PubMed' },
    ],
    publishedAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-02-15T09:00:00Z',
    tags: ['AGA', '費用', 'クリニック比較'],
    hasPRDisclosure: true,
    isCompliant: true,
    complianceScore: 90,
    ...overrides,
  }
}

// ==============================================================
// 各理由タイプのプロンプト生成テスト
// ==============================================================

describe('リライトプロンプト生成 — 理由タイプ別', () => {
  const reasons: RewriteReason[] = [
    'seo_improvement',
    'compliance_fix',
    'content_update',
    'internal_linking',
    'eeat_enhancement',
  ]

  const article = createMockArticle()

  for (const reason of reasons) {
    describe(`${reason}`, () => {
      it('プロンプト結果が生成されること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(result).toBeDefined()
      })

      it('理由が正しく設定されること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(result.reason).toBe(reason)
      })

      it('systemPrompt が生成されること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(result.systemPrompt).toBeDefined()
        expect(result.systemPrompt.length).toBeGreaterThan(0)
      })

      it('userMessage が生成されること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(result.userMessage).toBeDefined()
        expect(result.userMessage.length).toBeGreaterThan(0)
      })

      it('improvementSummary が配列であること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(result.improvementSummary).toBeDefined()
        expect(Array.isArray(result.improvementSummary)).toBe(true)
        // compliance_fix with no violations and hasPRDisclosure=true may have empty summary
        if (reason !== 'compliance_fix') {
          expect(result.improvementSummary.length).toBeGreaterThan(0)
        }
      })

      it('estimatedTokens が正の数であること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(typeof result.estimatedTokens).toBe('number')
        expect(result.estimatedTokens).toBeGreaterThan(0)
      })

      it('systemPrompt に薬機法関連の記載が含まれること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(result.systemPrompt).toContain('薬機法')
      })

      it('userMessage に記事タイトルが含まれること', () => {
        const result = generateRewritePrompt(article, reason)
        expect(result.userMessage).toContain(article.title)
      })
    })
  }
})

// ==============================================================
// SEO改善プロンプトテスト
// ==============================================================

describe('リライトプロンプト — SEO改善', () => {
  const article = createMockArticle()

  it('targetKeywords が userMessage に反映されること', () => {
    const options: RewritePromptOptions = {
      targetKeywords: ['AGA オンライン', 'AGA 費用 安い'],
    }
    const result = generateRewritePrompt(article, 'seo_improvement', options)
    expect(result.userMessage).toContain('AGA オンライン')
    expect(result.userMessage).toContain('AGA 費用 安い')
  })

  it('文字数が少ない記事に対して拡充推奨が含まれること', () => {
    const shortArticle = createMockArticle({ content: '短い記事です。' })
    const result = generateRewritePrompt(shortArticle, 'seo_improvement')
    const hasLengthRecommendation = result.improvementSummary.some(
      (s) => s.includes('文字') || s.includes('拡充')
    )
    expect(hasLengthRecommendation).toBe(true)
  })

  it('SEO改善のsystemPromptにSEO関連キーワードが含まれること', () => {
    const result = generateRewritePrompt(article, 'seo_improvement')
    expect(result.systemPrompt).toContain('SEO')
  })
})

// ==============================================================
// コンプライアンス修正プロンプトテスト
// ==============================================================

describe('リライトプロンプト — コンプライアンス修正', () => {
  const article = createMockArticle()

  it('complianceViolations が userMessage に反映されること', () => {
    const options: RewritePromptOptions = {
      complianceViolations: [
        {
          ngText: '確実に髪が生える',
          suggestedText: '発毛を促進する効果が期待できる',
          reason: '薬機法違反',
        },
        {
          ngText: '業界最安値',
          suggestedText: '調査時点での価格',
          reason: '景表法違反',
        },
      ],
    }
    const result = generateRewritePrompt(article, 'compliance_fix', options)
    expect(result.userMessage).toContain('確実に髪が生える')
    expect(result.userMessage).toContain('業界最安値')
  })

  it('PR表記がない記事に対してPR追加推奨が含まれること', () => {
    const noPRArticle = createMockArticle({ hasPRDisclosure: false })
    const result = generateRewritePrompt(noPRArticle, 'compliance_fix')
    const hasPRRecommendation = result.improvementSummary.some(
      (s) => s.includes('PR')
    )
    expect(hasPRRecommendation).toBe(true)
  })

  it('systemPrompt にコンプライアンス関連の記載が含まれること', () => {
    const result = generateRewritePrompt(article, 'compliance_fix')
    expect(result.systemPrompt).toContain('コンプライアンス')
  })
})

// ==============================================================
// 情報更新プロンプトテスト
// ==============================================================

describe('リライトプロンプト — 情報更新', () => {
  const article = createMockArticle()

  it('updatePoints が userMessage に反映されること', () => {
    const options: RewritePromptOptions = {
      updatePoints: ['フィナステリドの価格変更', '新しいクリニックの追加'],
    }
    const result = generateRewritePrompt(article, 'content_update', options)
    expect(result.userMessage).toContain('フィナステリドの価格変更')
    expect(result.userMessage).toContain('新しいクリニックの追加')
  })

  it('systemPrompt に情報更新関連の記載が含まれること', () => {
    const result = generateRewritePrompt(article, 'content_update')
    expect(result.systemPrompt).toContain('情報更新')
  })
})

// ==============================================================
// 内部リンク追加プロンプトテスト
// ==============================================================

describe('リライトプロンプト — 内部リンク追加', () => {
  const article = createMockArticle()

  it('internalLinks が userMessage に反映されること', () => {
    const options: RewritePromptOptions = {
      internalLinks: [
        {
          title: 'ED治療の費用ガイド',
          url: '/articles/ed-treatment-cost',
          anchorText: 'ED治療の費用について',
        },
      ],
    }
    const result = generateRewritePrompt(article, 'internal_linking', options)
    expect(result.userMessage).toContain('ED治療の費用')
  })

  it('systemPrompt に内部リンク関連の記載が含まれること', () => {
    const result = generateRewritePrompt(article, 'internal_linking')
    expect(result.systemPrompt).toContain('内部リンク')
  })
})

// ==============================================================
// E-E-A-T強化プロンプトテスト
// ==============================================================

describe('リライトプロンプト — E-E-A-T強化', () => {
  const article = createMockArticle()

  it('eeatPoints が improvementSummary に反映されること', () => {
    const options: RewritePromptOptions = {
      eeatPoints: ['学会ガイドラインの引用を追加', '症例データの補足'],
    }
    const result = generateRewritePrompt(article, 'eeat_enhancement', options)
    const hasEeatPoint = result.improvementSummary.some(
      (s) => s.includes('学会ガイドライン') || s.includes('症例データ')
    )
    expect(hasEeatPoint).toBe(true)
  })

  it('監修者なしの記事に対して監修者追加推奨が含まれること', () => {
    const noSupervisorArticle = createMockArticle({ supervisor: undefined })
    const result = generateRewritePrompt(noSupervisorArticle, 'eeat_enhancement')
    const hasSupervisorRecommendation = result.improvementSummary.some(
      (s) => s.includes('監修者')
    )
    expect(hasSupervisorRecommendation).toBe(true)
  })

  it('参考文献が少ない記事に対して参考文献追加推奨が含まれること', () => {
    const fewRefsArticle = createMockArticle({ references: [] })
    const result = generateRewritePrompt(fewRefsArticle, 'eeat_enhancement')
    const hasRefRecommendation = result.improvementSummary.some(
      (s) => s.includes('参考文献')
    )
    expect(hasRefRecommendation).toBe(true)
  })

  it('systemPrompt に E-E-A-T 関連の記載が含まれること', () => {
    const result = generateRewritePrompt(article, 'eeat_enhancement')
    expect(result.systemPrompt).toContain('E-E-A-T')
  })
})

// ==============================================================
// ユーティリティテスト
// ==============================================================

describe('リライトプロンプト — ユーティリティ', () => {
  it('全リライト理由の一覧が取得できること', () => {
    const reasons = getAllRewriteReasons()
    expect(reasons.length).toBe(5)
    expect(reasons).toContain('seo_improvement')
    expect(reasons).toContain('compliance_fix')
    expect(reasons).toContain('content_update')
    expect(reasons).toContain('internal_linking')
    expect(reasons).toContain('eeat_enhancement')
  })

  it('各リライト理由の日本語ラベルが取得できること', () => {
    expect(getRewriteReasonLabel('seo_improvement')).toBe('SEO改善')
    expect(getRewriteReasonLabel('compliance_fix')).toBe('コンプライアンス修正')
    expect(getRewriteReasonLabel('content_update')).toBe('情報更新')
    expect(getRewriteReasonLabel('internal_linking')).toBe('内部リンク追加')
    expect(getRewriteReasonLabel('eeat_enhancement')).toBe('E-E-A-T強化')
  })

  it('記事カテゴリが userMessage に反映されること', () => {
    const article = createMockArticle({ category: 'ed' })
    const result = generateRewritePrompt(article, 'seo_improvement')
    // category label should be in the user message
    expect(result.userMessage).toContain('ED治療')
  })
})
