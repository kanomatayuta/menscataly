/**
 * ASPセレクタモジュール Unit Tests
 * selectBestPrograms / toAffiliateLinks / getITPMitigationScripts の
 * 実装ロジックをテストする（config をモックして Supabase 依存を排除）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// repository モジュールをモックして Supabase 依存を排除
vi.mock('@/lib/asp/repository', () => ({
  getProgramsByCategoryFromDB: vi.fn(),
}))

import { selectBestPrograms, toAffiliateLinks, getITPMitigationScripts } from '@/lib/asp/selector'
import { getProgramsByCategoryFromDB } from '@/lib/asp/repository'
import { createMockAspProgram } from '@/test/helpers'
import type { AspProgram } from '@/types/asp-config'

const mockedGetPrograms = vi.mocked(getProgramsByCategoryFromDB)

describe('ASPセレクタモジュール（実装テスト）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ================================================================
  // selectBestPrograms
  // ================================================================
  describe('selectBestPrograms()', () => {
    it('スコア降順でプログラムを返すこと', async () => {
      const programs: AspProgram[] = [
        createMockAspProgram({ id: 'low', epc: 10, approvalRate: 10, itpSupport: false }),
        createMockAspProgram({ id: 'high', epc: 200, approvalRate: 90, itpSupport: true }),
        createMockAspProgram({ id: 'mid', epc: 80, approvalRate: 50, itpSupport: false }),
      ]
      mockedGetPrograms.mockResolvedValue(programs)

      const result = await selectBestPrograms('aga')

      // score = epc*0.4 + approvalRate*0.3 + (itp?20:0)*0.3
      // high: 200*0.4 + 90*0.3 + 20*0.3 = 80+27+6 = 113
      // mid:  80*0.4  + 50*0.3 + 0       = 32+15+0 = 47
      // low:  10*0.4  + 10*0.3 + 0       = 4+3+0   = 7
      expect(result).toHaveLength(3)
      expect(result[0].id).toBe('high')
      expect(result[1].id).toBe('mid')
      expect(result[2].id).toBe('low')
    })

    it('maxResults で返却件数を制限できること', async () => {
      const programs: AspProgram[] = [
        createMockAspProgram({ id: 'p1', epc: 100 }),
        createMockAspProgram({ id: 'p2', epc: 200 }),
        createMockAspProgram({ id: 'p3', epc: 50 }),
      ]
      mockedGetPrograms.mockResolvedValue(programs)

      const result = await selectBestPrograms('aga', { maxResults: 1 })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('p2') // 最高スコアの1件
    })

    it('requireItpSupport で ITP 対応のみフィルタできること', async () => {
      const programs: AspProgram[] = [
        createMockAspProgram({ id: 'no-itp', itpSupport: false, epc: 300 }),
        createMockAspProgram({ id: 'with-itp', itpSupport: true, epc: 50 }),
      ]
      mockedGetPrograms.mockResolvedValue(programs)

      const result = await selectBestPrograms('aga', { requireItpSupport: true })

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('with-itp')
    })

    it('プログラムが0件の場合、空配列を返すこと', async () => {
      mockedGetPrograms.mockResolvedValue([])

      const result = await selectBestPrograms('aga')

      expect(result).toEqual([])
    })

    it('getProgramsByCategoryFromDB にカテゴリを正しく渡すこと', async () => {
      mockedGetPrograms.mockResolvedValue([])

      await selectBestPrograms('hair-removal')

      expect(mockedGetPrograms).toHaveBeenCalledWith('hair-removal')
    })
  })

  // ================================================================
  // toAffiliateLinks
  // ================================================================
  describe('toAffiliateLinks()', () => {
    it('AspProgram を AffiliateLink に正しく変換すること', () => {
      const programs: AspProgram[] = [
        createMockAspProgram({
          programName: 'テストプログラム',
          aspName: 'a8',
          affiliateUrl: 'https://px.a8.net/test',
          rewardAmount: 12000,
          recommendedAnchors: ['おすすめリンク'],
        }),
      ]

      const links = toAffiliateLinks(programs)

      expect(links).toHaveLength(1)
      expect(links[0]).toEqual({
        programName: 'テストプログラム',
        aspName: 'a8',
        url: 'https://px.a8.net/test',
        rewardAmount: 12000,
        anchorText: 'おすすめリンク',
      })
    })

    it('recommendedAnchors が空の場合 programName にフォールバックすること', () => {
      const programs: AspProgram[] = [
        createMockAspProgram({
          programName: 'フォールバック名',
          recommendedAnchors: [],
        }),
      ]

      const links = toAffiliateLinks(programs)

      expect(links[0].anchorText).toBe('フォールバック名')
    })

    it('空配列を渡すと空配列を返すこと', () => {
      const links = toAffiliateLinks([])

      expect(links).toEqual([])
    })
  })

  // ================================================================
  // getITPMitigationScripts
  // ================================================================
  describe('getITPMitigationScripts()', () => {
    it('指定した ASP 名に対応する ITP 設定を返すこと', () => {
      const configs = getITPMitigationScripts(['afb', 'a8'])

      expect(configs).toHaveLength(2)
      expect(configs[0].aspName).toBe('afb')
      expect(configs[0].scriptUrl).toContain('afi-b.com')
      expect(configs[1].aspName).toBe('a8')
      expect(configs[1].scriptUrl).toContain('a8.net')
    })

    it('同じ ASP を2回渡しても重複除去されること', () => {
      const configs = getITPMitigationScripts(['afb', 'afb'])

      expect(configs).toHaveLength(1)
      expect(configs[0].aspName).toBe('afb')
    })

    it('未知の ASP 名は無視されること', () => {
      const configs = getITPMitigationScripts(['afb', 'unknown-asp' as never])

      expect(configs).toHaveLength(1)
      expect(configs[0].aspName).toBe('afb')
    })

    it('空配列を渡すと空配列を返すこと', () => {
      const configs = getITPMitigationScripts([])

      expect(configs).toEqual([])
    })

    it('全 ASP に対して設定を返せること', () => {
      const allAsps = ['afb', 'a8', 'accesstrade', 'valuecommerce', 'felmat', 'moshimo'] as const
      const configs = getITPMitigationScripts([...allAsps])

      expect(configs).toHaveLength(6)
      configs.forEach((config) => {
        expect(config.scriptUrl).toMatch(/^https:\/\//)
        expect(config.aspName).toBeDefined()
        expect(typeof config.lazyLoad).toBe('boolean')
        expect(['None', 'Lax', 'Strict']).toContain(config.sameSiteCookie)
      })
    })
  })
})
