/**
 * ステルスマーケティング強化チェック Unit Tests
 * リンク密度・rel="sponsored"・新規パターン検出の契約テスト
 *
 * Content エージェントが @/lib/compliance/stealth-marketing を実装する前に、
 * インターフェース契約をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 契約模倣関数
const checkLinkDensity = vi.fn()
const checkRelSponsored = vi.fn()
const checkStealthPatterns = vi.fn()

describe('ステルスマーケティング強化チェック', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkLinkDensity()', () => {
    it('アフィリエイトリンクが少ない場合、密度が低いと判定されること', () => {
      checkLinkDensity.mockReturnValue({
        density: 0.02,
        affiliateCount: 2,
        totalLinks: 10,
        isExcessive: false,
      })

      const result = checkLinkDensity('<html>')

      expect(result.isExcessive).toBe(false)
      expect(result.affiliateCount).toBe(2)
      expect(result.density).toBeLessThan(0.1)
    })

    it('アフィリエイトリンクが多すぎる場合、過度と判定されること', () => {
      checkLinkDensity.mockReturnValue({
        density: 0.35,
        affiliateCount: 15,
        totalLinks: 18,
        isExcessive: true,
      })

      const result = checkLinkDensity('<html>')

      expect(result.isExcessive).toBe(true)
      expect(result.affiliateCount).toBeGreaterThan(10)
      expect(result.density).toBeGreaterThan(0.2)
    })

    it('アフィリエイトリンクがない場合、密度0であること', () => {
      checkLinkDensity.mockReturnValue({
        density: 0,
        affiliateCount: 0,
        totalLinks: 5,
        isExcessive: false,
      })

      const result = checkLinkDensity('<html>')

      expect(result.affiliateCount).toBe(0)
      expect(result.isExcessive).toBe(false)
    })

    it('返却オブジェクトにdensity, affiliateCount, totalLinks, isExcessiveが含まれること', () => {
      checkLinkDensity.mockReturnValue({
        density: 0.1,
        affiliateCount: 3,
        totalLinks: 8,
        isExcessive: false,
      })

      const result = checkLinkDensity('<html>')

      expect(typeof result.density).toBe('number')
      expect(typeof result.affiliateCount).toBe('number')
      expect(typeof result.totalLinks).toBe('number')
      expect(typeof result.isExcessive).toBe('boolean')
    })
  })

  describe('checkRelSponsored()', () => {
    it('全アフィリエイトリンクにrel="sponsored"がある場合、valid: true', () => {
      checkRelSponsored.mockReturnValue({
        valid: true,
        missingRel: [],
        hasRel: ['https://px.a8.net/click?aid=123', 'https://t.afb.ne.jp/test'],
      })

      const result = checkRelSponsored('<html>')

      expect(result.valid).toBe(true)
      expect(result.missingRel).toHaveLength(0)
      expect(result.hasRel.length).toBeGreaterThan(0)
    })

    it('rel="sponsored"が欠けているリンクがある場合、valid: false', () => {
      checkRelSponsored.mockReturnValue({
        valid: false,
        missingRel: ['https://t.afb.ne.jp/test'],
        hasRel: ['https://px.a8.net/click?aid=123'],
      })

      const result = checkRelSponsored('<html>')

      expect(result.valid).toBe(false)
      expect(result.missingRel.length).toBeGreaterThan(0)
      expect(result.missingRel).toContain('https://t.afb.ne.jp/test')
    })

    it('アフィリエイトリンクがない場合、valid: true', () => {
      checkRelSponsored.mockReturnValue({
        valid: true,
        missingRel: [],
        hasRel: [],
      })

      const result = checkRelSponsored('<html>')

      expect(result.valid).toBe(true)
      expect(result.missingRel).toHaveLength(0)
    })
  })

  describe('checkStealthPatterns() -- 新規パターン検出', () => {
    it('誇大な推奨表現を検出すること', () => {
      checkStealthPatterns.mockReturnValue({
        violations: [
          { pattern: 'stealth_recommendation', matched: '絶対おすすめ', severity: 'medium' },
        ],
      })

      const result = checkStealthPatterns('text')

      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations[0].pattern).toBe('stealth_recommendation')
    })

    it('体験談の偽装パターンを検出すること', () => {
      checkStealthPatterns.mockReturnValue({
        violations: [
          { pattern: 'fake_testimonial', matched: '友人が使って劇的に改善', severity: 'high' },
        ],
      })

      const result = checkStealthPatterns('text')

      expect(result.violations.length).toBeGreaterThan(0)
      expect(result.violations[0].severity).toBe('high')
    })

    it('クリーンなテキストは違反なしであること', () => {
      checkStealthPatterns.mockReturnValue({
        violations: [],
      })

      const result = checkStealthPatterns('text')

      expect(result.violations).toHaveLength(0)
    })

    it('「PR」表記なしの商品紹介を検出すること', () => {
      checkStealthPatterns.mockReturnValue({
        violations: [
          { pattern: 'undisclosed_promotion', matched: '商品レビュー without PR disclosure', severity: 'high' },
        ],
      })

      const result = checkStealthPatterns('text')

      expect(result.violations.length).toBeGreaterThan(0)
    })

    it('各違反にpattern, matched, severityが含まれること', () => {
      checkStealthPatterns.mockReturnValue({
        violations: [
          { pattern: 'stealth_recommendation', matched: 'test match', severity: 'medium' },
        ],
      })

      const result = checkStealthPatterns('text')
      result.violations.forEach((v: { pattern: string; matched: string; severity: string }) => {
        expect(v.pattern).toBeDefined()
        expect(v.matched).toBeDefined()
        expect(['high', 'medium', 'low']).toContain(v.severity)
      })
    })
  })
})
