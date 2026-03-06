/**
 * Q2: FAQ 生成モジュール テスト
 * Phase 3 SEO強化 — faq-generator.ts
 *
 * - カテゴリ別 FAQ 生成
 * - FAQ 数の制約 (5-8 items)
 * - 薬機法準拠チェック (NG 表現なし)
 */

import { describe, it, expect } from 'vitest'
import {
  generateFAQsForKeyword,
  getAvailableFAQCategories,
  getFAQThemes,
  type FAQItem,
} from '@/lib/content/faq-generator'

// ==============================================================
// NG 表現パターン（薬機法準拠チェック用）
// ==============================================================

const NG_PATTERNS = [
  /確実に/,
  /完全に/,
  /絶対/,
  /必ず(?!しも|医師|診察|担当|処方|お伝え|ご相談)/,
  /100%/,
  /副作用なし/,
  /副作用がない/,
  /最安/,
  /業界No\.?1/,
  /最強/,
  /(?<!が|は|を|で|も)治る(?!療)/,
  /治せる/,
  /(?<!されな|くな|にはなら|が)消える/,
  /永久脱毛(?!効果が期待)/,
]

function checkFAQCompliance(items: FAQItem[]): number[] {
  const violations: number[] = []
  items.forEach((faq, index) => {
    const textToCheck = faq.question + faq.answer
    for (const pattern of NG_PATTERNS) {
      if (pattern.test(textToCheck)) {
        violations.push(index)
        break
      }
    }
  })
  return violations
}

// ==============================================================
// カテゴリ別 FAQ 生成テスト
// ==============================================================

describe('FAQ 生成 — カテゴリ別', () => {
  const testCases = [
    { category: 'aga', keyword: 'AGA治療' },
    { category: 'ed', keyword: 'ED治療' },
    { category: 'hair-removal', keyword: 'メンズ医療脱毛' },
    { category: 'skincare', keyword: 'メンズスキンケア' },
    { category: 'supplement', keyword: '男性サプリメント' },
  ]

  for (const { category, keyword } of testCases) {
    describe(`${category} カテゴリ`, () => {
      it('FAQ が生成されること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        expect(result.items.length).toBeGreaterThan(0)
      })

      it('keyword がレスポンスに含まれること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        expect(result.keyword).toBe(keyword)
      })

      it('category がレスポンスに含まれること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        expect(result.category).toBe(category)
      })

      it('各 FAQ に question と answer が含まれること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        for (const faq of result.items) {
          expect(faq.question).toBeDefined()
          expect(faq.question.length).toBeGreaterThan(0)
          expect(faq.answer).toBeDefined()
          expect(faq.answer.length).toBeGreaterThan(0)
        }
      })

      it('各 FAQ に faqCategory が設定されていること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        for (const faq of result.items) {
          expect(faq.faqCategory).toBeDefined()
          expect(faq.faqCategory.length).toBeGreaterThan(0)
        }
      })

      it('構造化データ (JSON-LD) が含まれること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        expect(result.structuredData).toBeDefined()
        expect(result.structuredData['@context']).toBe('https://schema.org')
        expect(result.structuredData['@type']).toBe('FAQPage')
      })

      it('Markdown が生成されること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        expect(result.markdown).toBeDefined()
        expect(result.markdown.length).toBeGreaterThan(0)
        expect(result.markdown).toContain('よくある質問')
      })

      it('HTML が生成されること', () => {
        const result = generateFAQsForKeyword(keyword, category)
        expect(result.html).toBeDefined()
        expect(result.html.length).toBeGreaterThan(0)
        expect(result.html).toContain('faq-section')
      })
    })
  }
})

// ==============================================================
// FAQ 数の制約テスト
// ==============================================================

describe('FAQ 数の制約 (5-8 items)', () => {
  it('生成数が5以上であること', () => {
    const result = generateFAQsForKeyword('AGA治療', 'aga')
    expect(result.items.length).toBeGreaterThanOrEqual(5)
  })

  it('生成数が8以下であること', () => {
    const result = generateFAQsForKeyword('AGA治療', 'aga')
    expect(result.items.length).toBeLessThanOrEqual(8)
  })

  it('各カテゴリで5-8件の範囲であること', () => {
    const categories = ['aga', 'ed', 'hair-removal', 'skincare', 'supplement']
    for (const cat of categories) {
      const result = generateFAQsForKeyword('テスト', cat)
      expect(result.items.length).toBeGreaterThanOrEqual(5)
      expect(result.items.length).toBeLessThanOrEqual(8)
    }
  })
})

// ==============================================================
// 薬機法準拠チェックテスト
// ==============================================================

describe('FAQ 薬機法準拠チェック', () => {
  it('テンプレート FAQ にNG表現が含まれないこと（AGAカテゴリ）', () => {
    const result = generateFAQsForKeyword('AGA治療', 'aga')
    const violations = checkFAQCompliance(result.items)
    expect(violations).toHaveLength(0)
  })

  it('テンプレート FAQ にNG表現が含まれないこと（EDカテゴリ）', () => {
    const result = generateFAQsForKeyword('ED治療', 'ed')
    const violations = checkFAQCompliance(result.items)
    expect(violations).toHaveLength(0)
  })

  it('テンプレート FAQ にNG表現が含まれないこと（脱毛カテゴリ）', () => {
    const result = generateFAQsForKeyword('メンズ脱毛', 'hair-removal')
    const violations = checkFAQCompliance(result.items)
    expect(violations).toHaveLength(0)
  })

  it('テンプレート FAQ にNG表現が含まれないこと（スキンケアカテゴリ）', () => {
    const result = generateFAQsForKeyword('メンズスキンケア', 'skincare')
    const violations = checkFAQCompliance(result.items)
    expect(violations).toHaveLength(0)
  })

  it('テンプレート FAQ にNG表現が含まれないこと（サプリカテゴリ）', () => {
    const result = generateFAQsForKeyword('サプリメント', 'supplement')
    const violations = checkFAQCompliance(result.items)
    expect(violations).toHaveLength(0)
  })

  it('キーワードがFAQテキストに埋め込まれること', () => {
    const result = generateFAQsForKeyword('AGA治療', 'aga')
    const hasKeyword = result.items.some(
      (faq) => faq.question.includes('AGA治療') || faq.answer.includes('AGA治療')
    )
    expect(hasKeyword).toBe(true)
  })
})

// ==============================================================
// 構造化データテスト
// ==============================================================

describe('FAQ 構造化データ (JSON-LD)', () => {
  it('mainEntity が FAQ 件数と一致すること', () => {
    const result = generateFAQsForKeyword('AGA治療', 'aga')
    const mainEntity = result.structuredData['mainEntity'] as Record<string, unknown>[]
    expect(mainEntity.length).toBe(result.items.length)
  })

  it('各 FAQ の Question / Answer 構造が正しいこと', () => {
    const result = generateFAQsForKeyword('AGA治療', 'aga')
    const mainEntity = result.structuredData['mainEntity'] as Record<string, unknown>[]

    for (const item of mainEntity) {
      expect(item['@type']).toBe('Question')
      expect(item['name']).toBeDefined()
      const answer = item['acceptedAnswer'] as Record<string, unknown>
      expect(answer['@type']).toBe('Answer')
      expect(answer['text']).toBeDefined()
    }
  })
})

// ==============================================================
// ユーティリティテスト
// ==============================================================

describe('FAQ ユーティリティ', () => {
  it('利用可能なカテゴリ一覧が取得できること', () => {
    const categories = getAvailableFAQCategories()
    expect(categories.length).toBeGreaterThan(0)
    expect(categories).toContain('aga')
    expect(categories).toContain('ed')
    expect(categories).toContain('skincare')
  })

  it('カテゴリの FAQ テーマが取得できること', () => {
    const themes = getFAQThemes('aga')
    expect(themes.length).toBeGreaterThan(0)
  })

  it('存在しないカテゴリでは空の FAQ が返されること', () => {
    const result = generateFAQsForKeyword('テスト', 'nonexistent-category')
    expect(result.items).toHaveLength(0)
  })
})
