/**
 * 構造化データ (Schema.org JSON-LD) ユニットテスト
 *
 * generateArticleStructuredData() を中心に、
 * JSON-LD の有効性・スキーマ構成・医療カテゴリ判定・FAQ 包含を検証する。
 */

import { describe, it, expect } from 'vitest'
import {
  generateArticleStructuredData,
  generateMedicalWebPageSchema,
  generateFAQSchema,
  generatePersonSchema,
  extractFAQsFromContent,
  type FAQItem,
  type HowToStep,
} from '@/lib/seo/structured-data'
import type { MicroCMSArticle } from '@/types/microcms'

// ==============================================================
// テスト用ヘルパー
// ==============================================================

function createMockArticle(overrides: Partial<MicroCMSArticle> = {}): MicroCMSArticle {
  return {
    id: 'test-001',
    title: 'AGA治療の費用相場と選び方ガイド',
    slug: 'aga-cost-guide',
    content: '<p>AGA治療の費用について詳しく解説します。</p>',
    excerpt: 'AGA治療の費用を徹底比較。クリニック選びのポイントを解説。',
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
    supervisor_name: '佐藤医師',
    supervisor_creds: '皮膚科専門医',
    supervisor_bio: '皮膚科専門医として20年の臨床経験。',
    supervisor_image: { url: 'https://example.com/dr-sato.jpg', width: 400, height: 400 },
    is_pr: true,
    compliance_score: 92,
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z',
    publishedAt: '2026-01-10T09:00:00Z',
    revisedAt: '2026-03-01T09:00:00Z',
    ...overrides,
  }
}

// ==============================================================
// generateArticleStructuredData — 統合 JSON-LD テスト
// ==============================================================

describe('generateArticleStructuredData', () => {
  it('有効な JSON-LD オブジェクトを返すこと (@context + @graph)', () => {
    const article = createMockArticle()
    const result = generateArticleStructuredData(article)

    expect(result['@context']).toBe('https://schema.org')
    expect(result['@graph']).toBeDefined()
    expect(Array.isArray(result['@graph'])).toBe(true)
  })

  it('@graph に Article/MedicalWebPage と BreadcrumbList の両方が含まれること', () => {
    const article = createMockArticle()
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const types = graph.map((item) => item['@type'])

    expect(types).toContain('MedicalWebPage')
    expect(types).toContain('BreadcrumbList')
  })

  it('@graph 内の各要素に @context が含まれないこと (外側で一度だけ指定)', () => {
    const article = createMockArticle()
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]

    for (const item of graph) {
      expect(item['@context']).toBeUndefined()
    }
  })

  it('AGA カテゴリで MedicalWebPage が使用されること', () => {
    const article = createMockArticle({
      category: { id: 'aga', name: 'AGA', slug: 'aga', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const mainSchema = graph.find((item) => item['@type'] === 'MedicalWebPage' || item['@type'] === 'Article')

    expect(mainSchema).toBeDefined()
    expect(mainSchema!['@type']).toBe('MedicalWebPage')
  })

  it('ED カテゴリで MedicalWebPage が使用されること', () => {
    const article = createMockArticle({
      category: { id: 'ed', name: 'ED', slug: 'ed', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const mainSchema = graph.find((item) => item['@type'] === 'MedicalWebPage' || item['@type'] === 'Article')

    expect(mainSchema!['@type']).toBe('MedicalWebPage')
  })

  it('非医療カテゴリ (skincare) で Article タイプが使用されること', () => {
    const article = createMockArticle({
      category: { id: 'skincare', name: 'スキンケア', slug: 'skincare', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const mainSchema = graph.find((item) => item['@type'] === 'MedicalWebPage' || item['@type'] === 'Article')

    expect(mainSchema!['@type']).toBe('Article')
  })

  it('非医療カテゴリ (column) で Article タイプが使用されること', () => {
    const article = createMockArticle({
      category: { id: 'column', name: 'コラム', slug: 'column', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const mainSchema = graph.find((item) => item['@type'] === 'MedicalWebPage' || item['@type'] === 'Article')

    expect(mainSchema!['@type']).toBe('Article')
  })

  it('FAQ データを渡すと @graph に FAQPage が含まれること', () => {
    const article = createMockArticle()
    const faqs: FAQItem[] = [
      { question: 'AGA治療の費用は？', answer: '月額5,000円〜30,000円が目安です。' },
      { question: 'AGA治療の期間は？', answer: '6ヶ月〜1年が目安です。' },
    ]
    const result = generateArticleStructuredData(article, faqs)
    const graph = result['@graph'] as Record<string, unknown>[]
    const types = graph.map((item) => item['@type'])

    expect(types).toContain('FAQPage')
  })

  it('空の FAQ 配列を渡すと FAQPage が含まれないこと', () => {
    const article = createMockArticle()
    const result = generateArticleStructuredData(article, [])
    const graph = result['@graph'] as Record<string, unknown>[]
    const types = graph.map((item) => item['@type'])

    expect(types).not.toContain('FAQPage')
  })

  it('FAQ を渡さない場合に FAQPage が含まれないこと', () => {
    const article = createMockArticle()
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const types = graph.map((item) => item['@type'])

    expect(types).not.toContain('FAQPage')
  })

  it('HowTo ステップを渡すと @graph に HowTo が含まれること', () => {
    const article = createMockArticle({ article_type: 'ガイド・まとめ' })
    const howToSteps: HowToStep[] = [
      { name: 'クリニックを選ぶ', text: 'まずは比較サイトで候補を絞ります。' },
      { name: '無料カウンセリング', text: '無料カウンセリングを予約します。' },
    ]
    const result = generateArticleStructuredData(article, undefined, howToSteps)
    const graph = result['@graph'] as Record<string, unknown>[]
    const types = graph.map((item) => item['@type'])

    expect(types).toContain('HowTo')
  })

  it('slug がない場合に id がフォールバックとして使われること', () => {
    const article = createMockArticle({ slug: undefined, id: 'fallback-id' })
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const mainSchema = graph.find((item) => item['@type'] === 'MedicalWebPage' || item['@type'] === 'Article')

    expect(mainSchema!['@id']).toContain('fallback-id')
  })

  it('BreadcrumbList にカテゴリ情報が反映されること', () => {
    const article = createMockArticle()
    const result = generateArticleStructuredData(article)
    const graph = result['@graph'] as Record<string, unknown>[]
    const breadcrumb = graph.find((item) => item['@type'] === 'BreadcrumbList')

    expect(breadcrumb).toBeDefined()
    const items = breadcrumb!['itemListElement'] as Record<string, unknown>[]
    // カテゴリありの場合: ホーム, 記事一覧, カテゴリ, 記事タイトル = 4要素
    expect(items).toHaveLength(4)
  })
})

// ==============================================================
// MedicalWebPage 判定テスト
// ==============================================================

describe('MedicalWebPage 医療カテゴリ判定', () => {
  it('AGA カテゴリで about.MedicalCondition に「AGA」が含まれること', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)
    const about = schema['about'] as Record<string, unknown>

    expect(about).toBeDefined()
    expect(about['@type']).toBe('MedicalCondition')
    expect((about['name'] as string)).toContain('AGA')
  })

  it('ED カテゴリで about.MedicalCondition に「ED」が含まれること', () => {
    const article = createMockArticle({
      category: { id: 'ed', name: 'ED', slug: 'ed', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const schema = generateMedicalWebPageSchema(article)
    const about = schema['about'] as Record<string, unknown>

    expect(about).toBeDefined()
    expect(about['@type']).toBe('MedicalCondition')
    expect((about['name'] as string)).toContain('ED')
  })

  it('非医療カテゴリで about フィールドが含まれないこと', () => {
    const article = createMockArticle({
      category: { id: 'skincare', name: 'スキンケア', slug: 'skincare', createdAt: '', updatedAt: '', publishedAt: '', revisedAt: '' },
    })
    const schema = generateMedicalWebPageSchema(article)

    expect(schema['about']).toBeUndefined()
    expect(schema['medicalAudience']).toBeUndefined()
  })

  it('医療カテゴリで medicalAudience が含まれること', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)
    const audience = schema['medicalAudience'] as Record<string, unknown>

    expect(audience).toBeDefined()
    expect(audience['@type']).toBe('MedicalAudience')
  })

  it('監修者画像がある場合 reviewedBy に image が含まれること', () => {
    const article = createMockArticle()
    const schema = generateMedicalWebPageSchema(article)
    const reviewer = schema['reviewedBy'] as Record<string, unknown>

    expect(reviewer['image']).toBe('https://example.com/dr-sato.jpg')
  })

  it('thumbnail_url がある場合に image フィールドが含まれること', () => {
    const article = createMockArticle({
      thumbnail_url: 'https://example.com/thumb.jpg',
    })
    const schema = generateMedicalWebPageSchema(article)

    expect(schema['image']).toBeDefined()
    const image = schema['image'] as Record<string, unknown>
    expect(image['url']).toBe('https://example.com/thumb.jpg')
  })

  it('thumbnail も thumbnail_url もない場合に image が含まれないこと', () => {
    const article = createMockArticle({
      thumbnail: undefined,
      thumbnail_url: undefined,
    })
    const schema = generateMedicalWebPageSchema(article)

    expect(schema['image']).toBeUndefined()
  })
})

// ==============================================================
// FAQPage スキーマテスト (generateFAQSchema)
// ==============================================================

describe('generateFAQSchema', () => {
  it('FAQ 配列が正しく mainEntity にマッピングされること', () => {
    const faqs: FAQItem[] = [
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
      { question: 'Q3', answer: 'A3' },
    ]
    const schema = generateFAQSchema(faqs)
    const mainEntity = schema['mainEntity'] as Record<string, unknown>[]

    expect(mainEntity).toHaveLength(3)
    expect(mainEntity[0]['name']).toBe('Q1')
    expect((mainEntity[0]['acceptedAnswer'] as Record<string, unknown>)['text']).toBe('A1')
  })
})

// ==============================================================
// extractFAQsFromContent テスト
// ==============================================================

describe('extractFAQsFromContent', () => {
  it('複数の Q. パターンを全て抽出できること', () => {
    const html = `
      <h3>Q. AGA治療はいつ始めるべき？</h3><p>早めの受診をおすすめします。</p>
      <h3>Q. 費用はどのくらい？</h3><p>月額5,000円〜です。</p>
    `
    const faqs = extractFAQsFromContent(html)
    expect(faqs).toHaveLength(2)
  })

  it('HTML タグが除去された質問・回答を返すこと', () => {
    const html = '<h3>Q. <strong>AGA</strong>治療は？</h3><p>おすすめ<em>です</em>。</p>'
    const faqs = extractFAQsFromContent(html)
    if (faqs.length > 0) {
      expect(faqs[0].question).not.toContain('<')
      expect(faqs[0].answer).not.toContain('<')
    }
  })
})

// ==============================================================
// generatePersonSchema テスト
// ==============================================================

describe('generatePersonSchema', () => {
  it('複数の所属組織が memberOf に含まれること', () => {
    const schema = generatePersonSchema(
      '山田太郎',
      '泌尿器科専門医',
      'プロフィール',
      ['日本泌尿器科学会', '日本性機能学会'],
      'https://example.com/photo.jpg'
    )
    const memberOf = schema['memberOf'] as Record<string, unknown>[]

    expect(memberOf).toHaveLength(2)
    expect(memberOf[0]['name']).toBe('日本泌尿器科学会')
    expect(memberOf[1]['name']).toBe('日本性機能学会')
  })
})
