/**
 * ASPセレクタモジュール Unit Tests
 * 最適ASP選定・アフィリエイトリンク変換・ITPスクリプトの契約テスト
 *
 * Backend エージェントが @/lib/asp/selector を実装する前に、
 * インターフェース契約をテストする。
 */

import { describe, it, expect } from 'vitest'
import {
  createMockAspProgram,
  createMockItpMitigationConfig,
} from '@/test/helpers'
import type { AspProgram, AspSelectionResult, ItpMitigationConfig } from '@/types/asp-config'

// モックデータ準備
const mockPrograms: AspProgram[] = [
  createMockAspProgram({ id: 'asp-001', aspName: 'afb', epc: 120, approvalRate: 45 }),
  createMockAspProgram({ id: 'asp-002', aspName: 'a8', epc: 200, approvalRate: 60 }),
  createMockAspProgram({ id: 'asp-003', aspName: 'accesstrade', epc: 80, approvalRate: 70 }),
]

// 期待されるインターフェース契約を模倣
const mockSelectionResult: AspSelectionResult = {
  selectedPrograms: [
    { program: mockPrograms[1], score: 92, reason: 'EPC最高値' },
    { program: mockPrograms[0], score: 78, reason: '承認率良好' },
    { program: mockPrograms[2], score: 65, reason: 'ITP対応済み' },
  ],
  category: 'aga',
  selectionCriteria: {
    prioritizeEpc: true,
    prioritizeApprovalRate: false,
    requireItpSupport: false,
  },
}

const mockItpConfigs: ItpMitigationConfig[] = [
  createMockItpMitigationConfig({ aspName: 'afb' }),
  createMockItpMitigationConfig({ aspName: 'a8', scriptUrl: 'https://px.a8.net/itp.js' }),
]

// 契約模倣関数
const selectBestPrograms = (_category: string, _criteria?: Record<string, unknown>): AspSelectionResult => mockSelectionResult

const toAffiliateLinks = (programs: AspProgram[]) => {
  return programs.map(p => ({
    programName: p.programName,
    aspName: p.aspName,
    url: p.affiliateUrl,
    rewardAmount: p.rewardAmount,
    anchorText: p.recommendedAnchors[0] ?? p.programName,
  }))
}

const getITPMitigationScripts = (): ItpMitigationConfig[] => mockItpConfigs

describe('ASPセレクタモジュール', () => {
  describe('selectBestPrograms()', () => {
    it('スコア付きプログラムを返すこと', () => {
      const result = selectBestPrograms('aga')
      expect(result.selectedPrograms).toBeDefined()
      expect(result.selectedPrograms.length).toBeGreaterThan(0)
    })

    it('スコアが降順にソートされていること', () => {
      const result = selectBestPrograms('aga')
      const scores = result.selectedPrograms.map(sp => sp.score)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1])
      }
    })

    it('各選定結果にprogram, score, reasonが含まれること', () => {
      const result = selectBestPrograms('aga')
      result.selectedPrograms.forEach(sp => {
        expect(sp.program).toBeDefined()
        expect(typeof sp.score).toBe('number')
        expect(sp.score).toBeGreaterThanOrEqual(0)
        expect(sp.score).toBeLessThanOrEqual(100)
        expect(typeof sp.reason).toBe('string')
        expect(sp.reason.length).toBeGreaterThan(0)
      })
    })

    it('選定結果にカテゴリと選定基準が含まれること', () => {
      const result = selectBestPrograms('aga')
      expect(result.category).toBe('aga')
      expect(result.selectionCriteria).toBeDefined()
      expect(typeof result.selectionCriteria.prioritizeEpc).toBe('boolean')
      expect(typeof result.selectionCriteria.prioritizeApprovalRate).toBe('boolean')
      expect(typeof result.selectionCriteria.requireItpSupport).toBe('boolean')
    })
  })

  describe('toAffiliateLinks()', () => {
    it('プログラムをアフィリエイトリンク形式に変換すること', () => {
      const links = toAffiliateLinks(mockPrograms)
      expect(links).toHaveLength(mockPrograms.length)
    })

    it('各リンクに必須フィールドが含まれること', () => {
      const links = toAffiliateLinks(mockPrograms)
      links.forEach(link => {
        expect(link.programName).toBeDefined()
        expect(link.aspName).toBeDefined()
        expect(link.url).toBeDefined()
        expect(link.url).toMatch(/^https?:\/\//)
        expect(typeof link.rewardAmount).toBe('number')
        expect(link.anchorText).toBeDefined()
        expect(link.anchorText.length).toBeGreaterThan(0)
      })
    })

    it('空配列を渡すと空配列を返すこと', () => {
      const links = toAffiliateLinks([])
      expect(links).toHaveLength(0)
    })
  })

  describe('getITPMitigationScripts()', () => {
    it('ITPミティゲーション設定を返すこと', () => {
      const configs = getITPMitigationScripts()
      expect(configs).toBeDefined()
      expect(configs.length).toBeGreaterThan(0)
    })

    it('各設定に必須フィールドが含まれること', () => {
      const configs = getITPMitigationScripts()
      configs.forEach(config => {
        expect(config.aspName).toBeDefined()
        expect(config.scriptUrl).toBeDefined()
        expect(config.scriptUrl).toMatch(/^https?:\/\//)
        expect(config.scriptAttributes).toBeDefined()
        expect(typeof config.lazyLoad).toBe('boolean')
        expect(['Strict', 'Lax', 'None']).toContain(config.sameSiteCookie)
      })
    })

    it('スクリプトURLがASPごとに異なること', () => {
      const configs = getITPMitigationScripts()
      const urls = configs.map(c => c.scriptUrl)
      const uniqueUrls = new Set(urls)
      expect(uniqueUrls.size).toBe(urls.length)
    })
  })
})
