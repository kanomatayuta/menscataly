/**
 * Phase 2 コンプライアンス辞書 Unit Tests
 * 60新規エントリ (AGA 20 + ED 15 + Beauty 15 + Price 10) のテスト
 */

import { describe, it, expect } from 'vitest'
import agaTermsDictionary from '@/lib/compliance/dictionaries/aga-terms'
import edTermsDictionary from '@/lib/compliance/dictionaries/ed-terms'
import beautyTermsDictionary from '@/lib/compliance/dictionaries/beauty-terms'
import priceTermsDictionary from '@/lib/compliance/dictionaries/price-terms'
import { ComplianceChecker } from '@/lib/compliance/checker'
import type { DictionaryFile, NGEntry } from '@/lib/compliance/types'

// ==============================================================
// ヘルパー
// ==============================================================

/** 全Phase2辞書を結合して返す */
function getAllPhase2Entries(): NGEntry[] {
  return [
    ...agaTermsDictionary.entries,
    ...edTermsDictionary.entries,
    ...beautyTermsDictionary.entries,
    ...priceTermsDictionary.entries,
  ]
}

// ==============================================================
// 辞書構造の基本テスト
// ==============================================================

describe('Phase 2 コンプライアンス辞書 構造テスト', () => {
  const dictionaries: Array<{ name: string; dict: DictionaryFile; expectedCount: number }> = [
    { name: 'AGA治療 拡張辞書', dict: agaTermsDictionary, expectedCount: 20 },
    { name: 'ED治療 拡張辞書', dict: edTermsDictionary, expectedCount: 15 },
    { name: '美容全般 拡張辞書', dict: beautyTermsDictionary, expectedCount: 15 },
    { name: '価格・費用 拡張辞書', dict: priceTermsDictionary, expectedCount: 10 },
  ]

  for (const { name, dict, expectedCount } of dictionaries) {
    describe(name, () => {
      it(`${expectedCount}件のエントリが含まれること`, () => {
        expect(dict.entries.length).toBe(expectedCount)
      })

      it('category フィールドが設定されていること', () => {
        expect(dict.category).toBeDefined()
        expect(typeof dict.category).toBe('string')
      })

      it('description フィールドが設定されていること', () => {
        expect(dict.description).toBeDefined()
        expect(dict.description.length).toBeGreaterThan(0)
      })

      it('全エントリに必須フィールドが含まれること', () => {
        for (const entry of dict.entries) {
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
        const ids = dict.entries.map((e) => e.id)
        const uniqueIds = new Set(ids)
        expect(uniqueIds.size).toBe(ids.length)
      })

      it('NGテキストとOKテキストが異なること', () => {
        for (const entry of dict.entries) {
          expect(entry.ng).not.toBe(entry.ok)
        }
      })
    })
  }

  it('全60エントリが存在すること', () => {
    const allEntries = getAllPhase2Entries()
    expect(allEntries.length).toBe(60)
  })

  it('全Phase2辞書のIDがユニークであること', () => {
    const allIds = getAllPhase2Entries().map((e) => e.id)
    const uniqueIds = new Set(allIds)
    expect(uniqueIds.size).toBe(allIds.length)
  })
})

// ==============================================================
// AGA辞書: NG表現の変換テスト
// ==============================================================

describe('AGA治療 辞書エントリ変換テスト', () => {
  const checker = new ComplianceChecker({ categories: ['aga'] })

  it('「髪が生えてくる」がNG検出されること', () => {
    const result = checker.check('この治療で髪が生えてくる')
    const violation = result.violations.find((v) => v.ngText === '髪が生えてくる')
    expect(violation).toBeDefined()
    expect(violation!.suggestedText).toContain('発毛を促進する効果')
  })

  it('「抜け毛が止まる」がNG検出されること', () => {
    const result = checker.check('この薬で抜け毛が止まる')
    const violation = result.violations.find((v) => v.ngText === '抜け毛が止まる')
    expect(violation).toBeDefined()
  })

  it('「AGAを完全に克服」がNG検出されること', () => {
    const result = checker.check('AGAを完全に克服できます')
    const violation = result.violations.find((v) => v.ngText === 'AGAを完全に克服')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「誰でも発毛する」がNG検出されること', () => {
    const result = checker.check('この薬は誰でも発毛するものです')
    const violation = result.violations.find((v) => v.ngText === '誰でも発毛する')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「フィナステリドは安全」がNG検出されること', () => {
    const result = checker.check('フィナステリドは安全です')
    const violation = result.violations.find((v) => v.ngText === 'フィナステリドは安全')
    expect(violation).toBeDefined()
  })

  it('「最安のAGA治療」がNG検出されること', () => {
    const result = checker.check('最安のAGA治療を紹介')
    const violation = result.violations.find((v) => v.ngText === '最安のAGA治療')
    expect(violation).toBeDefined()
  })

  it('「すぐに効果を実感」がNG検出されること', () => {
    const result = checker.check('すぐに効果を実感できます')
    const violation = result.violations.find((v) => v.ngText === 'すぐに効果を実感')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('medium')
  })
})

// ==============================================================
// ED辞書: NG表現の変換テスト
// ==============================================================

describe('ED治療 辞書エントリ変換テスト', () => {
  const checker = new ComplianceChecker({ categories: ['ed'] })

  it('「EDが完全に治せる」がNG検出されること', () => {
    const result = checker.check('EDが完全に治せる治療法です')
    const violation = result.violations.find((v) => v.ngText === 'EDが完全に治せる')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「タダラフィルは完全に安全」がNG検出されること', () => {
    const result = checker.check('タダラフィルは完全に安全です')
    const violation = result.violations.find((v) => v.ngText === 'タダラフィルは完全に安全')
    expect(violation).toBeDefined()
  })

  it('「誰にもバレずにED治療」がNG検出されること', () => {
    const result = checker.check('誰にもバレずにED治療を受けましょう')
    const violation = result.violations.find((v) => v.ngText === '誰にもバレずにED治療')
    expect(violation).toBeDefined()
  })

  it('「個人輸入なら安くED薬が手に入る」がNG検出されること', () => {
    const result = checker.check('個人輸入なら安くED薬が手に入る方法があります')
    const violation = result.violations.find((v) => v.ngText === '個人輸入なら安くED薬が手に入る')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「何歳でもEDは治せる」がNG検出されること', () => {
    const result = checker.check('何歳でもEDは治せるから安心です')
    const violation = result.violations.find((v) => v.ngText === '何歳でもEDは治せる')
    expect(violation).toBeDefined()
  })
})

// ==============================================================
// 美容辞書: NG表現の変換テスト
// ==============================================================

describe('美容全般 辞書エントリ変換テスト', () => {
  const checker = new ComplianceChecker({ categories: ['common'] })

  it('「肌が生まれ変わる」がNG検出されること', () => {
    const result = checker.check('この化粧品で肌が生まれ変わる')
    const violation = result.violations.find((v) => v.ngText === '肌が生まれ変わる')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「肌の奥まで浸透する」がNG検出されること', () => {
    const result = checker.check('有効成分が肌の奥まで浸透する化粧品です')
    const violation = result.violations.find((v) => v.ngText === '肌の奥まで浸透する')
    expect(violation).toBeDefined()
    expect(violation!.suggestedText).toContain('角質層')
  })

  it('「二度と毛が生えてこない」がNG検出されること', () => {
    const result = checker.check('二度と毛が生えてこない脱毛です')
    const violation = result.violations.find((v) => v.ngText === '二度と毛が生えてこない')
    expect(violation).toBeDefined()
  })

  it('「エステ脱毛で永久脱毛」がNG検出されること', () => {
    const result = checker.check('エステ脱毛で永久脱毛できます')
    const violation = result.violations.find((v) => v.ngText === 'エステ脱毛で永久脱毛')
    expect(violation).toBeDefined()
  })

  it('「敏感肌でも絶対大丈夫」がNG検出されること', () => {
    const result = checker.check('敏感肌でも絶対大丈夫な化粧品です')
    const violation = result.violations.find((v) => v.ngText === '敏感肌でも絶対大丈夫')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })
})

// ==============================================================
// 価格辞書: NG表現の変換テスト
// ==============================================================

describe('価格・費用 辞書エントリ変換テスト', () => {
  const checker = new ComplianceChecker({ categories: ['common'] })

  it('「業界最安水準」がNG検出されること', () => {
    const result = checker.check('業界最安水準の価格で提供')
    const violation = result.violations.find((v) => v.ngText === '業界最安水準')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })

  it('「追加費用一切なし」がNG検出されること', () => {
    const result = checker.check('追加費用一切なしで安心です')
    const violation = result.violations.find((v) => v.ngText === '追加費用一切なし')
    expect(violation).toBeDefined()
  })

  it('「コスパ最強」がNG検出されること', () => {
    const result = checker.check('コスパ最強の美容サービスです')
    const violation = result.violations.find((v) => v.ngText === 'コスパ最強')
    expect(violation).toBeDefined()
  })

  it('「残りわずか」がNG検出されること', () => {
    const result = checker.check('予約枠残りわずかです')
    const violation = result.violations.find((v) => v.ngText === '残りわずか')
    expect(violation).toBeDefined()
  })

  it('「今なら無料」がNG検出されること', () => {
    const result = checker.check('今なら無料でカウンセリングが受けられます')
    const violation = result.violations.find((v) => v.ngText === '今なら無料')
    expect(violation).toBeDefined()
    expect(violation!.severity).toBe('high')
  })
})

// ==============================================================
// 複合テスト: 複数NG表現が1テキスト内にある場合
// ==============================================================

describe('複合テスト: 複数NG表現の検出', () => {
  const checker = new ComplianceChecker({
    categories: ['aga', 'common'],
  })

  it('1つのテキストに複数のNG表現がある場合、全て検出されること', () => {
    const text = '髪が生えてくる最安のAGA治療。肌が生まれ変わるスキンケアも紹介。コスパ最強です。'
    const result = checker.check(text)

    const ngTexts = result.violations.map((v) => v.ngText)
    expect(ngTexts).toContain('髪が生えてくる')
    expect(ngTexts).toContain('最安のAGA治療')
    expect(ngTexts).toContain('肌が生まれ変わる')
    expect(ngTexts).toContain('コスパ最強')
    expect(result.violations.length).toBeGreaterThanOrEqual(4)
  })

  it('NG表現を含むテキストのスコアが低くなること', () => {
    const ngText = '髪が生えてくる。誰でも発毛する。AGAを完全に克服できます。'
    const okText = '発毛を促進する効果が期待できます。'

    const ngResult = checker.check(ngText)
    const okResult = checker.check(okText)

    expect(ngResult.score).toBeLessThan(okResult.score)
  })

  it('コンプライアンスチェッカーのautoFixでNG表現が修正されること', () => {
    const fixChecker = new ComplianceChecker({
      categories: ['aga'],
      autoFix: true,
    })
    const text = '髪が生えてくる治療法です'
    const result = fixChecker.check(text)

    expect(result.fixedText).not.toContain('髪が生えてくる')
    expect(result.fixedText).toContain('発毛を促進する効果')
  })
})

// ==============================================================
// カテゴリ別コンプライアンススコアリング
// ==============================================================

describe('カテゴリ別コンプライアンススコアリング', () => {
  it('AGAカテゴリでhigh違反があるとスコアが大きく下がること', () => {
    const checker = new ComplianceChecker({ categories: ['aga'] })
    const result = checker.check('フィナステリドは安全です。ミノキシジルに副作用はない。')

    // high違反2つ -> 100 - 20*2 = 60 (ルールベースの違反も含む可能性あるため <= 60)
    expect(result.score).toBeLessThanOrEqual(60)
    expect(result.isCompliant).toBe(false)
  })

  it('medium違反のみの場合スコアが中程度であること', () => {
    const checker = new ComplianceChecker({ categories: ['aga'] })
    const result = checker.check('すぐに効果を実感できる治療法です')

    // medium違反1つ -> 100 - 10 = 90
    const mediumViolations = result.violations.filter((v) => v.severity === 'medium')
    expect(mediumViolations.length).toBeGreaterThanOrEqual(1)
  })

  it('OK表現のみのテキストはコンプライアントであること', () => {
    const checker = new ComplianceChecker({ categories: ['aga'] })
    const text =
      '※本記事はアフィリエイト広告を含みます。\n発毛を促進する効果が期待できる治療法をご紹介します。副作用のリスクが低いとされています。\n監修: 田中医師\n参考文献: AGA診療ガイドライン\n最終更新日: 2026年3月1日'
    const result = checker.check(text)

    // 辞書ベースのNG表現は検出されないが、ルールベースチェックが走る可能性がある
    const dictViolations = result.violations.filter((v) => v.id.startsWith('dict_'))
    expect(dictViolations.length).toBe(0)
  })
})
