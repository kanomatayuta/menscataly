/**
 * アフィリエイトリンク注入モジュール Unit Tests
 * injectAffiliateLinksByCategory / generateAffiliateSection の動作を検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// モック定義
// ============================================================

import { createMockAspProgram } from '@/test/helpers'
import type { AspProgram } from '@/types/asp-config'

const mockAgaPrograms: AspProgram[] = [
  createMockAspProgram({
    id: 'afb-aga-001',
    aspName: 'afb',
    programName: 'AGAスキンクリニック',
    category: 'aga',
    affiliateUrl: 'https://t.afi-b.com/visit.php?guid=ON&a=aga-skin-001',
    epc: 85.5,
    approvalRate: 72,
    itpSupport: true,
    recommendedAnchors: ['AGAスキンクリニック 公式サイト', 'AGA治療の無料カウンセリング', 'AGA治療を始める'],
  }),
  createMockAspProgram({
    id: 'a8-aga-001',
    aspName: 'a8',
    programName: 'Dクリニック',
    category: 'aga',
    affiliateUrl: 'https://px.a8.net/svt/ejp?a8mat=aga-dclinic-001',
    epc: 70.2,
    approvalRate: 65,
    itpSupport: false,
    recommendedAnchors: ['Dクリニック 公式サイト', '薄毛治療の専門医に相談', 'AGA治療実績No.1クリニック'],
  }),
  createMockAspProgram({
    id: 'at-aga-001',
    aspName: 'accesstrade',
    programName: '銀座総合美容クリニック AGA',
    category: 'aga',
    affiliateUrl: 'https://h.accesstrade.net/sp/cc?rk=ginza-aga-001',
    epc: 95.0,
    approvalRate: 60,
    itpSupport: true,
    recommendedAnchors: ['銀座総合美容クリニック', 'AGA治療の専門院', '薄毛治療の無料相談'],
  }),
]

// getProgramsByCategory と selectBestPrograms をモック
vi.mock('@/lib/asp/config', () => ({
  getProgramsByCategory: vi.fn((category: string) => {
    if (category === 'aga') return mockAgaPrograms
    return []
  }),
}))

vi.mock('@/lib/asp/selector', () => ({
  selectBestPrograms: vi.fn((category: string, options?: { maxResults?: number }) => {
    if (category === 'aga') {
      const max = options?.maxResults ?? 3
      return mockAgaPrograms.slice(0, max)
    }
    return []
  }),
}))

import {
  injectAffiliateLinksByCategory,
  generateAffiliateSection,
} from '@/lib/asp/link-injector'

// ============================================================
// テスト
// ============================================================

describe('injectAffiliateLinksByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should inject affiliate links for matching anchor text', () => {
    const content = '<p>AGAスキンクリニック 公式サイトは多くの方に選ばれています。</p>'
    const result = injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&a=aga-skin-001"')
    expect(result).toContain('AGAスキンクリニック 公式サイト</a>')
  })

  it('should respect maxLinks parameter', () => {
    const content =
      '<p>AGAスキンクリニック 公式サイトは人気です。Dクリニック 公式サイトも有名です。銀座総合美容クリニックも推奨されています。</p>'

    const result = injectAffiliateLinksByCategory(content, 'aga', 1)

    // maxLinks=1 なので 1つだけリンクが注入される
    const linkCount = (result.match(/<a href=/g) || []).length
    expect(linkCount).toBe(1)
  })

  it('should not inject duplicate links for same anchor', () => {
    const content =
      '<p>AGAスキンクリニック 公式サイトは人気です。もう一度、AGAスキンクリニック 公式サイトを訪問しましょう。</p>'

    const result = injectAffiliateLinksByCategory(content, 'aga')

    // 同じアンカーテキストへのリンクは1つだけ
    const matches = result.match(/rel="sponsored noopener"/g) || []
    expect(matches.length).toBe(1)
  })

  it('should add rel="sponsored noopener" to all links', () => {
    const content = '<p>AGAスキンクリニック 公式サイトをチェックしましょう。</p>'
    const result = injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('rel="sponsored noopener"')
  })

  it('should add target="_blank" to all links', () => {
    const content = '<p>AGAスキンクリニック 公式サイトをチェックしましょう。</p>'
    const result = injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('target="_blank"')
  })

  it('should return original content if no programs for category', () => {
    const content = '<p>コラム記事の内容です。</p>'
    const result = injectAffiliateLinksByCategory(content, 'column')

    expect(result).toBe(content)
  })

  it('should handle empty content gracefully', () => {
    const result = injectAffiliateLinksByCategory('', 'aga')
    expect(result).toBe('')
  })
})

describe('generateAffiliateSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate HTML section with affiliate links', () => {
    const result = generateAffiliateSection('aga')

    expect(result).toContain('<div class="affiliate-section">')
    expect(result).toContain('<ul>')
    expect(result).toContain('</ul>')
    expect(result).toContain('</div>')
    expect(result).toContain('AGAスキンクリニック')
    expect(result).toContain('rel="sponsored noopener"')
    expect(result).toContain('target="_blank"')
  })

  it('should respect maxPrograms parameter', () => {
    const result = generateAffiliateSection('aga', 2)

    const linkCount = (result.match(/<li>/g) || []).length
    expect(linkCount).toBeLessThanOrEqual(2)
  })

  it('should return empty string for invalid category', () => {
    const result = generateAffiliateSection('nonexistent' as any)
    expect(result).toBe('')
  })
})
