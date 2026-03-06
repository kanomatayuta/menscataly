/**
 * 薬機法ルールエンジン テスト
 * - NG表現の検出 (high / medium / low の各重要度)
 * - OK表現がfalse positiveにならないこと
 * - suggestedText (auto-fix) が正しく適用されること
 * - regexパターンベースの検出が動作すること
 * - カテゴリ別辞書の読み込み確認
 */

import { describe, it, expect } from 'vitest'
import {
  checkPharmaceuticalLawPatterns,
  checkRequiredElements,
} from '../pharmaceutical-law'
import { ComplianceChecker } from '../../checker'

// =============================================================================
// checkPharmaceuticalLawPatterns — regexパターン検出
// =============================================================================

describe('checkPharmaceuticalLawPatterns', () => {
  describe('high severity — 効果の断定表現', () => {
    it('「必ず効く」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('この薬は必ず効くと言われています')
      expect(violations.length).toBeGreaterThanOrEqual(1)
      const v = violations.find((v) => v.ngText === '必ず効く')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
      expect(v!.type).toBe('pharmaceutical_law')
    })

    it('「確実に治る」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('確実に治る治療法です')
      expect(violations.length).toBeGreaterThanOrEqual(1)
      const v = violations.find((v) => v.ngText === '確実に治る')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })

    it('「確実に発毛する」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('確実に発毛する薬です')
      const v = violations.find((v) => v.ngText === '確実に発毛する')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })
  })

  describe('high severity — 副作用否定表現', () => {
    it('「副作用なし」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('副作用なしで安心')
      const v = violations.find((v) => v.ngText.includes('副作用'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
      expect(v!.reason).toContain('副作用の完全否定')
    })

    it('「副作用がない」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('この薬は副作用がない')
      const v = violations.find((v) => v.ngText.includes('副作用'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })
  })

  describe('high severity — 治癒・完治表現', () => {
    it('「完治」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('AGAは完治します')
      const v = violations.find((v) => v.ngText === '完治')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })

    it('「完全に治る」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('症状が完全に治る')
      const v = violations.find((v) => v.ngText === '完全に治る')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })
  })

  describe('high severity — 安全性の断定', () => {
    it('「100%安全」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('100%安全な治療です')
      const v = violations.find((v) => v.ngText === '100%安全')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })

    it('「完全に安全」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('完全に安全です')
      const v = violations.find((v) => v.ngText === '完全に安全')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })
  })

  describe('high severity — 数値断定', () => {
    it('「90%の効果」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('90%の効果があります')
      const v = violations.find((v) => v.ngText === '90%の効果')
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })
  })

  describe('medium severity — 即効性の断定', () => {
    it('「即効効果」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('即効効果があります')
      const v = violations.find((v) => v.ngText.includes('即効'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('medium')
    })
  })

  describe('medium severity — 完全解消パターン', () => {
    it('「悩みを解消する」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('悩みを解消する方法')
      const v = violations.find((v) => v.ngText.includes('解消'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('medium')
    })
  })

  describe('Phase 4 パターン — 疾患完全改善', () => {
    it('「AGAが完全に治る」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('AGAが完全に治る方法')
      expect(violations.length).toBeGreaterThanOrEqual(1)
      const v = violations.find((v) => v.ngText.includes('AGA'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })

    it('「薄毛が治る」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('薄毛が治る方法')
      const v = violations.find((v) => v.ngText.includes('薄毛'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })

    it('「シミがなくなる」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('シミがなくなる化粧品')
      const v = violations.find((v) => v.ngText.includes('シミ'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })

    it('「絶対に効く」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('絶対に効く育毛剤')
      const v = violations.find((v) => v.ngText.includes('絶対'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })

    it('「誰でも効果を実感できる」を検出すること', () => {
      const violations = checkPharmaceuticalLawPatterns('誰でも効果を実感できる')
      const v = violations.find((v) => v.ngText.includes('誰でも'))
      expect(v).toBeDefined()
      expect(v!.severity).toBe('high')
    })
  })

  // =============================================================================
  // OK表現がfalse positiveにならないこと
  // =============================================================================

  describe('false positive 回避', () => {
    it('「効果が期待できる」はNG判定されないこと', () => {
      const violations = checkPharmaceuticalLawPatterns('発毛を促進する効果が期待できる')
      expect(violations).toHaveLength(0)
    })

    it('「個人差があります」はNG判定されないこと', () => {
      const violations = checkPharmaceuticalLawPatterns('効果には個人差があります')
      expect(violations).toHaveLength(0)
    })

    it('「副作用のリスクが低いとされている」はNG判定されないこと', () => {
      const violations = checkPharmaceuticalLawPatterns('副作用のリスクが低いとされている')
      expect(violations).toHaveLength(0)
    })

    it('「症状の改善が期待できます」はNG判定されないこと', () => {
      const violations = checkPharmaceuticalLawPatterns('症状の改善が期待できます')
      expect(violations).toHaveLength(0)
    })

    it('「安全性が確認されている」はNG判定されないこと', () => {
      const violations = checkPharmaceuticalLawPatterns('安全性が確認されている')
      expect(violations).toHaveLength(0)
    })

    it('通常の文章に対してNG判定されないこと', () => {
      const violations = checkPharmaceuticalLawPatterns(
        'AGA治療には様々な選択肢があります。医師と相談の上、適切な治療方針を検討してください。'
      )
      expect(violations).toHaveLength(0)
    })
  })

  // =============================================================================
  // suggestedText の妥当性
  // =============================================================================

  describe('suggestedText (auto-fix)', () => {
    it('「副作用なし」の修正テキストに「リスクが低い」を含むこと', () => {
      const violations = checkPharmaceuticalLawPatterns('副作用なしです')
      const v = violations.find((v) => v.ngText.includes('副作用'))
      expect(v).toBeDefined()
      expect(v!.suggestedText).toContain('リスクが低い')
    })

    it('「確実に治る」の修正テキストに「期待できる」を含むこと', () => {
      const violations = checkPharmaceuticalLawPatterns('確実に治る治療')
      const v = violations.find((v) => v.ngText === '確実に治る')
      expect(v).toBeDefined()
      expect(v!.suggestedText).toContain('期待できる')
    })

    it('「完治」の修正テキストに「改善」を含むこと', () => {
      const violations = checkPharmaceuticalLawPatterns('完治します')
      const v = violations.find((v) => v.ngText === '完治')
      expect(v).toBeDefined()
      expect(v!.suggestedText).toContain('改善')
    })

    it('数値断定の修正テキストに調査参照を含むこと', () => {
      const violations = checkPharmaceuticalLawPatterns('80%の効果が確認')
      const v = violations.find((v) => v.ngText === '80%の効果')
      expect(v).toBeDefined()
      expect(v!.suggestedText).toContain('試験')
    })
  })

  // =============================================================================
  // position が正確であること
  // =============================================================================

  describe('position (位置情報)', () => {
    it('違反のstart/end位置が正しいこと', () => {
      const text = 'この薬は必ず効くと言われています'
      const violations = checkPharmaceuticalLawPatterns(text)
      const v = violations.find((v) => v.ngText === '必ず効く')
      expect(v).toBeDefined()
      expect(text.slice(v!.position.start, v!.position.end)).toBe('必ず効く')
    })
  })
})

// =============================================================================
// checkRequiredElements — 必須要素チェック
// =============================================================================

describe('checkRequiredElements', () => {
  it('監修者情報なしで警告を返すこと', () => {
    const missing = checkRequiredElements('効果が期待できます。参考文献あり。更新日: 2026-01-01')
    expect(missing.some((m) => m.includes('監修者'))).toBe(true)
  })

  it('参考文献なしで警告を返すこと', () => {
    const missing = checkRequiredElements('医師監修の記事です。更新日: 2026-01-01')
    expect(missing.some((m) => m.includes('参考文献'))).toBe(true)
  })

  it('更新日なしで警告を返すこと', () => {
    const missing = checkRequiredElements('医師監修の記事です。参考文献あり。')
    expect(missing.some((m) => m.includes('更新日'))).toBe(true)
  })

  it('全要素揃っている場合、空配列を返すこと', () => {
    const missing = checkRequiredElements('医師監修の記事です。参考文献あり。更新日: 2026-01-01')
    expect(missing).toHaveLength(0)
  })

  it('全要素未記載の場合、3件の警告を返すこと', () => {
    const missing = checkRequiredElements('効果が期待できる治療法です。')
    expect(missing).toHaveLength(3)
  })
})

// =============================================================================
// ComplianceChecker — カテゴリ別辞書の読み込み確認
// =============================================================================

describe('ComplianceChecker — カテゴリ別辞書', () => {
  it('利用可能なカテゴリにaga/hair_removal/skincare/ed/supplement/commonが含まれること', () => {
    const checker = new ComplianceChecker()
    const categories = checker.getAvailableCategories()
    expect(categories).toContain('aga')
    expect(categories).toContain('hair_removal')
    expect(categories).toContain('skincare')
    expect(categories).toContain('ed')
    expect(categories).toContain('supplement')
    expect(categories).toContain('common')
  })

  it('各カテゴリの辞書エントリ数が0より大きいこと', () => {
    const checker = new ComplianceChecker()
    const stats = checker.getDictionaryStats()
    for (const [category, count] of Object.entries(stats)) {
      expect(count, `${category} dictionary should have entries`).toBeGreaterThan(0)
    }
  })

  it('AGAカテゴリ指定で「確実に髪が生える」を検出すること', () => {
    const checker = new ComplianceChecker({ categories: ['aga'] })
    const result = checker.check('確実に髪が生える治療法です')
    expect(result.isCompliant).toBe(false)
    expect(result.violations.some((v) => v.ngText.includes('確実に髪が生える'))).toBe(true)
  })

  it('無関係カテゴリ指定ではAGA辞書のNG表現を検出しないこと', () => {
    // skincare カテゴリのみ指定 — AGA辞書固有の表現は検出されない
    // ただし regexパターンルールは常に適用される
    const checker = new ComplianceChecker({ categories: ['skincare'] })
    const result = checker.check('確実に髪が生える治療法です')
    // 辞書ベースのAGA固有エントリは検出されない
    const dictViolation = result.violations.find((v) => v.id.startsWith('dict_aga'))
    expect(dictViolation).toBeUndefined()
  })

  it('ComplianceChecker.fix() が修正テキストを返すこと', () => {
    const checker = new ComplianceChecker()
    const fixed = checker.fix('副作用なしの薬です')
    expect(fixed).not.toContain('副作用なし')
  })
})
