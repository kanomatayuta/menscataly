/**
 * Q2: ミドルキーワード テスト
 * Phase 3 SEO強化 — middle-keywords.ts
 *
 * - 20件のキーワードが定義されていること
 * - 各キーワードに必須フィールドがあること
 * - フィルタリング機能のテスト
 */

import { describe, it, expect } from 'vitest'
import {
  MIDDLE_KEYWORDS,
  getMiddleKeywordsByCategory,
  getMiddleKeywordsByIntent,
  getMiddleKeywordsByDifficulty,
  getMiddleKeywordsByVolume,
  getMiddleKeywordById,
  type MiddleKeyword,
} from '@/lib/content/keywords/middle-keywords'

// ==============================================================
// 基本構造テスト
// ==============================================================

describe('ミドルキーワード 基本構造', () => {
  it('20件のキーワードが定義されていること', () => {
    expect(MIDDLE_KEYWORDS.length).toBe(20)
  })

  it('全キーワードのIDがユニークであること', () => {
    const ids = MIDDLE_KEYWORDS.map((kw) => kw.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('全キーワードに必須フィールドが含まれること', () => {
    for (const kw of MIDDLE_KEYWORDS) {
      expect(kw.id).toBeDefined()
      expect(kw.id.length).toBeGreaterThan(0)
      expect(kw.keyword).toBeDefined()
      expect(kw.keyword.length).toBeGreaterThan(0)
      expect(kw.category).toBeDefined()
      expect(kw.searchIntent).toBeDefined()
      expect(typeof kw.estimatedVolume).toBe('number')
      expect(kw.estimatedVolume).toBeGreaterThan(0)
      expect(typeof kw.difficultyScore).toBe('number')
      expect(kw.difficultyScore).toBeGreaterThanOrEqual(0)
      expect(kw.difficultyScore).toBeLessThanOrEqual(100)
      expect(kw.articleType).toBeDefined()
      expect(kw.suggestedTitle).toBeDefined()
      expect(kw.suggestedTitle.length).toBeGreaterThan(0)
      expect(Array.isArray(kw.targetASP)).toBe(true)
      expect(kw.targetASP.length).toBeGreaterThan(0)
      expect(kw.targetAudience).toBeDefined()
      expect(typeof kw.targetLength).toBe('number')
      expect(kw.targetLength).toBeGreaterThan(0)
    }
  })

  it('searchIntent が有効な値であること', () => {
    const validIntents = ['informational', 'commercial', 'transactional', 'navigational']
    for (const kw of MIDDLE_KEYWORDS) {
      expect(validIntents).toContain(kw.searchIntent)
    }
  })

  it('articleType が有効な値であること', () => {
    const validTypes = ['how-to', 'comparison', 'review', 'list', 'guide', 'cost-analysis']
    for (const kw of MIDDLE_KEYWORDS) {
      expect(validTypes).toContain(kw.articleType)
    }
  })

  it('推奨文字数が3000以上であること', () => {
    for (const kw of MIDDLE_KEYWORDS) {
      expect(kw.targetLength).toBeGreaterThanOrEqual(3000)
    }
  })
})

// ==============================================================
// カテゴリ分布テスト
// ==============================================================

describe('ミドルキーワード カテゴリ分布', () => {
  it('AGA カテゴリに5件含まれること', () => {
    const agaKeywords = MIDDLE_KEYWORDS.filter((kw) => kw.category === 'aga')
    expect(agaKeywords.length).toBe(5)
  })

  it('ED カテゴリに3件含まれること', () => {
    const edKeywords = MIDDLE_KEYWORDS.filter((kw) => kw.category === 'ed')
    expect(edKeywords.length).toBe(3)
  })

  it('脱毛カテゴリに5件含まれること', () => {
    const hrKeywords = MIDDLE_KEYWORDS.filter((kw) => kw.category === 'hair-removal')
    expect(hrKeywords.length).toBe(5)
  })

  it('スキンケアカテゴリに4件含まれること', () => {
    const scKeywords = MIDDLE_KEYWORDS.filter((kw) => kw.category === 'skincare')
    expect(scKeywords.length).toBe(4)
  })

  it('サプリメントカテゴリに3件含まれること', () => {
    const supKeywords = MIDDLE_KEYWORDS.filter((kw) => kw.category === 'supplement')
    expect(supKeywords.length).toBe(3)
  })
})

// ==============================================================
// フィルタリング関数テスト
// ==============================================================

describe('ミドルキーワード フィルタリング', () => {
  describe('getMiddleKeywordsByCategory', () => {
    it('AGA カテゴリのキーワードを取得できること', () => {
      const result = getMiddleKeywordsByCategory('aga')
      expect(result.length).toBe(5)
      for (const kw of result) {
        expect(kw.category).toBe('aga')
      }
    })

    it('存在しないカテゴリでは空配列を返すこと', () => {
      const result = getMiddleKeywordsByCategory('nonexistent' as any)
      expect(result).toHaveLength(0)
    })
  })

  describe('getMiddleKeywordsByIntent', () => {
    it('commercial 意図のキーワードを取得できること', () => {
      const result = getMiddleKeywordsByIntent('commercial')
      expect(result.length).toBeGreaterThan(0)
      for (const kw of result) {
        expect(kw.searchIntent).toBe('commercial')
      }
    })

    it('informational 意図のキーワードを取得できること', () => {
      const result = getMiddleKeywordsByIntent('informational')
      expect(result.length).toBeGreaterThan(0)
      for (const kw of result) {
        expect(kw.searchIntent).toBe('informational')
      }
    })
  })

  describe('getMiddleKeywordsByDifficulty', () => {
    it('難易度スコアの昇順でソートされること', () => {
      const result = getMiddleKeywordsByDifficulty()
      expect(result.length).toBe(20)

      for (let i = 1; i < result.length; i++) {
        expect(result[i].difficultyScore).toBeGreaterThanOrEqual(
          result[i - 1].difficultyScore
        )
      }
    })
  })

  describe('getMiddleKeywordsByVolume', () => {
    it('検索ボリュームの降順でソートされること', () => {
      const result = getMiddleKeywordsByVolume()
      expect(result.length).toBe(20)

      for (let i = 1; i < result.length; i++) {
        expect(result[i].estimatedVolume).toBeLessThanOrEqual(
          result[i - 1].estimatedVolume
        )
      }
    })
  })

  describe('getMiddleKeywordById', () => {
    it('有効な ID でキーワードを取得できること', () => {
      const firstId = MIDDLE_KEYWORDS[0].id
      const kw = getMiddleKeywordById(firstId)
      expect(kw).toBeDefined()
      expect(kw!.id).toBe(firstId)
    })

    it('無効な ID で undefined を返すこと', () => {
      const kw = getMiddleKeywordById('nonexistent-id')
      expect(kw).toBeUndefined()
    })
  })
})
