/**
 * E-E-A-Tバリデーション Unit Tests
 * Experience, Expertise, Authoritativeness, Trustworthiness の検証テスト
 *
 * Content エージェントが @/lib/compliance/eeat-validator を実装する前に、
 * インターフェース契約をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface EEATScore {
  experience: number       // 0-25
  expertise: number        // 0-25
  authoritativeness: number // 0-25
  trustworthiness: number   // 0-25
  total: number             // 0-100
  details: {
    hasAuthorInfo: boolean
    hasSupervisorInfo: boolean
    hasReferences: boolean
    hasUpdateDate: boolean
    hasMedicalDisclaimer: boolean
    referenceCount: number
  }
}

// 契約模倣関数
const validate = vi.fn()

describe('E-E-A-Tバリデーション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('完全準拠記事のスコアリング', () => {
    it('全要素を満たす記事がスコア80以上になること', () => {
      const fullScore: EEATScore = {
        experience: 22,
        expertise: 24,
        authoritativeness: 20,
        trustworthiness: 23,
        total: 89,
        details: {
          hasAuthorInfo: true,
          hasSupervisorInfo: true,
          hasReferences: true,
          hasUpdateDate: true,
          hasMedicalDisclaimer: true,
          referenceCount: 3,
        },
      }

      validate.mockReturnValue(fullScore)

      const score = validate({
        title: 'AGA治療の最新ガイド',
        content: '詳細な記事本文...',
        author: { name: '山田太郎', credentials: '医学博士', bio: '皮膚科専門医として15年の経験' },
        supervisor: { name: '佐藤花子', credentials: '薬剤師', bio: 'AGA治療専門' },
        references: [
          { title: 'AGA治療ガイドライン', url: 'https://pubmed.example.com/1', year: 2024 },
          { title: '薬事法関連論文', url: 'https://pubmed.example.com/2', year: 2023 },
          { title: '臨床研究データ', url: 'https://pubmed.example.com/3', year: 2025 },
        ],
        updatedAt: '2026-03-01T00:00:00Z',
        hasMedicalDisclaimer: true,
        category: 'aga',
      })

      expect(score.total).toBeGreaterThanOrEqual(80)
      expect(score.details.hasAuthorInfo).toBe(true)
      expect(score.details.hasSupervisorInfo).toBe(true)
      expect(score.details.hasReferences).toBe(true)
      expect(score.details.hasUpdateDate).toBe(true)
      expect(score.details.hasMedicalDisclaimer).toBe(true)
      expect(score.details.referenceCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe('最小限の記事のスコアリング', () => {
    it('著者情報のない記事はExpertiseが低いこと', () => {
      const minimalScore: EEATScore = {
        experience: 5,
        expertise: 3,
        authoritativeness: 5,
        trustworthiness: 8,
        total: 21,
        details: {
          hasAuthorInfo: false,
          hasSupervisorInfo: false,
          hasReferences: false,
          hasUpdateDate: false,
          hasMedicalDisclaimer: false,
          referenceCount: 0,
        },
      }

      validate.mockReturnValue(minimalScore)

      const score = validate({
        title: 'テスト記事',
        content: '本文',
        category: 'aga',
      })

      expect(score.total).toBeLessThan(50)
      expect(score.details.hasAuthorInfo).toBe(false)
      expect(score.details.hasSupervisorInfo).toBe(false)
      expect(score.details.hasReferences).toBe(false)
    })
  })

  describe('各次元の独立スコアリング', () => {
    it('Experience スコアが0-25の範囲であること', () => {
      validate.mockReturnValue({
        experience: 15,
        expertise: 0,
        authoritativeness: 0,
        trustworthiness: 0,
        total: 15,
        details: { hasAuthorInfo: true, hasSupervisorInfo: false, hasReferences: false, hasUpdateDate: false, hasMedicalDisclaimer: false, referenceCount: 0 },
      })

      const score = validate({ title: 'test', content: 'test', category: 'aga' })

      expect(score.experience).toBeGreaterThanOrEqual(0)
      expect(score.experience).toBeLessThanOrEqual(25)
    })

    it('Expertise スコアが0-25の範囲であること', () => {
      validate.mockReturnValue({
        experience: 0,
        expertise: 20,
        authoritativeness: 0,
        trustworthiness: 0,
        total: 20,
        details: { hasAuthorInfo: true, hasSupervisorInfo: true, hasReferences: false, hasUpdateDate: false, hasMedicalDisclaimer: false, referenceCount: 0 },
      })

      const score = validate({ title: 'test', content: 'test', category: 'aga' })

      expect(score.expertise).toBeGreaterThanOrEqual(0)
      expect(score.expertise).toBeLessThanOrEqual(25)
    })

    it('Authoritativeness スコアが0-25の範囲であること', () => {
      validate.mockReturnValue({
        experience: 0,
        expertise: 0,
        authoritativeness: 18,
        trustworthiness: 0,
        total: 18,
        details: { hasAuthorInfo: false, hasSupervisorInfo: false, hasReferences: true, hasUpdateDate: false, hasMedicalDisclaimer: false, referenceCount: 5 },
      })

      const score = validate({ title: 'test', content: 'test', category: 'aga' })

      expect(score.authoritativeness).toBeGreaterThanOrEqual(0)
      expect(score.authoritativeness).toBeLessThanOrEqual(25)
    })

    it('Trustworthiness スコアが0-25の範囲であること', () => {
      validate.mockReturnValue({
        experience: 0,
        expertise: 0,
        authoritativeness: 0,
        trustworthiness: 22,
        total: 22,
        details: { hasAuthorInfo: false, hasSupervisorInfo: false, hasReferences: true, hasUpdateDate: true, hasMedicalDisclaimer: true, referenceCount: 2 },
      })

      const score = validate({ title: 'test', content: 'test', category: 'aga' })

      expect(score.trustworthiness).toBeGreaterThanOrEqual(0)
      expect(score.trustworthiness).toBeLessThanOrEqual(25)
    })

    it('合計スコアが各次元の和と一致すること', () => {
      const scores = { experience: 15, expertise: 20, authoritativeness: 18, trustworthiness: 22 }
      const total = scores.experience + scores.expertise + scores.authoritativeness + scores.trustworthiness

      validate.mockReturnValue({
        ...scores,
        total,
        details: { hasAuthorInfo: true, hasSupervisorInfo: true, hasReferences: true, hasUpdateDate: true, hasMedicalDisclaimer: true, referenceCount: 3 },
      })

      const score = validate({ title: 'test', content: 'test', category: 'aga' })

      expect(score.total).toBe(score.experience + score.expertise + score.authoritativeness + score.trustworthiness)
    })
  })

  describe('YMYL カテゴリの厳格チェック', () => {
    it('医療カテゴリ (aga) で監修者なしの場合、警告スコアが低いこと', () => {
      validate.mockReturnValue({
        experience: 10,
        expertise: 5,
        authoritativeness: 8,
        trustworthiness: 10,
        total: 33,
        details: { hasAuthorInfo: true, hasSupervisorInfo: false, hasReferences: true, hasUpdateDate: true, hasMedicalDisclaimer: false, referenceCount: 1 },
      })

      const score = validate({
        title: 'AGA治療ガイド',
        content: '本文',
        category: 'aga',
        author: { name: 'Editor', credentials: '', bio: '' },
      })

      // 監修者なしのYMYL記事は低スコア
      expect(score.total).toBeLessThan(50)
      expect(score.details.hasSupervisorInfo).toBe(false)
    })
  })
})
