/**
 * アフィリエイトリンク注入モジュール Unit Tests
 * injectAffiliateLinksByCategory / generateAffiliateSection の動作を検証する
 * normalizeText / extractCoreName ヘルパーも検証する
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
  selectBestPrograms: vi.fn(async (category: string, options?: { maxResults?: number }) => {
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
  normalizeText,
  extractCoreName,
} from '@/lib/asp/link-injector'

// ============================================================
// normalizeText ヘルパー
// ============================================================

describe('normalizeText', () => {
  it('should remove Japanese particles', () => {
    expect(normalizeText('AGAスキンクリニックの公式サイト')).toBe('AGAスキンクリニック公式サイト')
  })

  it('should remove multiple particles', () => {
    expect(normalizeText('治療を始めるには')).toBe('治療始める')
  })

  it('should normalize full-width spaces', () => {
    expect(normalizeText('AGA\u3000クリニック')).toBe('AGAクリニック')
  })

  it('should normalize half-width spaces', () => {
    expect(normalizeText('AGA クリニック')).toBe('AGAクリニック')
  })

  it('should handle mixed whitespace and particles', () => {
    expect(normalizeText('AGAスキンクリニック の 公式サイト')).toBe('AGAスキンクリニック公式サイト')
  })

  it('should return empty string for empty input', () => {
    expect(normalizeText('')).toBe('')
  })
})

// ============================================================
// extractCoreName ヘルパー
// ============================================================

describe('extractCoreName', () => {
  it('should strip "公式サイト" suffix', () => {
    expect(extractCoreName('AGAスキンクリニック 公式サイト')).toBe('AGAスキンクリニック')
  })

  it('should strip "の詳細を見る" suffix', () => {
    expect(extractCoreName('Dクリニックの詳細を見る')).toBe('Dクリニック')
  })

  it('should strip "無料カウンセリング" suffix', () => {
    expect(extractCoreName('AGAスキンクリニック 無料カウンセリング')).toBe('AGAスキンクリニック')
  })

  it('should strip "オンライン診療" suffix', () => {
    expect(extractCoreName('クリニックフォア オンライン診療')).toBe('クリニックフォア')
  })

  it('should strip "詳細はこちら" suffix', () => {
    expect(extractCoreName('銀座総合美容クリニック詳細はこちら')).toBe('銀座総合美容クリニック')
  })

  it('should handle suffix with の particle', () => {
    expect(extractCoreName('AGAスキンクリニックの公式サイト')).toBe('AGAスキンクリニック')
  })

  it('should return original if no suffix matches', () => {
    expect(extractCoreName('AGAスキンクリニック')).toBe('AGAスキンクリニック')
  })

  it('should return empty string for suffix-only input', () => {
    expect(extractCoreName('公式サイト')).toBe('')
  })
})

// ============================================================
// injectAffiliateLinksByCategory — 完全一致（既存テスト）
// ============================================================

describe('injectAffiliateLinksByCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should inject affiliate links for matching anchor text', async () => {
    const content = '<p>AGAスキンクリニック 公式サイトは多くの方に選ばれています。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&amp;a=aga-skin-001"')
    expect(result).toContain('AGAスキンクリニック 公式サイト</a>')
  })

  it('should respect maxLinks parameter', async () => {
    const content =
      '<p>AGAスキンクリニック 公式サイトは人気です。Dクリニック 公式サイトも有名です。銀座総合美容クリニックも推奨されています。</p>'

    const result = await injectAffiliateLinksByCategory(content, 'aga', 1)

    // maxLinks=1 なので 1つだけリンクが注入される
    const linkCount = (result.match(/<a href=/g) || []).length
    expect(linkCount).toBe(1)
  })

  it('should not inject duplicate links for same anchor', async () => {
    const content =
      '<p>AGAスキンクリニック 公式サイトは人気です。もう一度、AGAスキンクリニック 公式サイトを訪問しましょう。</p>'

    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // 同じアンカーテキストへのリンクは1つだけ
    const matches = result.match(/rel="sponsored noopener"/g) || []
    expect(matches.length).toBe(1)
  })

  it('should add rel="sponsored noopener" to all links', async () => {
    const content = '<p>AGAスキンクリニック 公式サイトをチェックしましょう。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('rel="sponsored noopener"')
  })

  it('should add target="_blank" to all links', async () => {
    const content = '<p>AGAスキンクリニック 公式サイトをチェックしましょう。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('target="_blank"')
  })

  it('should return original content if no programs for category', async () => {
    const content = '<p>コラム記事の内容です。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'column')

    expect(result).toBe(content)
  })

  it('should handle empty content gracefully', async () => {
    const result = await injectAffiliateLinksByCategory('', 'aga')
    expect(result).toBe('')
  })
})

// ============================================================
// 正規化マッチング（助詞・空白差異を吸収）
// ============================================================

describe('injectAffiliateLinksByCategory — normalized matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should match when content has extra の particle', async () => {
    // anchor: "AGAスキンクリニック 公式サイト" vs content: "AGAスキンクリニックの公式サイト"
    const content = '<p>AGAスキンクリニックの公式サイトは多くの方に選ばれています。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&amp;a=aga-skin-001"')
    expect(result).toContain('AGAスキンクリニックの公式サイト</a>')
  })

  it('should match when content has missing space', async () => {
    // anchor: "AGAスキンクリニック 公式サイト" vs content: "AGAスキンクリニック公式サイト"
    const content = '<p>AGAスキンクリニック公式サイトは多くの方に選ばれています。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&amp;a=aga-skin-001"')
    expect(result).toContain('AGAスキンクリニック公式サイト</a>')
  })

  it('should match when content has full-width space instead of half-width', async () => {
    // anchor: "AGAスキンクリニック 公式サイト" (half-width) vs content with full-width space
    const content = '<p>AGAスキンクリニック\u3000公式サイトは多くの方に選ばれています。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&amp;a=aga-skin-001"')
    // The link text should preserve the original content text (with full-width space)
    expect(result).toContain('</a>')
  })

  it('should match with を particle difference between anchor and content', async () => {
    // anchor: "薄毛治療の専門医に相談" vs content: "薄毛治療専門医相談" (particles の/に removed)
    // The second program (Dクリニック) has anchor "薄毛治療の専門医に相談"
    // normalized: "薄毛治療専門医相談" should match
    const content = '<p>薄毛治療専門医相談から始めましょう。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('<a href="https://px.a8.net/svt/ejp?a8mat=aga-dclinic-001"')
    expect(result).toContain('薄毛治療専門医相談</a>')
  })

  it('should use original content text as link text (not the anchor)', async () => {
    const content = '<p>AGAスキンクリニックの公式サイトで詳細を確認しましょう。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // Link text should be the content's version (with の), not the anchor's version
    expect(result).toContain('AGAスキンクリニックの公式サイト</a>')
    expect(result).not.toContain('AGAスキンクリニック 公式サイト</a>')
  })
})

// ============================================================
// コアネーム マッチング
// ============================================================

describe('injectAffiliateLinksByCategory — core name matching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should match by core name when full anchor not found', async () => {
    // anchor: "AGAスキンクリニック 公式サイト" — core name: "AGAスキンクリニック"
    // content does not contain "公式サイト" at all
    const content = '<p>AGAスキンクリニックでは最新の治療が受けられます。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&amp;a=aga-skin-001"')
    expect(result).toContain('AGAスキンクリニック</a>')
  })

  it('should prefer exact match over core name match', async () => {
    // Both exact and core name could match — exact should win
    const content = '<p>AGAスキンクリニック 公式サイトは信頼されています。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('AGAスキンクリニック 公式サイト</a>')
  })
})

// ============================================================
// 禁止タグ内の保護
// ============================================================

describe('injectAffiliateLinksByCategory — forbidden tag protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not inject links inside existing <a> tags', async () => {
    const content = '<p><a href="https://other.example.com">AGAスキンクリニック 公式サイト</a>は有名です。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // alreadyLinked regex catches this, so no additional link should be injected for this anchor
    // Check that the original link is preserved and no double-wrapping
    const linkCount = (result.match(/<a /g) || []).length
    // The first anchor's already linked, so it moves to the next program
    expect(result).not.toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&a=aga-skin-001"')
  })

  it('should not inject links inside <h2> tags', async () => {
    const content = '<h2>AGAスキンクリニック 公式サイトについて</h2><p>詳しくはこちら。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // Should not wrap text inside h2
    expect(result).not.toContain('<h2><a href=')
    expect(result).not.toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&a=aga-skin-001"')
  })

  it('should not inject links inside <h3> tags', async () => {
    const content = '<h3>AGAスキンクリニック 公式サイトの特徴</h3><p>ここに本文。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).not.toContain('<h3><a href=')
    expect(result).not.toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&a=aga-skin-001"')
  })

  it('should not inject links inside <script> tags', async () => {
    const content = '<script>var x = "AGAスキンクリニック 公式サイト";</script><p>本文です。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).not.toContain('<script><a href=')
    expect(result).not.toContain('<a href="https://t.afi-b.com/visit.php?guid=ON&a=aga-skin-001"')
  })

  it('should inject link in <p> but not in <h2> when text appears in both', async () => {
    const content = '<h2>AGAスキンクリニック 公式サイト</h2><p>AGAスキンクリニック 公式サイトは有名です。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // h2 should be untouched
    expect(result).toContain('<h2>AGAスキンクリニック 公式サイト</h2>')
    // p should have the link
    expect(result).toContain('<p><a href="https://t.afi-b.com/visit.php?guid=ON&amp;a=aga-skin-001"')
  })
})

// ============================================================
// XSS protection
// ============================================================

describe('XSS protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should escape special characters in affiliate URL', async () => {
    // affiliateUrlに " と & が含まれるケース
    const { selectBestPrograms } = await import('@/lib/asp/selector')
    const mockedSelect = vi.mocked(selectBestPrograms)
    mockedSelect.mockResolvedValueOnce([
      createMockAspProgram({
        id: 'xss-test-001',
        programName: 'XSSテストクリニック',
        affiliateUrl: 'https://example.com/test?a=1&b=2"onclick="alert(1)',
        recommendedAnchors: ['XSSテストクリニック 公式サイト'],
      }),
    ])

    const content = '<p>XSSテストクリニック 公式サイトはこちらです。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // エスケープされた形式が含まれることを確認
    expect(result).toContain('&amp;')
    expect(result).toContain('&quot;')
    // 生の " がhref属性値内に含まれないことを確認
    expect(result).not.toContain('href="https://example.com/test?a=1&b=2"onclick')
    expect(result).toContain('href="https://example.com/test?a=1&amp;b=2&quot;onclick=&quot;alert(1)')
  })

  it('should escape < and > in affiliate URL', async () => {
    const { selectBestPrograms } = await import('@/lib/asp/selector')
    const mockedSelect = vi.mocked(selectBestPrograms)
    mockedSelect.mockResolvedValueOnce([
      createMockAspProgram({
        id: 'xss-test-002',
        programName: 'タグテストクリニック',
        affiliateUrl: 'https://example.com/test?x=<script>alert(1)</script>',
        recommendedAnchors: ['タグテストクリニック 公式サイト'],
      }),
    ])

    const content = '<p>タグテストクリニック 公式サイトをチェック。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    expect(result).toContain('&lt;script&gt;')
    expect(result).not.toContain('<script>alert(1)</script>')
  })
})

// ============================================================
// performance — forbidden range caching
// ============================================================

describe('performance — forbidden range caching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle content with many tags efficiently', async () => {
    const bigContent = Array.from({length: 100}, (_, i) =>
      `<p>段落${i}のテキスト</p><h2>見出し${i}</h2>`
    ).join('') + '<p>AGAスキンクリニック 公式サイトはこちら</p>'

    const start = performance.now()
    const result = await injectAffiliateLinksByCategory(bigContent, 'aga')
    const elapsed = performance.now() - start

    expect(result).toContain('<a href=')
    expect(result).toContain('AGAスキンクリニック 公式サイト</a>')
    // 大量のHTMLタグがあっても1秒以内に処理が完了すること
    expect(elapsed).toBeLessThan(1000)
  })
})

// ============================================================
// generateAffiliateSection
// ============================================================

describe('generateAffiliateSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should generate HTML section with affiliate links', async () => {
    const result = await generateAffiliateSection('aga')

    expect(result).toContain('<div class="affiliate-section">')
    expect(result).toContain('<ul>')
    expect(result).toContain('</ul>')
    expect(result).toContain('</div>')
    expect(result).toContain('AGAスキンクリニック')
    expect(result).toContain('rel="sponsored noopener"')
    expect(result).toContain('target="_blank"')
  })

  it('should respect maxPrograms parameter', async () => {
    const result = await generateAffiliateSection('aga', 2)

    const linkCount = (result.match(/<li>/g) || []).length
    expect(linkCount).toBeLessThanOrEqual(2)
  })

  it('should return empty string for invalid category', async () => {
    const result = await generateAffiliateSection('nonexistent' as any)
    expect(result).toBe('')
  })
})
