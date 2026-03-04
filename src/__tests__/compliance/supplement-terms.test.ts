/**
 * Q3: サプリメントコンプライアンス辞書テスト
 * Phase 3 — supplement-terms.ts
 *
 * - 35件のエントリが定義されていること
 * - 辞書構造テスト（必須フィールド、ID一意性、プレフィックス）
 * - NG検出テスト（各カテゴリから代表的な表現）
 * - OK変換テスト
 * - 複合テスト（複数NG表現含む文章）
 */

import { describe, it, expect } from 'vitest'
import supplementTermsDictionary from '@/lib/compliance/dictionaries/supplement-terms'
import { ComplianceChecker } from '@/lib/compliance/checker'

// ==============================================================
// 辞書構造テスト
// ==============================================================

describe('サプリメントコンプライアンス辞書 構造テスト', () => {
  it('30件以上のエントリが含まれること', () => {
    expect(supplementTermsDictionary.entries.length).toBeGreaterThanOrEqual(30)
  })

  it('35件のエントリが含まれること', () => {
    expect(supplementTermsDictionary.entries.length).toBe(35)
  })

  it('category フィールドが "supplement" であること', () => {
    expect(supplementTermsDictionary.category).toBe('supplement')
  })

  it('description フィールドが設定されていること', () => {
    expect(supplementTermsDictionary.description).toBeDefined()
    expect(supplementTermsDictionary.description.length).toBeGreaterThan(0)
  })

  it('全エントリに必須フィールドが含まれること', () => {
    for (const entry of supplementTermsDictionary.entries) {
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
    const ids = supplementTermsDictionary.entries.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('NGテキストとOKテキストが異なること', () => {
    for (const entry of supplementTermsDictionary.entries) {
      expect(entry.ng).not.toBe(entry.ok)
    }
  })

  it('全エントリIDが "sup_" プレフィックスで始まること', () => {
    for (const entry of supplementTermsDictionary.entries) {
      expect(entry.id).toMatch(/^sup_/)
    }
  })

  it('各エントリの severity が正しい型であること', () => {
    for (const entry of supplementTermsDictionary.entries) {
      expect(['high', 'medium', 'low']).toContain(entry.severity)
    }
  })

  it('各エントリの reason に薬機法または景表法の言及があること', () => {
    for (const entry of supplementTermsDictionary.entries) {
      const hasLegalReference =
        entry.reason.includes('薬機法') ||
        entry.reason.includes('景表法') ||
        entry.reason.includes('健康増進法')
      expect(hasLegalReference).toBe(true)
    }
  })
})

// ==============================================================
// NG表現検出テスト（各カテゴリから代表的な表現）
// ==============================================================

describe('サプリメント NG検出テスト', () => {
  const checker = new ComplianceChecker({ categories: ['supplement'] })

  // -- 健康食品の効能断定 --
  it('「このサプリで体が変わる」がNG検出されること', () => {
    const result = checker.check('このサプリで体が変わるので試してみてください')
    const violation = result.violations.find((v) => v.ngText === 'このサプリで体が変わる')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「確実に効果がある」がNG検出されること', () => {
    const result = checker.check('このサプリメントは確実に効果がある成分を配合しています')
    const violation = result.violations.find((v) => v.ngText === '確実に効果がある')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  // -- ダイエット効果 --
  it('「飲むだけで痩せる」がNG検出されること', () => {
    const result = checker.check('飲むだけで痩せるサプリメントが登場')
    const violation = result.violations.find((v) => v.ngText === '飲むだけで痩せる')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「脂肪が燃焼する」がNG検出されること', () => {
    const result = checker.check('脂肪が燃焼するサプリメントです')
    const violation = result.violations.find((v) => v.ngText === '脂肪が燃焼する')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  // -- 即効性 --
  it('「即効性がある」がNG検出されること', () => {
    const result = checker.check('このサプリは即効性があるのが特徴です')
    const violation = result.violations.find((v) => v.ngText === '即効性がある')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「飲んですぐ効く」がNG検出されること', () => {
    const result = checker.check('飲んですぐ効くサプリメントです')
    const violation = result.violations.find((v) => v.ngText === '飲んですぐ効く')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  // -- 安全性断定 --
  it('「副作用は一切ない」がNG検出されること', () => {
    const result = checker.check('このサプリメントは副作用は一切ないので安心です')
    const violation = result.violations.find((v) => v.ngText === '副作用は一切ない')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「天然成分だから安全」がNG検出されること', () => {
    const result = checker.check('天然成分だから安全なサプリメントです')
    const violation = result.violations.find((v) => v.ngText === '天然成分だから安全')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('medium')
  })

  // -- 体質改善 --
  it('「体質が根本から変わる」がNG検出されること', () => {
    const result = checker.check('このサプリで体質が根本から変わるのを実感できます')
    const violation = result.violations.find((v) => v.ngText === '体質が根本から変わる')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「免疫力がアップする」がNG検出されること', () => {
    const result = checker.check('免疫力がアップするサプリメントです')
    const violation = result.violations.find((v) => v.ngText === '免疫力がアップする')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  // -- 医薬品的効能 --
  it('「病気が治る」がNG検出されること', () => {
    const result = checker.check('このサプリで病気が治ると言われています')
    const violation = result.violations.find((v) => v.ngText === '病気が治る')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「血圧を下げるサプリ」がNG検出されること', () => {
    const result = checker.check('血圧を下げるサプリをご紹介します')
    const violation = result.violations.find((v) => v.ngText === '血圧を下げるサプリ')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「がん予防に効果的」がNG検出されること', () => {
    const result = checker.check('このサプリメントはがん予防に効果的です')
    const violation = result.violations.find((v) => v.ngText === 'がん予防に効果的')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  // -- 比較・誇大表現 --
  it('「売上No.1サプリ」がNG検出されること', () => {
    const result = checker.check('売上No.1サプリとして話題です')
    const violation = result.violations.find((v) => v.ngText === '売上No.1サプリ')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「最強のサプリメント」がNG検出されること', () => {
    const result = checker.check('最強のサプリメントをご紹介します')
    const violation = result.violations.find((v) => v.ngText === '最強のサプリメント')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })
})

// ==============================================================
// OK変換テスト
// ==============================================================

describe('サプリメント OK変換テスト', () => {
  it('各エントリのOK表現がNG表現と異なること', () => {
    for (const entry of supplementTermsDictionary.entries) {
      expect(entry.ok).not.toBe(entry.ng)
      expect(entry.ok.length).toBeGreaterThan(0)
    }
  })

  it('high severity エントリが20件以上であること', () => {
    const highEntries = supplementTermsDictionary.entries.filter(
      (e) => e.severity === 'high'
    )
    expect(highEntries.length).toBeGreaterThanOrEqual(20)
  })

  it('medium severity エントリが存在すること', () => {
    const mediumEntries = supplementTermsDictionary.entries.filter(
      (e) => e.severity === 'medium'
    )
    expect(mediumEntries.length).toBeGreaterThan(0)
  })

  it('OK表現に「医薬品ではありません」が含まれるエントリがあること', () => {
    const hasDisclaimer = supplementTermsDictionary.entries.some(
      (e) => e.ok.includes('医薬品ではありません')
    )
    expect(hasDisclaimer).toBe(true)
  })

  it('OK表現に「個人差」が含まれるエントリがあること', () => {
    const hasIndividualDifference = supplementTermsDictionary.entries.some(
      (e) => e.ok.includes('個人差')
    )
    expect(hasIndividualDifference).toBe(true)
  })

  it('ComplianceChecker.fix() でNG表現がOK表現に変換されること', () => {
    const checker = new ComplianceChecker({ categories: ['supplement'] })
    const fixed = checker.fix('飲むだけで痩せるサプリメントです')
    expect(fixed).not.toContain('飲むだけで痩せる')
    expect(fixed).toContain('適度な運動と食事管理と併せて')
  })
})

// ==============================================================
// 複合テスト（複数NG表現含む文章）
// ==============================================================

describe('サプリメント 複合テスト', () => {
  const checker = new ComplianceChecker({ categories: ['supplement'] })

  it('複数のNG表現を含むテキストで全て検出されること', () => {
    const text = 'このサプリで体が変わる。飲むだけで痩せる。即効性がある。副作用は一切ないので安心です。'
    const result = checker.check(text)

    const ngTexts = result.violations.map((v) => v.ngText)
    expect(ngTexts).toContain('このサプリで体が変わる')
    expect(ngTexts).toContain('飲むだけで痩せる')
    expect(ngTexts).toContain('即効性がある')
    expect(ngTexts).toContain('副作用は一切ない')
  })

  it('複合テキストのスコアが低いこと', () => {
    const text = '飲むだけで痩せる。病気が治る。副作用は一切ない。最強のサプリメントです。'
    const result = checker.check(text)
    expect(result.score).toBeLessThan(50)
    expect(result.isCompliant).toBe(false)
  })

  it('準拠テキストにはNG検出がないこと', () => {
    const text = '栄養補助として日々の健康管理に活用できるサプリメントです。効果には個人差があります。'
    const result = checker.check(text)
    const supplementViolations = result.violations.filter((v) =>
      v.id.includes('supplement')
    )
    expect(supplementViolations.length).toBe(0)
  })

  it('ComplianceChecker.getDictionaryStats() に supplement カテゴリが含まれること', () => {
    const checker = new ComplianceChecker()
    const stats = checker.getDictionaryStats()
    expect(stats.supplement).toBeDefined()
    expect(stats.supplement).toBeGreaterThanOrEqual(30)
  })

  it('ComplianceChecker.getAvailableCategories() に supplement が含まれること', () => {
    const checker = new ComplianceChecker()
    const categories = checker.getAvailableCategories()
    expect(categories).toContain('supplement')
  })
})
