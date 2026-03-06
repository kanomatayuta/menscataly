/**
 * Phase 2 キーワード Unit Tests
 * 30キーワードの構造・フィルタリング・ソート機能のテスト
 */

import { describe, it, expect } from 'vitest'
import {
  PHASE2_KEYWORDS,
  getPhase2KeywordsByCategory,
  getPhase2KeywordsByIntent,
  getPhase2KeywordsByDifficulty,
  getPhase2KeywordsByVolume,
  getPhase2KeywordById,
  type SearchIntent,
} from '@/lib/content/keywords/phase2-keywords'

// ==============================================================
// 基本構造テスト
// ==============================================================

describe('Phase 2 キーワードリスト 基本構造', () => {
  it('30件のキーワードが定義されていること', () => {
    expect(PHASE2_KEYWORDS.length).toBe(30)
  })

  it('各カテゴリに5件ずつ含まれていること', () => {
    const categories = ['aga', 'ed', 'hair-removal', 'skincare', 'supplement', 'comparison'] as const
    for (const category of categories) {
      const count = PHASE2_KEYWORDS.filter((kw) => kw.category === category).length
      expect(count).toBe(5)
    }
  })

  it('全キーワードのIDがユニークであること', () => {
    const ids = PHASE2_KEYWORDS.map((kw) => kw.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('全キーワードに必須フィールドが含まれること', () => {
    for (const kw of PHASE2_KEYWORDS) {
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
      expect(Array.isArray(kw.targetASP)).toBe(true)
      expect(kw.targetASP.length).toBeGreaterThan(0)
      expect(kw.articleType).toBeDefined()
      expect(kw.suggestedTitle).toBeDefined()
      expect(kw.suggestedTitle.length).toBeGreaterThan(0)
      expect(Array.isArray(kw.subKeywords)).toBe(true)
      expect(kw.subKeywords.length).toBeGreaterThan(0)
      expect(kw.targetAudience).toBeDefined()
      expect(typeof kw.targetLength).toBe('number')
      expect(kw.targetLength).toBeGreaterThan(0)
    }
  })

  it('searchIntentが有効な値であること', () => {
    const validIntents: SearchIntent[] = [
      'informational',
      'commercial',
      'transactional',
      'navigational',
    ]
    for (const kw of PHASE2_KEYWORDS) {
      expect(validIntents).toContain(kw.searchIntent)
    }
  })

  it('articleTypeが有効な値であること', () => {
    const validTypes = ['how-to', 'comparison', 'review', 'list', 'guide', 'cost-analysis']
    for (const kw of PHASE2_KEYWORDS) {
      expect(validTypes).toContain(kw.articleType)
    }
  })

  it('推奨文字数が3000以上であること', () => {
    for (const kw of PHASE2_KEYWORDS) {
      expect(kw.targetLength).toBeGreaterThanOrEqual(3000)
    }
  })
})

// ==============================================================
// フィルタリング関数テスト
// ==============================================================

describe('Phase 2 キーワード フィルタリング関数', () => {
  describe('getPhase2KeywordsByCategory', () => {
    it('AGAカテゴリのキーワードを取得できること', () => {
      const result = getPhase2KeywordsByCategory('aga')
      expect(result.length).toBe(5)
      for (const kw of result) {
        expect(kw.category).toBe('aga')
      }
    })

    it('EDカテゴリのキーワードを取得できること', () => {
      const result = getPhase2KeywordsByCategory('ed')
      expect(result.length).toBe(5)
      for (const kw of result) {
        expect(kw.category).toBe('ed')
      }
    })

    it('存在しないカテゴリでは空配列を返すこと', () => {
      const result = getPhase2KeywordsByCategory('nonexistent' as any)
      expect(result.length).toBe(0)
    })
  })

  describe('getPhase2KeywordsByIntent', () => {
    it('informational意図のキーワードを取得できること', () => {
      const result = getPhase2KeywordsByIntent('informational')
      expect(result.length).toBeGreaterThan(0)
      for (const kw of result) {
        expect(kw.searchIntent).toBe('informational')
      }
    })

    it('commercial意図のキーワードを取得できること', () => {
      const result = getPhase2KeywordsByIntent('commercial')
      expect(result.length).toBeGreaterThan(0)
      for (const kw of result) {
        expect(kw.searchIntent).toBe('commercial')
      }
    })

    it('transactional意図のキーワードを取得できること', () => {
      const result = getPhase2KeywordsByIntent('transactional')
      expect(result.length).toBeGreaterThan(0)
      for (const kw of result) {
        expect(kw.searchIntent).toBe('transactional')
      }
    })
  })

  describe('getPhase2KeywordsByDifficulty', () => {
    it('難易度スコアの昇順でソートされること', () => {
      const result = getPhase2KeywordsByDifficulty()
      expect(result.length).toBe(30)

      for (let i = 1; i < result.length; i++) {
        expect(result[i].difficultyScore).toBeGreaterThanOrEqual(
          result[i - 1].difficultyScore
        )
      }
    })
  })

  describe('getPhase2KeywordsByVolume', () => {
    it('検索ボリュームの降順でソートされること', () => {
      const result = getPhase2KeywordsByVolume()
      expect(result.length).toBe(30)

      for (let i = 1; i < result.length; i++) {
        expect(result[i].estimatedVolume).toBeLessThanOrEqual(
          result[i - 1].estimatedVolume
        )
      }
    })
  })

  describe('getPhase2KeywordById', () => {
    it('有効なIDでキーワードを取得できること', () => {
      const kw = getPhase2KeywordById('p2-aga-001')
      expect(kw).toBeDefined()
      expect(kw!.keyword).toContain('AGA治療')
    })

    it('無効なIDでundefinedを返すこと', () => {
      const kw = getPhase2KeywordById('nonexistent-id')
      expect(kw).toBeUndefined()
    })
  })
})

// ==============================================================
// キーワードリサーチ ユーティリティテスト
// ==============================================================

describe('キーワードリサーチ ユーティリティ', () => {
  // keyword-research.ts のヘルパー関数をテスト
  let getDifficultyLevel: typeof import('@/lib/content/keyword-research').getDifficultyLevel
  let estimateSearchIntent: typeof import('@/lib/content/keyword-research').estimateSearchIntent
  let validateKeywordEntry: typeof import('@/lib/content/keyword-research').validateKeywordEntry
  let createKeywordEntry: typeof import('@/lib/content/keyword-research').createKeywordEntry
  let filterKeywords: typeof import('@/lib/content/keyword-research').filterKeywords

  beforeAll(async () => {
    const mod = await import('@/lib/content/keyword-research')
    getDifficultyLevel = mod.getDifficultyLevel
    estimateSearchIntent = mod.estimateSearchIntent
    validateKeywordEntry = mod.validateKeywordEntry
    createKeywordEntry = mod.createKeywordEntry
    filterKeywords = mod.filterKeywords
  })

  describe('getDifficultyLevel', () => {
    it('0-30がeasyであること', () => {
      expect(getDifficultyLevel(0)).toBe('easy')
      expect(getDifficultyLevel(15)).toBe('easy')
      expect(getDifficultyLevel(30)).toBe('easy')
    })

    it('31-60がmediumであること', () => {
      expect(getDifficultyLevel(31)).toBe('medium')
      expect(getDifficultyLevel(45)).toBe('medium')
      expect(getDifficultyLevel(60)).toBe('medium')
    })

    it('61-100がhardであること', () => {
      expect(getDifficultyLevel(61)).toBe('hard')
      expect(getDifficultyLevel(80)).toBe('hard')
      expect(getDifficultyLevel(100)).toBe('hard')
    })
  })

  describe('estimateSearchIntent', () => {
    it('購入系キーワードがtransactionalと判定されること', () => {
      expect(estimateSearchIntent('AGA治療薬 購入')).toBe('transactional')
      expect(estimateSearchIntent('脱毛 予約')).toBe('transactional')
      expect(estimateSearchIntent('スキンケア 無料体験')).toBe('transactional')
    })

    it('比較系キーワードがcommercialと判定されること', () => {
      expect(estimateSearchIntent('AGA治療 おすすめ')).toBe('commercial')
      expect(estimateSearchIntent('ED薬 比較')).toBe('commercial')
      expect(estimateSearchIntent('脱毛クリニック ランキング')).toBe('commercial')
    })

    it('クリニック名系がnavigationalと判定されること', () => {
      expect(estimateSearchIntent('AGAスキンクリニック')).toBe('navigational')
    })

    it('一般的なキーワードがinformationalと判定されること', () => {
      expect(estimateSearchIntent('AGA治療 効果')).toBe('informational')
      expect(estimateSearchIntent('ED 原因')).toBe('informational')
    })
  })

  describe('validateKeywordEntry', () => {
    it('有効なエントリがvalid=trueを返すこと', () => {
      const result = validateKeywordEntry({
        keyword: 'AGA治療 費用',
        category: 'aga',
        searchVolume: 3000,
        difficulty: 30,
      })
      expect(result.valid).toBe(true)
      expect(result.errors.length).toBe(0)
    })

    it('キーワード空文字でエラーになること', () => {
      const result = validateKeywordEntry({
        keyword: '',
        category: 'aga',
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('keyword is required')
    })

    it('カテゴリ未指定でエラーになること', () => {
      const result = validateKeywordEntry({
        keyword: 'test',
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('category is required')
    })

    it('負のsearchVolumeでエラーになること', () => {
      const result = validateKeywordEntry({
        keyword: 'test',
        category: 'aga',
        searchVolume: -10,
      })
      expect(result.valid).toBe(false)
    })

    it('範囲外のdifficultyでエラーになること', () => {
      const result = validateKeywordEntry({
        keyword: 'test',
        category: 'aga',
        difficulty: 150,
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('createKeywordEntry', () => {
    it('キーワードエントリが正しく生成されること', () => {
      const entry = createKeywordEntry({
        keyword: 'メンズ脱毛 おすすめ',
        category: 'hair-removal',
        searchVolume: 5000,
        difficulty: 35,
      })

      expect(entry.id).toBeDefined()
      expect(entry.keyword).toBe('メンズ脱毛 おすすめ')
      expect(entry.category).toBe('hair-removal')
      expect(entry.searchVolume).toBe(5000)
      expect(entry.difficulty).toBe(35)
      expect(entry.difficultyLevel).toBe('medium')
      expect(entry.searchIntent).toBe('commercial')
      expect(entry.createdAt).toBeDefined()
    })

    it('デフォルト値が適用されること', () => {
      const entry = createKeywordEntry({
        keyword: 'テストキーワード',
        category: 'aga',
      })

      expect(entry.searchVolume).toBe(0)
      expect(entry.difficulty).toBe(50)
      expect(entry.trendScore).toBe(50)
      expect(entry.seasonality).toBe('evergreen')
    })
  })

  describe('filterKeywords', () => {
    let sampleKeywords: ReturnType<typeof createKeywordEntry>[]

    beforeAll(() => {
      sampleKeywords = [
        createKeywordEntry({ keyword: 'AGA治療 費用', category: 'aga', searchVolume: 3000, difficulty: 30 }),
        createKeywordEntry({ keyword: 'ED治療 おすすめ', category: 'ed', searchVolume: 5000, difficulty: 50 }),
        createKeywordEntry({ keyword: '脱毛 比較', category: 'hair-removal', searchVolume: 4000, difficulty: 40 }),
      ]
    })

    it('カテゴリフィルタが機能すること', () => {
      const result = filterKeywords(sampleKeywords, { category: 'aga' })
      expect(result.keywords.length).toBe(1)
      expect(result.keywords[0].category).toBe('aga')
    })

    it('ボリューム範囲フィルタが機能すること', () => {
      const result = filterKeywords(sampleKeywords, {
        minVolume: 3500,
        maxVolume: 5500,
      })
      expect(result.keywords.length).toBe(2)
    })

    it('検索クエリフィルタが機能すること', () => {
      const result = filterKeywords(sampleKeywords, { query: 'AGA' })
      expect(result.keywords.length).toBe(1)
    })

    it('ボリューム降順ソートが機能すること', () => {
      const result = filterKeywords(sampleKeywords, {
        sortBy: 'volume',
        sortOrder: 'desc',
      })
      expect(result.keywords[0].searchVolume).toBeGreaterThanOrEqual(
        result.keywords[result.keywords.length - 1].searchVolume
      )
    })

    it('totalが正しく返されること', () => {
      const result = filterKeywords(sampleKeywords, {})
      expect(result.total).toBe(3)
    })
  })
})
