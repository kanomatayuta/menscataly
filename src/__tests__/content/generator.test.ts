/**
 * ArticleGenerator Unit Tests
 * 記事生成エンジンのテスト — Claude API モック / プロンプト構築 / エラーハンドリング
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// モック定義
// ============================================================

// Claude API client モック
const mockGenerate = vi.fn()
vi.mock('@/lib/ai/client', () => ({
  createArticleGenerationClient: () => ({
    isDryRun: false,
    generate: mockGenerate,
  }),
}))

// ComplianceChecker モック
const mockCheck = vi.fn()
vi.mock('@/lib/compliance/checker', () => ({
  ComplianceChecker: class MockComplianceChecker {
    check = mockCheck
  },
}))

// PR disclosure モック
vi.mock('@/lib/compliance/templates/pr-disclosure', () => ({
  insertPRDisclosure: vi.fn((text: string) => `{{PR_DISCLOSURE}}\n${text}`),
}))

// CostTracker モック (動的インポート)
vi.mock('@/lib/batch/cost-tracker', () => ({
  CostTracker: class MockCostTracker {
    recordCost = vi.fn().mockResolvedValue(undefined)
  },
}))

// コンテンツモジュールモック
vi.mock('@/lib/content/index', () => ({
  buildBasePrompt: vi.fn(() => 'base-prompt'),
  getCategoryPrompt: vi.fn(() => 'category-prompt'),
  buildSEOPrompt: vi.fn(() => 'seo-prompt'),
  buildEEATPrompt: vi.fn(() => 'eeat-prompt'),
  getRecommendedReferences: vi.fn(() => [
    { title: 'Ref 1', url: 'https://example.com/ref1' },
  ]),
  getSupervisorTemplate: vi.fn(() => ({
    name: '田中太郎',
    credentials: '皮膚科専門医',
    bio: '医師プロフィール',
  })),
  getContentGuide: vi.fn(() => ({
    category: 'aga',
    naturalMentionTemplates: ['テンプレート例'],
    ctaGuidelines: ['CTAガイドライン例'],
    complianceSafePhrases: ['安全フレーズ例'],
    forbiddenPhrases: ['禁止フレーズ例'],
  })),
  getCategoryAffiliateGuide: vi.fn(() => 'アフィリエイトリンク配置ガイド'),
}))

vi.mock('@/lib/content/utils/text-utils', () => ({
  slugify: vi.fn((text: string) => text.toLowerCase().replace(/\s+/g, '-')),
  extractExcerpt: vi.fn((text: string) => text.slice(0, 120)),
}))

vi.mock('@/lib/content/utils/reading-time', () => ({
  calculateReadingTime: vi.fn(() => ({ minutes: 5, charCount: 3000, words: 1500 })),
}))

vi.mock('@/lib/content/templates/article-templates', () => ({
  ARTICLE_TEMPLATES: {
    aga: {
      sections: [
        { heading: 'テストセクション', level: 'h2', description: 'テスト', subsections: [] },
      ],
      ctaPositions: [{ afterSectionIndex: 0, variant: 'primary' }],
      wordCountTarget: 3000,
    },
    'hair-removal': {
      sections: [],
      ctaPositions: [],
      wordCountTarget: 3000,
    },
    skincare: {
      sections: [],
      ctaPositions: [],
      wordCountTarget: 3000,
    },
    ed: {
      sections: [],
      ctaPositions: [],
      wordCountTarget: 3000,
    },
    column: {
      sections: [],
      ctaPositions: [],
      wordCountTarget: 2000,
    },
  },
}))

vi.mock('@/lib/content/templates/cta-templates', () => ({
  CTA_TEMPLATES: {
    aga: [{ text: '無料カウンセリングはこちら', variant: 'primary' }],
    'hair-removal': [],
    skincare: [],
    ed: [],
    column: [],
  },
}))

import { ArticleGenerator } from '@/lib/content/generator'
import type { ContentGenerationRequest } from '@/types/content'

// ============================================================
// テスト用データ
// ============================================================

const createRequest = (overrides: Partial<ContentGenerationRequest> = {}): ContentGenerationRequest => ({
  category: 'aga',
  keyword: 'AGA 治療 費用',
  subKeywords: ['AGA クリニック', 'フィナステリド 価格'],
  targetAudience: '20〜40代男性',
  tone: 'informative',
  targetLength: 3000,
  ...overrides,
})

const validJsonResponse = JSON.stringify({
  title: 'AGA治療の費用ガイド',
  lead: 'AGA治療にかかる費用を詳しく解説します。',
  sections: [
    {
      heading: 'AGA治療の費用相場',
      level: 'h2',
      content: 'AGA治療の費用相場を解説します。',
      subsections: [
        {
          heading: 'フィナステリドの費用',
          level: 'h3',
          content: 'フィナステリドの月額費用は3,000〜8,000円程度です。',
        },
      ],
    },
    {
      heading: 'まとめ',
      level: 'h2',
      content: 'AGA治療は早期に始めることが大切です。',
    },
  ],
  conclusion: '以上がAGA治療の費用の概要です。',
  cta: '無料カウンセリングのご予約はこちらから。',
  tags: ['AGA', '費用', '治療'],
  references: [
    { title: 'AGA診療ガイドライン', url: 'https://example.com', author: '日本皮膚科学会', year: 2023 },
  ],
})

const compliantResult = {
  isCompliant: true,
  violations: [],
  fixedText: '修正済みテキスト',
  hasPRDisclosure: true,
  missingItems: [],
  score: 100,
}

const nonCompliantResult = {
  isCompliant: false,
  violations: [
    {
      id: 'v1',
      type: 'pharmaceutical_law' as const,
      severity: 'high' as const,
      ngText: '確実に髪が生える',
      suggestedText: '発毛を促進する効果が期待できる',
      reason: '薬機法違反',
      position: { start: 0, end: 10 },
    },
  ],
  fixedText: '修正後のテキスト',
  hasPRDisclosure: false,
  missingItems: ['PR表記'],
  score: 60,
}

// ============================================================
// テスト
// ============================================================

describe('ArticleGenerator', () => {
  let generator: ArticleGenerator

  beforeEach(() => {
    vi.clearAllMocks()
    generator = new ArticleGenerator()
  })

  // ============================================================
  // 記事生成フロー
  // ============================================================

  describe('generate — 正常フロー', () => {
    it('Claude APIを呼び出して記事を生成すること', async () => {
      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${validJsonResponse}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000, estimatedCostUsd: 0.033 },
        durationMs: 5000,
        stopReason: 'end_turn',
      })

      mockCheck.mockReturnValue(compliantResult)

      const request = createRequest()
      const result = await generator.generate(request)

      expect(result.article).toBeDefined()
      expect(result.article.title).toBe('AGA治療の費用ガイド')
      expect(result.article.category).toBe('aga')
      expect(result.seo).toBeDefined()
      expect(result.compliance).toBeDefined()
      expect(result.model).toBe('claude-sonnet-4-6')
      expect(result.generatedAt).toBeDefined()
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('コンプライアンスチェック合格時にisCompliant=trueを設定すること', async () => {
      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${validJsonResponse}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const result = await generator.generate(createRequest())

      expect(result.article.isCompliant).toBe(true)
      expect(result.article.complianceScore).toBe(100)
      expect(result.article.hasPRDisclosure).toBe(true)
    })

    it('セクションが正しくパースされること', async () => {
      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${validJsonResponse}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const result = await generator.generate(createRequest())

      // sections には元のセクション + conclusion セクションが含まれる
      expect(result.article.sections.length).toBeGreaterThanOrEqual(2)
      expect(result.article.sections[0].heading).toBe('AGA治療の費用相場')
      expect(result.article.sections[0].level).toBe('h2')
    })
  })

  // ============================================================
  // コンプライアンス自動修正
  // ============================================================

  describe('generate — コンプライアンス自動修正', () => {
    it('NG表現がある場合に自動修正を実行すること', async () => {
      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${validJsonResponse}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      // 初回チェック: NG
      mockCheck
        .mockReturnValueOnce(nonCompliantResult)
        // 修正後の再チェック: OK
        .mockReturnValueOnce({ ...compliantResult, score: 98 })

      const result = await generator.generate(createRequest())

      // checkが2回呼ばれる（初回 + 修正後）
      expect(mockCheck).toHaveBeenCalledTimes(2)
      expect(result.article.complianceScore).toBe(98)
    })

    it('修正後もスコアが閾値未満の場合にisCompliant=falseを返すこと', async () => {
      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${validJsonResponse}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      // 初回・修正後ともにスコア不足
      mockCheck.mockReturnValue({ ...nonCompliantResult, score: 80 })

      const result = await generator.generate(createRequest())

      expect(result.article.isCompliant).toBe(false)
      expect(result.article.complianceScore).toBe(80)
    })
  })

  // ============================================================
  // JSONパース
  // ============================================================

  describe('generate — JSONパースエラーハンドリング', () => {
    it('不正なJSONの場合にフォールバック記事を生成すること', async () => {
      mockGenerate.mockResolvedValue({
        content: 'これはJSONではないテキストです。記事の内容がここに入ります。',
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 500, outputTokens: 1000, totalTokens: 1500 },
        durationMs: 3000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const result = await generator.generate(createRequest())

      // フォールバックでも記事は生成される
      expect(result.article).toBeDefined()
      expect(result.article.title).toContain('AGA 治療 費用')
      expect(result.article.category).toBe('aga')
    })

    it('JSONコードブロックなしの直接JSONを処理できること', async () => {
      mockGenerate.mockResolvedValue({
        content: validJsonResponse,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const result = await generator.generate(createRequest())

      expect(result.article.title).toBe('AGA治療の費用ガイド')
    })
  })

  // ============================================================
  // カテゴリマッピング
  // ============================================================

  describe('generate — カテゴリ別処理', () => {
    it.each([
      ['aga', 'aga'],
      ['hair-removal', 'hair_removal'],
      ['skincare', 'skincare'],
      ['ed', 'ed'],
      ['column', 'column'],
    ] as const)('カテゴリ %s が正しくマッピングされること', async (contentCategory, expectedComplianceCategory) => {
      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${validJsonResponse}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const request = createRequest({ category: contentCategory })
      await generator.generate(request)

      // ComplianceChecker.check のカテゴリ引数を検証
      expect(mockCheck).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          categories: expect.arrayContaining([expectedComplianceCategory]),
        })
      )
    })
  })

  // ============================================================
  // アフィリエイトリンク注入
  // ============================================================

  describe('generate — アフィリエイトリンク注入', () => {
    it('アフィリエイトリンクがコンテンツに注入されること', async () => {
      const responseWithAnchor = JSON.stringify({
        ...JSON.parse(validJsonResponse),
        sections: [
          {
            heading: 'AGA治療の費用相場',
            level: 'h2',
            content: 'AGAスキンクリニックは人気のクリニックです。',
          },
        ],
      })

      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${responseWithAnchor}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const request = createRequest({
        affiliateLinks: [
          {
            programName: 'AGAスキンクリニック',
            aspName: 'A8',
            url: 'https://example.com/aff/aga-skin',
            rewardAmount: 15000,
            anchorText: 'AGAスキンクリニック',
          },
        ],
      })

      const result = await generator.generate(request)

      expect(result.article.content).toContain('rel="sponsored noopener"')
    })

    it('アフィリエイトリンクにアンカーテキストとURLが含まれること', async () => {
      const responseWithAnchor = JSON.stringify({
        ...JSON.parse(validJsonResponse),
        sections: [
          {
            heading: 'AGA治療の費用相場',
            level: 'h2',
            content: 'AGAスキンクリニックは信頼できるクリニックです。',
          },
        ],
      })

      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${responseWithAnchor}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const request = createRequest({
        affiliateLinks: [
          {
            programName: 'AGAスキンクリニック',
            aspName: 'A8',
            url: 'https://example.com/aff/aga-skin',
            rewardAmount: 15000,
            anchorText: 'AGAスキンクリニック',
          },
        ],
      })

      const result = await generator.generate(request)

      // リンクにアンカーテキストが含まれること
      expect(result.article.content).toContain('AGAスキンクリニック')
      // リンクにURLが含まれること
      expect(result.article.content).toContain('https://example.com/aff/aga-skin')
    })

    it('アンカーテキストがコンテンツに存在しない場合はリンクが注入されないこと', async () => {
      mockGenerate.mockResolvedValue({
        content: `\`\`\`json\n${validJsonResponse}\n\`\`\``,
        model: 'claude-sonnet-4-6',
        tokenUsage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 },
        durationMs: 5000,
      })

      mockCheck.mockReturnValue(compliantResult)

      const request = createRequest({
        affiliateLinks: [
          {
            programName: '存在しないクリニック',
            aspName: 'A8',
            url: 'https://example.com/aff/nonexistent',
            rewardAmount: 10000,
            anchorText: '存在しないクリニックのテキスト',
          },
        ],
      })

      const result = await generator.generate(request)

      expect(result.article.content).not.toContain('https://example.com/aff/nonexistent')
    })
  })

  // ============================================================
  // API エラーハンドリング
  // ============================================================

  describe('generate — エラーハンドリング', () => {
    it('Claude API エラー時に例外がスローされること', async () => {
      mockGenerate.mockRejectedValue(new Error('API rate limit exceeded'))

      const request = createRequest()

      await expect(generator.generate(request)).rejects.toThrow('API rate limit exceeded')
    })
  })
})
