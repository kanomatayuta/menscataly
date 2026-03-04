/**
 * Q1: 構造化データ (Schema.org JSON-LD) テスト
 * Phase 3 SEO強化 — structured-data.ts のバリデーション
 *
 * - MedicalWebPage スキーマ: 医療コンテンツ向け
 * - FAQPage スキーマ: FAQ セクション
 * - BreadcrumbList スキーマ: パンくずリスト
 * - HowTo スキーマ: 治療ガイド記事
 * - Person スキーマ: 監修者情報
 * - 統合 @graph: 記事用複合スキーマ
 */

import { describe, it, expect } from 'vitest'
import {
  generateMedicalWebPageSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateHowToSchema,
  generatePersonSchema,
  generateArticleStructuredData,
  extractFAQsFromContent,
  type FAQItem,
  type HowToStep,
} from '@/lib/seo/structured-data'
import type { MicroCMSArticle } from '@/types/microcms'

// ==============================================================
// テスト用データ
// ==============================================================

function createMockArticle(overrides: Partial<MicroCMSArticle> = {}): MicroCMSArticle {
  return {
    id: 'test-article-001',
    title: 'AGA治療の費用相場と選び方',
    slug: 'aga-treatment-cost',
    content: '<p>AGA治療について解説します。</p>',
    excerpt: 'AGA治療の費用を徹底解説。',
    category: {
      id: 'aga',
      name: 'AGA・薄毛',
      slug: 'aga',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      publishedAt: '2026-01-01T00:00:00Z',
      revisedAt: '2026-01-01T00:00:00Z',
    },
    author_name: 'メンズカタリ編集部',
    supervisor_name: '田中太郎',
    supervisor_creds: '日本皮膚科学会認定 皮膚科専門医',
    supervisor_bio: '皮膚科専門医として15年の経験を持つ。',
    is_pr: true,
    compliance_score: 95,
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z',
    publishedAt: '2026-01-15T09:00:00Z',
    revisedAt: '2026-03-01T09:00:00Z',
    ...overrides,
  }
}

// ==============================================================
// MedicalWebPage スキーマテスト
// ==============================================================

describe('MedicalWebPage スキーマ生成', () => {
  it('@context が "https://schema.org" であること', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)
    expect(schema['@context']).toBe('https://schema.org')
  })

  it('AGA カテゴリの記事が MedicalWebPage タイプになること', () => {
    const article = createMockArticle({ category: { id: 'aga', name: 'AGA', slug: 'aga', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' } })
    const schema = generateMedicalWebPageSchema(article)
    expect(schema['@type']).toBe('MedicalWebPage')
  })

  it('ED カテゴリの記事が MedicalWebPage タイプになること', () => {
    const article = createMockArticle({
      category: { id: 'ed', name: 'ED・勃起不全', slug: 'ed', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const schema = generateMedicalWebPageSchema(article)
    expect(schema['@type']).toBe('MedicalWebPage')
  })

  it('スキンケアカテゴリの記事が Article タイプになること', () => {
    const article = createMockArticle({
      category: { id: 'skincare', name: 'スキンケア', slug: 'skincare', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const schema = generateMedicalWebPageSchema(article)
    expect(schema['@type']).toBe('Article')
  })

  it('必須フィールドが全て含まれること', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)

    expect(schema['@context']).toBeDefined()
    expect(schema['@type']).toBeDefined()
    expect(schema['headline']).toBe(article.title)
    expect(schema['datePublished']).toBe(article.publishedAt)
    expect(schema['dateModified']).toBe(article.updatedAt)
    expect(schema['url']).toBeDefined()
    expect(schema['author']).toBeDefined()
    expect(schema['publisher']).toBeDefined()
  })

  it('reviewedBy (監修者) が含まれること', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)

    expect(schema['reviewedBy']).toBeDefined()
    const reviewer = schema['reviewedBy'] as Record<string, unknown>
    expect(reviewer['@type']).toBe('Person')
    expect(reviewer['name']).toBe('田中太郎')
    expect(reviewer['jobTitle']).toBe('日本皮膚科学会認定 皮膚科専門医')
  })

  it('dateModified が含まれること', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)
    expect(schema['dateModified']).toBe(article.updatedAt)
  })

  it('lastReviewed が含まれること（監修者ありの場合）', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)
    expect(schema['lastReviewed']).toBeDefined()
  })

  it('監修者なしの場合 reviewedBy が含まれないこと', () => {
    const article = createMockArticle({
      supervisor_name: undefined,
    })
    const schema = generateMedicalWebPageSchema(article)
    expect(schema['reviewedBy']).toBeUndefined()
  })

  it('AGA カテゴリで about フィールドが MedicalCondition を含むこと', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)
    const about = schema['about'] as Record<string, unknown>
    expect(about).toBeDefined()
    expect(about['@type']).toBe('MedicalCondition')
    expect(about['name']).toContain('AGA')
  })
})

// ==============================================================
// FAQPage スキーマテスト
// ==============================================================

describe('FAQPage スキーマ生成', () => {
  const faqs: FAQItem[] = [
    { question: 'AGA治療はいつから始めるべき？', answer: '薄毛が気になったらすぐに相談をおすすめします。' },
    { question: 'AGA治療の費用は？', answer: '月額5,000円〜30,000円が目安です。' },
  ]

  it('@context が正しいこと', () => {
    const schema = generateFAQSchema(faqs)
    expect(schema['@context']).toBe('https://schema.org')
  })

  it('@type が FAQPage であること', () => {
    const schema = generateFAQSchema(faqs)
    expect(schema['@type']).toBe('FAQPage')
  })

  it('mainEntity に全 FAQ が含まれること', () => {
    const schema = generateFAQSchema(faqs)
    const mainEntity = schema['mainEntity'] as Record<string, unknown>[]
    expect(mainEntity).toHaveLength(2)
  })

  it('各 FAQ アイテムが Question タイプであること', () => {
    const schema = generateFAQSchema(faqs)
    const mainEntity = schema['mainEntity'] as Record<string, unknown>[]

    for (const item of mainEntity) {
      expect(item['@type']).toBe('Question')
      expect(item['name']).toBeDefined()
      expect(typeof item['name']).toBe('string')
    }
  })

  it('各 FAQ の acceptedAnswer が Answer タイプであること', () => {
    const schema = generateFAQSchema(faqs)
    const mainEntity = schema['mainEntity'] as Record<string, unknown>[]

    for (const item of mainEntity) {
      const answer = item['acceptedAnswer'] as Record<string, unknown>
      expect(answer['@type']).toBe('Answer')
      expect(answer['text']).toBeDefined()
      expect(typeof answer['text']).toBe('string')
    }
  })

  it('空の FAQ 配列でも正しいスキーマが生成されること', () => {
    const schema = generateFAQSchema([])
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('FAQPage')
    const mainEntity = schema['mainEntity'] as Record<string, unknown>[]
    expect(mainEntity).toHaveLength(0)
  })
})

// ==============================================================
// BreadcrumbList スキーマテスト
// ==============================================================

describe('BreadcrumbList スキーマ生成', () => {
  it('@context が正しいこと', () => {
    const schema = generateBreadcrumbSchema('aga', 'AGA・薄毛', 'テスト記事', 'test-article')
    expect(schema['@context']).toBe('https://schema.org')
  })

  it('@type が BreadcrumbList であること', () => {
    const schema = generateBreadcrumbSchema('aga', 'AGA・薄毛', 'テスト記事', 'test-article')
    expect(schema['@type']).toBe('BreadcrumbList')
  })

  it('カテゴリありの場合に4つのパンくず要素があること', () => {
    const schema = generateBreadcrumbSchema('aga', 'AGA・薄毛', 'テスト記事', 'test-article')
    const items = schema['itemListElement'] as Record<string, unknown>[]
    expect(items).toHaveLength(4)
  })

  it('カテゴリなしの場合に3つのパンくず要素があること', () => {
    const schema = generateBreadcrumbSchema(undefined, undefined, 'テスト記事', 'test-article')
    const items = schema['itemListElement'] as Record<string, unknown>[]
    expect(items).toHaveLength(3)
  })

  it('各要素に position, name が含まれること', () => {
    const schema = generateBreadcrumbSchema('aga', 'AGA・薄毛', 'テスト記事', 'test-article')
    const items = schema['itemListElement'] as Record<string, unknown>[]

    for (const item of items) {
      expect(item['@type']).toBe('ListItem')
      expect(typeof item['position']).toBe('number')
      expect(typeof item['name']).toBe('string')
      expect(item['item']).toBeDefined()
    }
  })

  it('position が1から連番であること', () => {
    const schema = generateBreadcrumbSchema('aga', 'AGA・薄毛', 'テスト記事', 'test-article')
    const items = schema['itemListElement'] as Record<string, unknown>[]

    items.forEach((item, index) => {
      expect(item['position']).toBe(index + 1)
    })
  })

  it('最初のパンくずが「ホーム」であること', () => {
    const schema = generateBreadcrumbSchema('aga', 'AGA・薄毛', 'テスト記事', 'test-article')
    const items = schema['itemListElement'] as Record<string, unknown>[]
    expect(items[0]['name']).toBe('ホーム')
  })
})

// ==============================================================
// HowTo スキーマテスト
// ==============================================================

describe('HowTo スキーマ生成', () => {
  const steps: HowToStep[] = [
    { name: 'クリニックを選ぶ', text: 'まずは比較サイトで候補のクリニックを絞りましょう。' },
    { name: '無料カウンセリングを予約', text: '気になるクリニックの無料カウンセリングを予約します。' },
    { name: '治療開始', text: '医師の診断後、治療プランを決定して治療を開始します。' },
  ]

  it('@context が正しいこと', () => {
    const schema = generateHowToSchema('AGA治療の始め方', 'AGA治療を開始するまでの手順', steps)
    expect(schema['@context']).toBe('https://schema.org')
  })

  it('@type が HowTo であること', () => {
    const schema = generateHowToSchema('AGA治療の始め方', 'AGA治療を開始するまでの手順', steps)
    expect(schema['@type']).toBe('HowTo')
  })

  it('name と description が正しいこと', () => {
    const schema = generateHowToSchema('AGA治療の始め方', '手順の説明', steps)
    expect(schema['name']).toBe('AGA治療の始め方')
    expect(schema['description']).toBe('手順の説明')
  })

  it('全ステップが含まれること', () => {
    const schema = generateHowToSchema('テスト', '説明', steps)
    const schemaSteps = schema['step'] as Record<string, unknown>[]
    expect(schemaSteps).toHaveLength(3)
  })

  it('各ステップに必須フィールドが含まれること', () => {
    const schema = generateHowToSchema('テスト', '説明', steps)
    const schemaSteps = schema['step'] as Record<string, unknown>[]

    schemaSteps.forEach((step, index) => {
      expect(step['@type']).toBe('HowToStep')
      expect(step['position']).toBe(index + 1)
      expect(step['name']).toBeDefined()
      expect(step['text']).toBeDefined()
    })
  })

  it('オプションフィールド (url, image) がある場合に含まれること', () => {
    const stepsWithOptional: HowToStep[] = [
      { name: 'ステップ1', text: '説明', url: 'https://example.com/step1', image: 'https://example.com/img1.jpg' },
    ]
    const schema = generateHowToSchema('テスト', '説明', stepsWithOptional)
    const schemaSteps = schema['step'] as Record<string, unknown>[]

    expect(schemaSteps[0]['url']).toBe('https://example.com/step1')
    expect(schemaSteps[0]['image']).toBe('https://example.com/img1.jpg')
  })
})

// ==============================================================
// Person スキーマテスト
// ==============================================================

describe('Person スキーマ生成', () => {
  it('必須フィールドが含まれること', () => {
    const schema = generatePersonSchema('田中太郎', '皮膚科専門医')
    expect(schema['@context']).toBe('https://schema.org')
    expect(schema['@type']).toBe('Person')
    expect(schema['name']).toBe('田中太郎')
    expect(schema['jobTitle']).toBe('皮膚科専門医')
  })

  it('オプションフィールドが含まれること', () => {
    const schema = generatePersonSchema(
      '田中太郎',
      '皮膚科専門医',
      '15年の経験を持つ専門医',
      ['日本皮膚科学会'],
      'https://example.com/photo.jpg'
    )

    expect(schema['description']).toBe('15年の経験を持つ専門医')
    expect(schema['image']).toBe('https://example.com/photo.jpg')

    const memberOf = schema['memberOf'] as Record<string, unknown>[]
    expect(memberOf).toHaveLength(1)
    expect(memberOf[0]['@type']).toBe('Organization')
    expect(memberOf[0]['name']).toBe('日本皮膚科学会')
  })

  it('affiliations が空の場合 memberOf が含まれないこと', () => {
    const schema = generatePersonSchema('田中太郎', '皮膚科専門医', undefined, [])
    expect(schema['memberOf']).toBeUndefined()
  })
})

// ==============================================================
// 統合 @graph テスト
// ==============================================================

describe('記事用統合 JSON-LD (@graph)', () => {
  it('@context が "https://schema.org" であること', () => {
    const article = createMockArticle()
    const schema = generateArticleStructuredData(article)
    expect(schema['@context']).toBe('https://schema.org')
  })

  it('@graph 配列が含まれること', () => {
    const article = createMockArticle()
    const schema = generateArticleStructuredData(article)
    expect(Array.isArray(schema['@graph'])).toBe(true)
  })

  it('@graph に Article/MedicalWebPage と BreadcrumbList が含まれること', () => {
    const article = createMockArticle()
    const schema = generateArticleStructuredData(article)
    const graph = schema['@graph'] as Record<string, unknown>[]

    const types = graph.map((item) => item['@type'])
    expect(types).toContain('MedicalWebPage')
    expect(types).toContain('BreadcrumbList')
  })

  it('FAQ を渡した場合に @graph に FAQPage が含まれること', () => {
    const article = createMockArticle()
    const faqs: FAQItem[] = [
      { question: 'Q1', answer: 'A1' },
    ]
    const schema = generateArticleStructuredData(article, faqs)
    const graph = schema['@graph'] as Record<string, unknown>[]

    const types = graph.map((item) => item['@type'])
    expect(types).toContain('FAQPage')
  })

  it('HowTo ステップを渡した場合に @graph に HowTo が含まれること', () => {
    const article = createMockArticle({
      article_type: 'ガイド・まとめ',
    })
    const howToSteps: HowToStep[] = [
      { name: 'ステップ1', text: '説明1' },
      { name: 'ステップ2', text: '説明2' },
    ]
    const schema = generateArticleStructuredData(article, undefined, howToSteps)
    const graph = schema['@graph'] as Record<string, unknown>[]

    const types = graph.map((item) => item['@type'])
    expect(types).toContain('HowTo')
  })
})

// ==============================================================
// FAQ 自動抽出テスト
// ==============================================================

describe('記事コンテンツからの FAQ 自動抽出', () => {
  it('Q. パターンの FAQ を抽出できること', () => {
    const html = '<h3>Q. AGA治療はいつ始めるべき？</h3><p>早めの受診をおすすめします。</p>'
    const faqs = extractFAQsFromContent(html)
    expect(faqs.length).toBeGreaterThanOrEqual(1)
    if (faqs.length > 0) {
      expect(faqs[0].question).toContain('AGA治療')
      expect(faqs[0].answer).toContain('おすすめ')
    }
  })

  it('dt/dd パターンの FAQ を抽出できること', () => {
    const html = '<dt>AGA治療の費用は？</dt><dd>月額5,000円〜が目安です。</dd>'
    const faqs = extractFAQsFromContent(html)
    expect(faqs.length).toBeGreaterThanOrEqual(1)
  })

  it('FAQ がないコンテンツでは空配列を返すこと', () => {
    const html = '<p>通常の記事テキストです。</p>'
    const faqs = extractFAQsFromContent(html)
    expect(faqs).toHaveLength(0)
  })
})
