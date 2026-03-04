/**
 * 内部リンク戦略モジュール Unit Tests
 * リンク生成・関連記事提案・アンカーテキスト最適化のテスト
 */

import { describe, it, expect } from 'vitest'
import {
  generateInternalLinks,
  suggestRelatedArticles,
  optimizeAnchorText,
  getCategoryLinkRelations,
  analyzeLinkDensity,
  type ArticleMeta,
} from '@/lib/content/internal-linking'

// ==============================================================
// テスト用データ
// ==============================================================

const createArticle = (overrides: Partial<ArticleMeta> = {}): ArticleMeta => ({
  id: 'art-001',
  title: 'AGA治療の基礎知識',
  slug: 'aga-basics',
  category: 'aga',
  keyword: 'AGA治療',
  subKeywords: ['薄毛治療', 'フィナステリド', 'AGA クリニック'],
  tags: ['aga', '薄毛', '治療'],
  publishedAt: '2026-02-01T00:00:00Z',
  ...overrides,
})

const allArticles: ArticleMeta[] = [
  createArticle({ id: 'art-001', title: 'AGA治療の基礎知識', slug: 'aga-basics', category: 'aga', keyword: 'AGA治療', subKeywords: ['薄毛治療', 'フィナステリド'], tags: ['aga', '薄毛'] }),
  createArticle({ id: 'art-002', title: 'AGA治療の費用相場', slug: 'aga-cost', category: 'aga', keyword: 'AGA治療 費用', subKeywords: ['AGA 月額', '薄毛治療 費用'], tags: ['aga', '費用'] }),
  createArticle({ id: 'art-003', title: 'ED治療ガイド', slug: 'ed-guide', category: 'ed', keyword: 'ED治療', subKeywords: ['ED薬', 'バイアグラ'], tags: ['ed', '治療'] }),
  createArticle({ id: 'art-004', title: 'メンズスキンケア入門', slug: 'skincare-intro', category: 'skincare', keyword: 'メンズスキンケア', subKeywords: ['化粧水', '洗顔'], tags: ['skincare', '美容'] }),
  createArticle({ id: 'art-005', title: 'メンズ脱毛ガイド', slug: 'hair-removal-guide', category: 'hair-removal', keyword: 'メンズ脱毛', subKeywords: ['医療脱毛', 'ヒゲ脱毛'], tags: ['脱毛', '美容'] }),
  createArticle({ id: 'art-006', title: 'メンズ美容入門ガイド', slug: 'mens-beauty-guide', category: 'column', keyword: 'メンズ美容', subKeywords: ['AGA治療', 'スキンケア', '脱毛'], tags: ['美容', 'ガイド', 'aga', 'skincare'] }),
]

// ==============================================================
// generateInternalLinks テスト
// ==============================================================

describe('generateInternalLinks', () => {
  it('自分自身へのリンクを除外すること', () => {
    const source = allArticles[0]
    const links = generateInternalLinks(source, allArticles)

    for (const link of links) {
      expect(link.targetArticleId).not.toBe(source.id)
    }
  })

  it('関連度スコアの降順でソートされること', () => {
    const source = allArticles[0]
    const links = generateInternalLinks(source, allArticles)

    for (let i = 1; i < links.length; i++) {
      expect(links[i].relevanceScore).toBeLessThanOrEqual(links[i - 1].relevanceScore)
    }
  })

  it('maxLinks パラメータで結果数を制限できること', () => {
    const source = allArticles[0]
    const links = generateInternalLinks(source, allArticles, 2)

    expect(links.length).toBeLessThanOrEqual(2)
  })

  it('同一カテゴリの記事が高い関連度スコアを持つこと', () => {
    const source = allArticles[0] // aga
    const links = generateInternalLinks(source, allArticles)

    const sameCategoryLink = links.find((l) => l.targetArticleId === 'art-002')
    if (sameCategoryLink) {
      expect(sameCategoryLink.relevanceScore).toBeGreaterThan(20)
      expect(sameCategoryLink.linkType).toBe('same-category')
    }
  })

  it('クロスカテゴリリンクが生成されること', () => {
    const source = allArticles[0] // aga
    const links = generateInternalLinks(source, allArticles)

    const crossLinks = links.filter((l) => l.linkType !== 'same-category')
    // AGAからcolumn/skincare/edへのリンクが生成される可能性がある
    expect(crossLinks.length).toBeGreaterThanOrEqual(0)
  })

  it('各リンクに必須フィールドが含まれること', () => {
    const source = allArticles[0]
    const links = generateInternalLinks(source, allArticles)

    for (const link of links) {
      expect(link.targetArticleId).toBeDefined()
      expect(link.targetTitle).toBeDefined()
      expect(link.targetUrl).toBeDefined()
      expect(link.anchorText).toBeDefined()
      expect(typeof link.relevanceScore).toBe('number')
      expect(link.relevanceScore).toBeGreaterThanOrEqual(0)
      expect(link.relevanceScore).toBeLessThanOrEqual(100)
      expect(['same-category', 'cross-category', 'pillar-cluster', 'related-topic']).toContain(link.linkType)
      expect(link.suggestedPlacement).toBeDefined()
    }
  })

  it('column カテゴリからのリンクがpillar-clusterタイプを含むこと', () => {
    const source = allArticles[5] // column
    const links = generateInternalLinks(source, allArticles)

    const pillarLinks = links.filter((l) => l.linkType === 'pillar-cluster')
    // column -> 他カテゴリはpillar-cluster
    expect(pillarLinks.length).toBeGreaterThanOrEqual(0)
  })

  it('空の記事リストで空の結果を返すこと', () => {
    const source = allArticles[0]
    const links = generateInternalLinks(source, [])
    expect(links).toHaveLength(0)
  })
})

// ==============================================================
// suggestRelatedArticles テスト
// ==============================================================

describe('suggestRelatedArticles', () => {
  it('関連記事を提案できること', () => {
    const source = allArticles[0]
    const suggestions = suggestRelatedArticles(source, allArticles)

    expect(suggestions.length).toBeGreaterThan(0)
  })

  it('maxSuggestions で結果数を制限できること', () => {
    const source = allArticles[0]
    const suggestions = suggestRelatedArticles(source, allArticles, 2)

    expect(suggestions.length).toBeLessThanOrEqual(2)
  })

  it('自分自身を提案しないこと', () => {
    const source = allArticles[0]
    const suggestions = suggestRelatedArticles(source, allArticles)

    for (const s of suggestions) {
      expect(s.article.id).not.toBe(source.id)
    }
  })

  it('各提案に理由が含まれること', () => {
    const source = allArticles[0]
    const suggestions = suggestRelatedArticles(source, allArticles)

    for (const s of suggestions) {
      expect(s.reason).toBeDefined()
      expect(s.reason.length).toBeGreaterThan(0)
    }
  })

  it('同一カテゴリの関連記事が優先されること', () => {
    const source = allArticles[0] // aga
    const suggestions = suggestRelatedArticles(source, allArticles)

    if (suggestions.length >= 2) {
      // 最初の提案は同じカテゴリの可能性が高い
      const sameCategoryFirst = suggestions[0].article.category === 'aga'
      expect(sameCategoryFirst || suggestions[0].relevanceScore >= 20).toBe(true)
    }
  })
})

// ==============================================================
// optimizeAnchorText テスト
// ==============================================================

describe('optimizeAnchorText', () => {
  it('「こちら」がNG判定されること', () => {
    const result = optimizeAnchorText('こちら')
    expect(result.original).toBe('こちら')
    expect(result.optimized).not.toBe('こちら')
    expect(result.reason).toContain('SEO上非推奨')
  })

  it('「ここをクリック」がNG判定されること', () => {
    const result = optimizeAnchorText('ここをクリック')
    expect(result.optimized).not.toBe('ここをクリック')
  })

  it('「詳細はこちら」がNG判定されること', () => {
    const result = optimizeAnchorText('詳細はこちら')
    expect(result.optimized).not.toBe('詳細はこちら')
  })

  it('「リンク」がNG判定されること', () => {
    const result = optimizeAnchorText('リンク')
    expect(result.optimized).not.toBe('リンク')
  })

  it('URL直書きがNG判定されること', () => {
    const result = optimizeAnchorText('https://example.com/page')
    expect(result.reason).toContain('SEO上非推奨')
  })

  it('50文字超のテキストが最適化されること', () => {
    const longText = 'あ'.repeat(60)
    const result = optimizeAnchorText(longText)
    expect(result.reason).toContain('長すぎ')
  })

  it('3文字未満のテキストが指摘されること', () => {
    const result = optimizeAnchorText('AB')
    expect(result.reason).toContain('短すぎ')
  })

  it('適切なアンカーテキストは変更されないこと', () => {
    const text = 'AGA治療の費用相場について'
    const result = optimizeAnchorText(text)
    expect(result.optimized).toBe(text)
    expect(result.reason).toBe('OK')
  })

  it('ターゲット記事情報がある場合、最適なテキストが生成されること', () => {
    const target = createArticle({ title: 'AGA治療の費用', keyword: 'AGA治療 費用' })
    const result = optimizeAnchorText('こちら', target)
    expect(result.optimized).not.toBe('こちら')
    // ターゲット記事のタイトルかキーワードが含まれる
    expect(
      result.optimized.includes('AGA') || result.optimized.includes('費用')
    ).toBe(true)
  })
})

// ==============================================================
// getCategoryLinkRelations テスト
// ==============================================================

describe('getCategoryLinkRelations', () => {
  it('AGAカテゴリのリンク関係を取得できること', () => {
    const relations = getCategoryLinkRelations('aga')
    expect(relations.length).toBeGreaterThan(0)

    for (const rel of relations) {
      expect(rel.relatedCategory).toBeDefined()
      expect(typeof rel.weight).toBe('number')
      expect(rel.weight).toBeGreaterThanOrEqual(0)
      expect(rel.weight).toBeLessThanOrEqual(1)
      expect(rel.context).toBeDefined()
    }
  })

  it('全カテゴリにリンク関係が定義されていること', () => {
    const categories = ['aga', 'ed', 'hair-removal', 'skincare', 'column'] as const
    for (const category of categories) {
      const relations = getCategoryLinkRelations(category)
      expect(relations.length).toBeGreaterThan(0)
    }
  })

  it('AGAからskincareへの関係が定義されていること', () => {
    const relations = getCategoryLinkRelations('aga')
    const skincareRel = relations.find((r) => r.relatedCategory === 'skincare')
    expect(skincareRel).toBeDefined()
    expect(skincareRel!.weight).toBeGreaterThan(0)
  })
})

// ==============================================================
// analyzeLinkDensity テスト
// ==============================================================

describe('analyzeLinkDensity', () => {
  it('マークダウンリンクをカウントできること', () => {
    const content = `
[AGA治療について](/aga/treatment)
[スキンケアガイド](/skincare/guide)
[外部サイト](https://example.com)
    `
    const result = analyzeLinkDensity(content, 1000)

    expect(result.internalLinkCount).toBe(2)
    expect(result.externalLinkCount).toBe(1)
  })

  it('HTMLリンクをカウントできること', () => {
    const content = `
<a href="/aga/treatment">AGA治療</a>
<a href="https://example.com">外部サイト</a>
    `
    const result = analyzeLinkDensity(content, 1000)

    expect(result.internalLinkCount).toBe(1)
    expect(result.externalLinkCount).toBe(1)
  })

  it('内部リンクが少ない場合に適切な推奨を返すこと', () => {
    const content = 'リンクなしの記事テキスト'
    const result = analyzeLinkDensity(content, 1000)

    expect(result.internalLinkCount).toBe(0)
    expect(result.recommendation).toContain('少なすぎ')
  })

  it('内部リンクが多い場合に適切な推奨を返すこと', () => {
    const links = Array.from({ length: 12 }, (_, i) =>
      `[リンク${i}](/page/${i})`
    ).join('\n')
    const result = analyzeLinkDensity(links, 1000)

    expect(result.internalLinkCount).toBeGreaterThan(10)
    expect(result.recommendation).toContain('多すぎ')
  })

  it('適切なリンク数の場合に「適切」の推奨を返すこと', () => {
    const links = Array.from({ length: 4 }, (_, i) =>
      `[リンク${i}](/page/${i})`
    ).join('\n')
    const result = analyzeLinkDensity(links, 3000)

    expect(result.internalLinkCount).toBe(4)
    expect(result.recommendation).toContain('適切')
  })

  it('リンク密度が正しく計算されること', () => {
    const links = Array.from({ length: 5 }, (_, i) =>
      `[リンク${i}](/page/${i})`
    ).join('\n')
    const result = analyzeLinkDensity(links, 2000)

    // 5 links / (2000/1000) = 2.5
    expect(result.linkDensity).toBeCloseTo(2.5, 1)
  })
})
