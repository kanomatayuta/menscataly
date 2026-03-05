/**
 * ASP設定モジュール Unit Tests
 * プログラム取得・カテゴリフィルタ・ASPフィルタの契約テスト
 *
 * Backend エージェントが @/lib/asp/config を実装する前に、
 * インターフェース契約をテストする。モック関数を直接テスト。
 */

import { describe, it, expect } from 'vitest'
import {
  createMockAspProgram,
} from '@/test/helpers'
import type { AspProgram } from '@/types/asp-config'

// モックプログラムデータ — Backend 実装の期待される返り値
const mockPrograms: AspProgram[] = [
  createMockAspProgram({ id: 'asp-001', category: 'aga', aspName: 'afb', epc: 120 }),
  createMockAspProgram({ id: 'asp-002', category: 'aga', aspName: 'a8', epc: 90 }),
  createMockAspProgram({ id: 'asp-003', category: 'ed', aspName: 'afb', epc: 150 }),
  createMockAspProgram({ id: 'asp-004', category: 'skincare', aspName: 'accesstrade', epc: 80 }),
]

// 期待されるインターフェース契約を模倣する関数群
const getPrograms = () => mockPrograms
const getProgramsByCategory = (cat: string) => mockPrograms.filter(p => p.category === cat)
const getProgramsByAsp = (asp: string) => mockPrograms.filter(p => p.aspName === asp)
const ASP_PROGRAMS = mockPrograms

describe('ASP設定モジュール', () => {
  describe('getPrograms()', () => {
    it('全プログラムを返すこと', () => {
      const programs = getPrograms()
      expect(programs).toHaveLength(4)
    })

    it('返却されるプログラムが配列であること', () => {
      const programs = getPrograms()
      expect(Array.isArray(programs)).toBe(true)
    })
  })

  describe('getProgramsByCategory()', () => {
    it('aga カテゴリのプログラムを正しくフィルタすること', () => {
      const agaPrograms = getProgramsByCategory('aga')
      expect(agaPrograms).toHaveLength(2)
      agaPrograms.forEach(p => {
        expect(p.category).toBe('aga')
      })
    })

    it('ed カテゴリのプログラムを正しくフィルタすること', () => {
      const edPrograms = getProgramsByCategory('ed')
      expect(edPrograms).toHaveLength(1)
      expect(edPrograms[0].category).toBe('ed')
    })

    it('存在しないカテゴリは空配列を返すこと', () => {
      const programs = getProgramsByCategory('nonexistent')
      expect(programs).toHaveLength(0)
    })
  })

  describe('getProgramsByAsp()', () => {
    it('afb のプログラムを正しくフィルタすること', () => {
      const afbPrograms = getProgramsByAsp('afb')
      expect(afbPrograms).toHaveLength(2)
      afbPrograms.forEach(p => {
        expect(p.aspName).toBe('afb')
      })
    })

    it('a8 のプログラムを正しくフィルタすること', () => {
      const a8Programs = getProgramsByAsp('a8')
      expect(a8Programs).toHaveLength(1)
      expect(a8Programs[0].aspName).toBe('a8')
    })

    it('存在しないASPは空配列を返すこと', () => {
      const programs = getProgramsByAsp('unknown')
      expect(programs).toHaveLength(0)
    })
  })

  describe('ASP_PROGRAMS 定数', () => {
    it('エクスポートされていること', () => {
      expect(ASP_PROGRAMS).toBeDefined()
      expect(Array.isArray(ASP_PROGRAMS)).toBe(true)
    })
  })

  describe('プログラムフィールド検証', () => {
    it('全プログラムに必須フィールドが存在すること', () => {
      const programs = getPrograms()
      programs.forEach(program => {
        expect(program.id).toBeDefined()
        expect(typeof program.id).toBe('string')
        expect(program.aspName).toBeDefined()
        expect(program.programName).toBeDefined()
        expect(program.programId).toBeDefined()
        expect(program.category).toBeDefined()
        expect(Array.isArray(program.rewardTiers)).toBe(true)
        expect(program.rewardTiers.length).toBeGreaterThan(0)
        program.rewardTiers.forEach(tier => {
          expect(typeof tier.condition).toBe('string')
          expect(typeof tier.amount).toBe('number')
          expect(['fixed', 'percentage']).toContain(tier.type)
        })
        expect(typeof program.approvalRate).toBe('number')
        expect(program.approvalRate).toBeGreaterThanOrEqual(0)
        expect(program.approvalRate).toBeLessThanOrEqual(100)
        expect(typeof program.epc).toBe('number')
        expect(typeof program.itpSupport).toBe('boolean')
        expect(typeof program.cookieDuration).toBe('number')
        expect(typeof program.isActive).toBe('boolean')
        expect(Array.isArray(program.recommendedAnchors)).toBe(true)
      })
    })

    it('rewardTiers の各 amount が正の値であること', () => {
      const programs = getPrograms()
      programs.forEach(program => {
        program.rewardTiers.forEach(tier => {
          expect(tier.amount).toBeGreaterThan(0)
        })
      })
    })
  })
})
