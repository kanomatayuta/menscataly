/**
 * Q3: 比較表現コンプライアンス辞書テスト
 * Phase 3 SEO強化 — comparison-terms.ts
 *
 * - 15件のエントリが定義されていること
 * - NG検出とOK変換のテスト
 * - ComplianceChecker との統合テスト
 */

import { describe, it, expect } from 'vitest'
import comparisonTermsDictionary from '@/lib/compliance/dictionaries/comparison-terms'
import { ComplianceChecker } from '@/lib/compliance/checker'
import type { DictionaryFile, NGEntry } from '@/lib/compliance/types'

// ==============================================================
// 辞書構造テスト
// ==============================================================

describe('比較表現コンプライアンス辞書 構造テスト', () => {
  it('15件のエントリが含まれること', () => {
    expect(comparisonTermsDictionary.entries.length).toBe(15)
  })

  it('category フィールドが設定されていること', () => {
    expect(comparisonTermsDictionary.category).toBeDefined()
    expect(typeof comparisonTermsDictionary.category).toBe('string')
  })

  it('description フィールドが設定されていること', () => {
    expect(comparisonTermsDictionary.description).toBeDefined()
    expect(comparisonTermsDictionary.description.length).toBeGreaterThan(0)
  })

  it('全エントリに必須フィールドが含まれること', () => {
    for (const entry of comparisonTermsDictionary.entries) {
      expect(entry.id).toBeDefined()
      expect(entry.id.length).toBeGreaterThan(0)
      expect(entry.ng).toBeDefined()
      expect(entry.ng.length).toBeGreaterThan(0)
      expect(entry.ok).toBeDefined()
      expect(entry.ok.length).toBeGreaterThan(0)
      expect(entry.reason).toBeDefined()
      expect(entry.reason.length).toBeGreaterThan(0)
      expect(['high', 'medium', 'low']).toContain(entry.severity)
    }
  })

  it('エントリIDがユニークであること', () => {
    const ids = comparisonTermsDictionary.entries.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('NGテキストとOKテキストが異なること', () => {
    for (const entry of comparisonTermsDictionary.entries) {
      expect(entry.ng).not.toBe(entry.ok)
    }
  })

  it('全エントリIDが "cmp_" プレフィックスで始まること', () => {
    for (const entry of comparisonTermsDictionary.entries) {
      expect(entry.id).toMatch(/^cmp_/)
    }
  })
})

// ==============================================================
// NG表現検出テスト
// ==============================================================

describe('比較表現 NG検出テスト', () => {
  const checker = new ComplianceChecker({ categories: ['common'] })

  it('「No.1クリニック」がNG検出されること', () => {
    const result = checker.check('No.1クリニックです')
    const violation = result.violations.find((v) => v.ngText === 'No.1クリニック')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「最も効果がある」がNG検出されること', () => {
    const result = checker.check('最も効果がある治療法です')
    const violation = result.violations.find((v) => v.ngText === '最も効果がある')
    expect(violation).toBeDefined()
  })

  it('「満足度No.1」がNG検出されること', () => {
    const result = checker.check('満足度No.1を獲得しています')
    const violation = result.violations.find((v) => v.ngText === '満足度No.1')
    expect(violation).toBeDefined()
  })

  it('「圧倒的に優れている」がNG検出されること', () => {
    const result = checker.check('圧倒的に優れているサービスです')
    const violation = result.violations.find((v) => v.ngText === '圧倒的に優れている')
    expect(violation).toBeDefined()
  })

  it('「最安値保証」がNG検出されること', () => {
    const result = checker.check('最安値保証でお申し込みいただけます')
    const violation = result.violations.find((v) => v.ngText === '最安値保証')
    expect(violation).toBeDefined()
  })

  it('「コスパランキング1位」がNG検出されること', () => {
    const result = checker.check('コスパランキング1位のサービスです')
    const violation = result.violations.find((v) => v.ngText === 'コスパランキング1位')
    expect(violation).toBeDefined()
  })

  it('「全ての面で最も優秀」がNG検出されること', () => {
    const result = checker.check('全ての面で最も優秀なサービスです')
    const violation = result.violations.find((v) => v.ngText === '全ての面で最も優秀')
    expect(violation).toBeDefined()
  })
})

// ==============================================================
// OK変換テスト
// ==============================================================

describe('比較表現 OK変換テスト', () => {
  it('各エントリのOK表現がNG表現と異なること', () => {
    for (const entry of comparisonTermsDictionary.entries) {
      expect(entry.ok).not.toBe(entry.ng)
      expect(entry.ok.length).toBeGreaterThan(0)
    }
  })

  it('high severity エントリが適切な件数であること', () => {
    const highEntries = comparisonTermsDictionary.entries.filter(
      (e) => e.severity === 'high'
    )
    expect(highEntries.length).toBeGreaterThanOrEqual(5)
  })

  it('medium severity エントリが存在すること', () => {
    const mediumEntries = comparisonTermsDictionary.entries.filter(
      (e) => e.severity === 'medium'
    )
    expect(mediumEntries.length).toBeGreaterThan(0)
  })

  it('各エントリの reason に景表法または薬機法の言及があること', () => {
    for (const entry of comparisonTermsDictionary.entries) {
      const hasLegalReference =
        entry.reason.includes('景表法') ||
        entry.reason.includes('薬機法')
      expect(hasLegalReference).toBe(true)
    }
  })
})

// ==============================================================
// 複合テスト
// ==============================================================

describe('比較表現 複合テスト', () => {
  const checker = new ComplianceChecker({ categories: ['common'] })

  it('複数のNG表現を含むテキストで全て検出されること', () => {
    const text = 'No.1クリニックで最も効果がある。満足度No.1で全ての面で最も優秀なサービスです。'
    const result = checker.check(text)

    const ngTexts = result.violations.map((v) => v.ngText)
    expect(ngTexts).toContain('No.1クリニック')
    expect(ngTexts).toContain('最も効果がある')
    expect(ngTexts).toContain('全ての面で最も優秀')
  })
})
