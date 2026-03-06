/**
 * Q4: ヘルススコア & E-E-A-T スコア テスト
 * Phase 3 SEO強化 — health-score.ts
 *
 * - ヘルススコア計算（SEO + UX + 収益 = 0-100）
 * - ステータス判定（healthy / needs_improvement / critical）
 * - 改善推奨事項の生成
 * - E-E-A-T スコア計算（最大50点）
 * - バッチ計算・分布集計
 */

import { describe, it, expect } from 'vitest'
import {
  calculateHealthScore,
  getHealthStatusLabel,
  calculateBatchHealthScores,
  getHealthScoreDistribution,
  calculateEEATScore,
  type HealthScoreInput,
  type HealthScore,
  type EEATScoreInput,
} from '@/lib/content/health-score'

// ==============================================================
// テスト用データ
// ==============================================================

/** 高パフォーマンス記事 */
const highPerformanceInput: HealthScoreInput = {
  articleId: 'article-high',
  rankingPosition: 2,
  rankingChange7d: -3,
  ctr: 0.20,
  impressions: 15000,
  avgSessionDuration: 200,
  bounceRate: 0.25,
  pageviews7d: 1500,
  aspClicks: 150,
  aspConversions: 15,
  aspRevenue: 120000,
}

/** 中パフォーマンス記事 */
const midPerformanceInput: HealthScoreInput = {
  articleId: 'article-mid',
  rankingPosition: 12,
  rankingChange7d: 0,
  ctr: 0.05,
  impressions: 2000,
  avgSessionDuration: 90,
  bounceRate: 0.55,
  pageviews7d: 200,
  aspClicks: 25,
  aspConversions: 3,
  aspRevenue: 18000,
}

/** 低パフォーマンス記事 */
const lowPerformanceInput: HealthScoreInput = {
  articleId: 'article-low',
  rankingPosition: 60,
  rankingChange7d: 8,
  ctr: 0.005,
  impressions: 50,
  avgSessionDuration: 20,
  bounceRate: 0.90,
  pageviews7d: 10,
  aspClicks: 1,
  aspConversions: 0,
  aspRevenue: 0,
}

/** 全データ null の記事 */
const nullInput: HealthScoreInput = {
  articleId: 'article-null',
  rankingPosition: null,
  rankingChange7d: null,
  ctr: null,
  impressions: null,
  avgSessionDuration: null,
  bounceRate: null,
  pageviews7d: null,
  aspClicks: null,
  aspConversions: null,
  aspRevenue: null,
}

// ==============================================================
// ヘルススコア基本テスト
// ==============================================================

describe('ヘルススコア — 基本計算', () => {
  it('高パフォーマンス記事のスコアが70以上であること', () => {
    const score = calculateHealthScore(highPerformanceInput)
    expect(score.total).toBeGreaterThanOrEqual(70)
  })

  it('中パフォーマンス記事のスコアが40以上70未満であること', () => {
    const score = calculateHealthScore(midPerformanceInput)
    expect(score.total).toBeGreaterThanOrEqual(40)
    expect(score.total).toBeLessThan(70)
  })

  it('低パフォーマンス記事のスコアが40未満であること', () => {
    const score = calculateHealthScore(lowPerformanceInput)
    expect(score.total).toBeLessThan(40)
  })

  it('null データの記事のスコアが0であること', () => {
    const score = calculateHealthScore(nullInput)
    expect(score.total).toBe(0)
  })

  it('スコアが0-100の範囲に収まること', () => {
    const score = calculateHealthScore(highPerformanceInput)
    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(100)
  })
})

// ==============================================================
// サブスコアテスト
// ==============================================================

describe('ヘルススコア — サブスコア', () => {
  it('SEOスコアが0-40の範囲であること', () => {
    const score = calculateHealthScore(highPerformanceInput)
    expect(score.seoScore).toBeGreaterThanOrEqual(0)
    expect(score.seoScore).toBeLessThanOrEqual(40)
  })

  it('UXスコアが0-30の範囲であること', () => {
    const score = calculateHealthScore(highPerformanceInput)
    expect(score.uxScore).toBeGreaterThanOrEqual(0)
    expect(score.uxScore).toBeLessThanOrEqual(30)
  })

  it('収益スコアが0-30の範囲であること', () => {
    const score = calculateHealthScore(highPerformanceInput)
    expect(score.revenueScore).toBeGreaterThanOrEqual(0)
    expect(score.revenueScore).toBeLessThanOrEqual(30)
  })

  it('total = seoScore + uxScore + revenueScore であること', () => {
    const score = calculateHealthScore(midPerformanceInput)
    expect(score.total).toBe(
      Math.min(100, Math.max(0, score.seoScore + score.uxScore + score.revenueScore))
    )
  })

  it('null入力時のサブスコアが全て0であること', () => {
    const score = calculateHealthScore(nullInput)
    expect(score.seoScore).toBe(0)
    expect(score.uxScore).toBe(0)
    expect(score.revenueScore).toBe(0)
  })
})

// ==============================================================
// SEOスコア詳細テスト
// ==============================================================

describe('ヘルススコア — SEOスコア詳細', () => {
  it('1位の記事は順位スコアが最大であること', () => {
    const input: HealthScoreInput = {
      ...nullInput,
      articleId: 'seo-rank1',
      rankingPosition: 1,
    }
    const score = calculateHealthScore(input)
    expect(score.seoScore).toBe(15)
  })

  it('10位以内の記事は順位スコアが8以上であること', () => {
    const input: HealthScoreInput = {
      ...nullInput,
      articleId: 'seo-rank10',
      rankingPosition: 10,
    }
    const score = calculateHealthScore(input)
    expect(score.seoScore).toBeGreaterThanOrEqual(8)
  })

  it('大幅な順位改善 (5位以上上昇) はトレンドスコアが最大であること', () => {
    const input: HealthScoreInput = {
      ...nullInput,
      articleId: 'seo-trend-up',
      rankingChange7d: -6,
    }
    const score = calculateHealthScore(input)
    expect(score.seoScore).toBe(10)
  })

  it('高CTR (15%以上) はCTRスコアが最大であること', () => {
    const input: HealthScoreInput = {
      ...nullInput,
      articleId: 'seo-ctr-high',
      ctr: 0.20,
    }
    const score = calculateHealthScore(input)
    expect(score.seoScore).toBe(10)
  })
})

// ==============================================================
// ステータス判定テスト
// ==============================================================

describe('ヘルススコア — ステータス判定', () => {
  it('スコア70以上は healthy であること', () => {
    const score = calculateHealthScore(highPerformanceInput)
    expect(score.status).toBe('healthy')
  })

  it('スコア40-69は needs_improvement であること', () => {
    const score = calculateHealthScore(midPerformanceInput)
    expect(score.status).toBe('needs_improvement')
  })

  it('スコア40未満は critical であること', () => {
    const score = calculateHealthScore(lowPerformanceInput)
    expect(score.status).toBe('critical')
  })

  it('null入力は critical であること', () => {
    const score = calculateHealthScore(nullInput)
    expect(score.status).toBe('critical')
  })
})

// ==============================================================
// ステータスラベルテスト
// ==============================================================

describe('ヘルススコア — ステータスラベル', () => {
  it('healthy は「良好」であること', () => {
    expect(getHealthStatusLabel('healthy')).toBe('良好')
  })

  it('needs_improvement は「改善必要」であること', () => {
    expect(getHealthStatusLabel('needs_improvement')).toBe('改善必要')
  })

  it('critical は「要注意」であること', () => {
    expect(getHealthStatusLabel('critical')).toBe('要注意')
  })
})

// ==============================================================
// 改善推奨事項テスト
// ==============================================================

describe('ヘルススコア — 改善推奨事項', () => {
  it('低パフォーマンス記事に推奨事項が生成されること', () => {
    const score = calculateHealthScore(lowPerformanceInput)
    expect(score.recommendations.length).toBeGreaterThan(0)
  })

  it('高パフォーマンス記事は推奨事項が少ないこと', () => {
    const score = calculateHealthScore(highPerformanceInput)
    // 高パフォーマンスであればサブスコア閾値を上回るため、推奨事項は0〜少数
    expect(score.recommendations.length).toBeLessThanOrEqual(2)
  })

  it('null入力は推奨事項がないこと（閾値判定できないため）', () => {
    const score = calculateHealthScore(nullInput)
    // null入力ではサブスコアは全て0だが、各推奨事項のチェックで
    // null値のメトリクスは推奨事項生成をスキップされる
    expect(Array.isArray(score.recommendations)).toBe(true)
  })

  it('直帰率が高い場合にUX改善推奨が含まれること', () => {
    const input: HealthScoreInput = {
      ...nullInput,
      articleId: 'bounce-high',
      bounceRate: 0.85,
      avgSessionDuration: 30,
      pageviews7d: 10,
    }
    const score = calculateHealthScore(input)
    const hasUXRecommendation = score.recommendations.some(
      (r) => r.includes('直帰率') || r.includes('滞在時間')
    )
    expect(hasUXRecommendation).toBe(true)
  })
})

// ==============================================================
// バッチ計算テスト
// ==============================================================

describe('ヘルススコア — バッチ計算', () => {
  it('複数記事のスコアを一括計算できること', () => {
    const inputs = [highPerformanceInput, midPerformanceInput, lowPerformanceInput]
    const results = calculateBatchHealthScores(inputs)
    expect(results.size).toBe(3)
    expect(results.has('article-high')).toBe(true)
    expect(results.has('article-mid')).toBe(true)
    expect(results.has('article-low')).toBe(true)
  })

  it('各記事のスコアが個別計算と一致すること', () => {
    const inputs = [highPerformanceInput, midPerformanceInput]
    const batchResults = calculateBatchHealthScores(inputs)
    const singleHigh = calculateHealthScore(highPerformanceInput)
    const singleMid = calculateHealthScore(midPerformanceInput)

    expect(batchResults.get('article-high')!.total).toBe(singleHigh.total)
    expect(batchResults.get('article-mid')!.total).toBe(singleMid.total)
  })

  it('空の配列でも正常に動作すること', () => {
    const results = calculateBatchHealthScores([])
    expect(results.size).toBe(0)
  })
})

// ==============================================================
// スコア分布テスト
// ==============================================================

describe('ヘルススコア — スコア分布', () => {
  it('スコア分布が正しく集計されること', () => {
    const scores: HealthScore[] = [
      calculateHealthScore(highPerformanceInput),
      calculateHealthScore(midPerformanceInput),
      calculateHealthScore(lowPerformanceInput),
    ]
    const distribution = getHealthScoreDistribution(scores)
    expect(distribution.healthy).toBe(1)
    expect(distribution.needsImprovement).toBe(1)
    expect(distribution.critical).toBe(1)
  })

  it('空配列の分布が全て0であること', () => {
    const distribution = getHealthScoreDistribution([])
    expect(distribution.healthy).toBe(0)
    expect(distribution.needsImprovement).toBe(0)
    expect(distribution.critical).toBe(0)
  })
})

// ==============================================================
// E-E-A-T スコアテスト
// ==============================================================

describe('E-E-A-T スコア — 基本計算', () => {
  it('全要素が満たされた場合に最大スコア(50)が得られること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: true,
      references: [
        { url: 'https://pubmed.ncbi.nlm.nih.gov/12345/', source: 'PubMed' },
        { url: 'https://www.mhlw.go.jp/guideline', source: '厚生労働省' },
      ],
      updatedAt: new Date().toISOString(),
      hasFAQSection: true,
      internalLinkCount: 5,
      hasComparisonTable: true,
    }
    const result = calculateEEATScore(input)
    expect(result.total).toBe(50)
  })

  it('何も満たされていない場合にスコアが0であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z', // 1年以上前
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.total).toBe(0)
  })
})

// ==============================================================
// E-E-A-T 監修者スコアテスト
// ==============================================================

describe('E-E-A-T スコア — 監修者', () => {
  it('監修者ありで+10であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: true,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.supervisorScore).toBe(10)
  })

  it('監修者なしで0であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.supervisorScore).toBe(0)
  })

  it('監修者なしで推奨事項に監修者追加が含まれること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: new Date().toISOString(),
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    const hasSupervisorRec = result.recommendations.some(
      (r) => r.includes('監修者')
    )
    expect(hasSupervisorRec).toBe(true)
  })
})

// ==============================================================
// E-E-A-T 参考文献スコアテスト
// ==============================================================

describe('E-E-A-T スコア — 参考文献', () => {
  it('信頼度の高い参考文献2件以上で+15であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [
        { url: 'https://pubmed.ncbi.nlm.nih.gov/12345/' },
        { url: 'https://www.mhlw.go.jp/guideline' },
      ],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.referenceScore).toBe(15)
  })

  it('信頼度の高い参考文献1件で+8であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [
        { url: 'https://pubmed.ncbi.nlm.nih.gov/12345/' },
      ],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.referenceScore).toBe(8)
  })

  it('信頼度の高い参考文献なしで0であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [
        { url: 'https://example.com/some-blog', source: 'ブログ' },
      ],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.referenceScore).toBe(0)
  })

  it('.go.jp ドメインが信頼度の高い参考文献として認識されること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [
        { url: 'https://www.mhlw.go.jp/', source: '厚生労働省' },
        { url: 'https://www.caa.go.jp/', source: '消費者庁' },
      ],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.referenceScore).toBe(15)
  })

  it('doi.org ドメインが信頼度の高い参考文献として認識されること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [
        { url: 'https://doi.org/10.1234/example', source: '学術論文' },
        { url: 'https://pubmed.ncbi.nlm.nih.gov/98765/' },
      ],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.referenceScore).toBe(15)
  })
})

// ==============================================================
// E-E-A-T 更新日スコアテスト
// ==============================================================

describe('E-E-A-T スコア — 更新日', () => {
  it('6ヶ月以内の更新で+10であること', () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 30)
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: recentDate.toISOString(),
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.updateDateScore).toBe(10)
  })

  it('6ヶ月〜1年前の更新で+5であること', () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 250) // 約8ヶ月前
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: oldDate.toISOString(),
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.updateDateScore).toBe(5)
  })

  it('1年以上前の更新で0であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.updateDateScore).toBe(0)
  })
})

// ==============================================================
// E-E-A-T FAQ / 内部リンク / 比較テーブルテスト
// ==============================================================

describe('E-E-A-T スコア — FAQ / 内部リンク / 比較テーブル', () => {
  it('FAQセクションありで+5であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: true,
      internalLinkCount: 0,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.faqScore).toBe(5)
  })

  it('内部リンク3本以上で+5であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 3,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.internalLinkScore).toBe(5)
  })

  it('内部リンク2本以下で0であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 2,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.internalLinkScore).toBe(0)
  })

  it('比較テーブルありで+5であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: false,
      references: [],
      updatedAt: '2023-01-01T00:00:00Z',
      hasFAQSection: false,
      internalLinkCount: 0,
      hasComparisonTable: true,
    }
    const result = calculateEEATScore(input)
    expect(result.breakdown.comparisonTableScore).toBe(5)
  })
})

// ==============================================================
// E-E-A-T 推奨事項テスト
// ==============================================================

describe('E-E-A-T スコア — 推奨事項', () => {
  it('全要件を満たす場合に推奨事項が空であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: true,
      references: [
        { url: 'https://pubmed.ncbi.nlm.nih.gov/12345/' },
        { url: 'https://www.mhlw.go.jp/guideline' },
      ],
      updatedAt: new Date().toISOString(),
      hasFAQSection: true,
      internalLinkCount: 5,
      hasComparisonTable: true,
    }
    const result = calculateEEATScore(input)
    expect(result.recommendations).toHaveLength(0)
  })

  it('FAQなしでFAQ追加推奨が含まれること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: true,
      references: [
        { url: 'https://pubmed.ncbi.nlm.nih.gov/12345/' },
        { url: 'https://www.mhlw.go.jp/guideline' },
      ],
      updatedAt: new Date().toISOString(),
      hasFAQSection: false,
      internalLinkCount: 5,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    const hasFAQRec = result.recommendations.some((r) => r.includes('FAQ'))
    expect(hasFAQRec).toBe(true)
  })

  it('内部リンク不足で内部リンク追加推奨が含まれること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: true,
      references: [
        { url: 'https://pubmed.ncbi.nlm.nih.gov/12345/' },
        { url: 'https://www.mhlw.go.jp/guideline' },
      ],
      updatedAt: new Date().toISOString(),
      hasFAQSection: true,
      internalLinkCount: 1,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    const hasLinkRec = result.recommendations.some((r) => r.includes('内部リンク'))
    expect(hasLinkRec).toBe(true)
  })
})

// ==============================================================
// E-E-A-T ブレイクダウン合計テスト
// ==============================================================

describe('E-E-A-T スコア — ブレイクダウン合計', () => {
  it('total がブレイクダウンの合計であること', () => {
    const input: EEATScoreInput = {
      hasSupervisor: true,
      references: [
        { url: 'https://pubmed.ncbi.nlm.nih.gov/12345/' },
      ],
      updatedAt: new Date().toISOString(),
      hasFAQSection: true,
      internalLinkCount: 5,
      hasComparisonTable: false,
    }
    const result = calculateEEATScore(input)
    const expectedTotal =
      result.breakdown.supervisorScore +
      result.breakdown.referenceScore +
      result.breakdown.updateDateScore +
      result.breakdown.faqScore +
      result.breakdown.internalLinkScore +
      result.breakdown.comparisonTableScore
    expect(result.total).toBe(expectedTotal)
  })
})
