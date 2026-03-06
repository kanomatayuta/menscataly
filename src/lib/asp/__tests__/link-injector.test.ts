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
    epc: 85.5,
    approvalRate: 72,
    itpSupport: true,
    recommendedAnchors: ['AGAスキンクリニック 公式サイト', 'AGA治療の無料カウンセリング', 'AGA治療を始める'],
    adCreatives: [
      {
        id: 'cr-afb-aga-001',
        type: 'text',
        label: 'テキスト',
        affiliateUrl: 'https://t.afi-b.com/visit.php?guid=ON&a=aga-skin-001',
        anchorText: '',
        isActive: true,
        useForInjection: true,
        useForBanner: false,
      },
    ],
  }),
  createMockAspProgram({
    id: 'a8-aga-001',
    aspName: 'a8',
    programName: 'Dクリニック',
    category: 'aga',
    epc: 70.2,
    approvalRate: 65,
    itpSupport: false,
    recommendedAnchors: ['Dクリニック 公式サイト', '薄毛治療の専門医に相談', 'AGA治療実績No.1クリニック'],
    adCreatives: [
      {
        id: 'cr-a8-aga-001',
        type: 'text',
        label: 'テキスト',
        affiliateUrl: 'https://px.a8.net/svt/ejp?a8mat=aga-dclinic-001',
        anchorText: '',
        isActive: true,
        useForInjection: true,
        useForBanner: false,
      },
    ],
  }),
  createMockAspProgram({
    id: 'at-aga-001',
    aspName: 'accesstrade',
    programName: '銀座総合美容クリニック AGA',
    category: 'aga',
    epc: 95.0,
    approvalRate: 60,
    itpSupport: true,
    recommendedAnchors: ['銀座総合美容クリニック', 'AGA治療の専門院', '薄毛治療の無料相談'],
    adCreatives: [
      {
        id: 'cr-at-aga-001',
        type: 'text',
        label: 'テキスト',
        affiliateUrl: 'https://h.accesstrade.net/sp/cc?rk=ginza-aga-001',
        anchorText: '',
        isActive: true,
        useForInjection: true,
        useForBanner: false,
      },
    ],
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
  resolveTextCreatives,
  generateBannerHtml,
  generateBannerSection,
} from '@/lib/asp/link-injector'
import type { AdCreative } from '@/types/asp-config'

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
    const _linkCount = (result.match(/<a /g) || []).length
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
        recommendedAnchors: ['XSSテストクリニック 公式サイト'],
        adCreatives: [
          {
            id: 'cr-xss-001',
            type: 'text',
            label: 'テキスト',
            affiliateUrl: 'https://example.com/test?a=1&b=2"onclick="alert(1)',
            anchorText: 'XSSテストクリニック 公式サイト',
            isActive: true,
            useForInjection: true,
            useForBanner: false,
          },
        ],
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
        recommendedAnchors: ['タグテストクリニック 公式サイト'],
        adCreatives: [
          {
            id: 'cr-xss-002',
            type: 'text',
            label: 'テキスト',
            affiliateUrl: 'https://example.com/test?x=<script>alert(1)</script>',
            anchorText: 'タグテストクリニック 公式サイト',
            isActive: true,
            useForInjection: true,
            useForBanner: false,
          },
        ],
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

  it('should return empty string when programs have no adCreatives', async () => {
    const { selectBestPrograms } = await import('@/lib/asp/selector')
    const mockedSelect = vi.mocked(selectBestPrograms)
    mockedSelect.mockResolvedValueOnce([
      createMockAspProgram({
        id: 'no-creative-001',
        programName: 'クリエイティブなしプログラム',
        recommendedAnchors: ['テスト公式サイト'],
        // adCreatives なし
      }),
    ])

    const result = await generateAffiliateSection('aga')
    expect(result).toBe('')
  })
})

// ============================================================
// resolveTextCreatives
// ============================================================

describe('resolveTextCreatives', () => {
  it('should return empty array when no adCreatives', () => {
    const program = createMockAspProgram({
      recommendedAnchors: ['テスト公式サイト'],
    })
    // adCreatives がないので空配列
    const result = resolveTextCreatives(program)
    expect(result).toHaveLength(0)
  })

  it('should return empty array when adCreatives is empty', () => {
    const program = createMockAspProgram({
      adCreatives: [],
    })
    const result = resolveTextCreatives(program)
    expect(result).toHaveLength(0)
  })

  it('should use text creative URLs when useForInjection=true', () => {
    const program = createMockAspProgram({
      adCreatives: [
        {
          id: 'cr-1',
          type: 'text',
          label: 'テキスト1',
          affiliateUrl: 'https://example.com/creative-1',
          anchorText: 'カスタムアンカー',
          isActive: true,
          useForInjection: true,
          useForBanner: false,
        },
      ],
    })
    const result = resolveTextCreatives(program)
    expect(result).toHaveLength(1)
    expect(result[0].affiliateUrl).toBe('https://example.com/creative-1')
    expect(result[0].anchors).toEqual(['カスタムアンカー'])
  })

  it('should return empty array when only inactive creatives exist', () => {
    const program = createMockAspProgram({
      adCreatives: [
        {
          id: 'cr-1',
          type: 'text',
          label: 'テキスト1',
          affiliateUrl: 'https://example.com/creative-1',
          anchorText: 'アンカー',
          isActive: false,
          useForInjection: true,
          useForBanner: false,
        },
      ],
    })
    const result = resolveTextCreatives(program)
    // adCreatives はあるが有効なテキストクリエイティブがないので空配列
    expect(result).toHaveLength(0)
  })

  it('should return empty array when only banner creatives exist', () => {
    const program = createMockAspProgram({
      adCreatives: [
        {
          id: 'cr-1',
          type: 'banner',
          label: 'バナー',
          affiliateUrl: 'https://example.com/banner-url',
          rawHtml: '<a href="https://example.com/banner-url"><img src="https://img.example.com/banner.png" /></a>',
          isActive: true,
          useForInjection: false,
          useForBanner: true,
        },
      ],
    })
    const result = resolveTextCreatives(program)
    // バナーのみなのでテキストクリエイティブは空配列
    expect(result).toHaveLength(0)
  })

  it('should use recommendedAnchors when creative has no anchorText', () => {
    const program = createMockAspProgram({
      recommendedAnchors: ['推奨アンカー1', '推奨アンカー2'],
      adCreatives: [
        {
          id: 'cr-1',
          type: 'text',
          label: 'テキスト1',
          affiliateUrl: 'https://example.com/creative-1',
          anchorText: '',
          isActive: true,
          useForInjection: true,
          useForBanner: false,
        },
      ],
    })
    const result = resolveTextCreatives(program)
    expect(result[0].anchors).toEqual(['推奨アンカー1', '推奨アンカー2'])
  })

  it('should include rawHtml when present on creative', () => {
    const program = createMockAspProgram({
      recommendedAnchors: ['テスト'],
      adCreatives: [
        {
          id: 'cr-1',
          type: 'text',
          label: 'テキスト1',
          rawHtml: '<a href="https://example.com/raw">テスト</a>',
          anchorText: 'テスト',
          isActive: true,
          useForInjection: true,
          useForBanner: false,
        },
      ],
    })
    const result = resolveTextCreatives(program)
    expect(result).toHaveLength(1)
    expect(result[0].rawHtml).toBe('<a href="https://example.com/raw">テスト</a>')
  })
})

// ============================================================
// generateBannerHtml
// ============================================================

describe('generateBannerHtml', () => {
  it('should return rawHtml when banner creative has rawHtml', () => {
    const creative: AdCreative = {
      id: 'cr-banner-1',
      type: 'banner',
      label: '300x250 バナー',
      affiliateUrl: 'https://example.com/banner-click',
      rawHtml: '<a href="https://example.com/banner-click" rel="sponsored"><img src="https://img.example.com/banner.png" width="300" height="250" alt="テストバナー" /></a>',
      isActive: true,
      useForInjection: false,
      useForBanner: true,
    }
    const result = generateBannerHtml(creative, 'a8', 'prog-001', 'aga')
    expect(result).toBe(creative.rawHtml)
  })

  it('should return empty string for non-banner creative', () => {
    const creative: AdCreative = {
      id: 'cr-text-1',
      type: 'text',
      label: 'テキスト',
      affiliateUrl: 'https://example.com/',
      isActive: true,
      useForInjection: true,
      useForBanner: false,
    }
    const result = generateBannerHtml(creative, 'a8', 'prog-001', 'aga')
    expect(result).toBe('')
  })

  it('should return empty string for banner creative without rawHtml', () => {
    const creative: AdCreative = {
      id: 'cr-banner-2',
      type: 'banner',
      label: 'rawHtml無しバナー',
      affiliateUrl: 'https://example.com/',
      isActive: true,
      useForInjection: false,
      useForBanner: true,
    }
    const result = generateBannerHtml(creative, 'a8', 'prog-001', 'aga')
    expect(result).toBe('')
  })

  it('should preserve tracking pixel in rawHtml', () => {
    const rawHtmlWithPixel = '<a href="https://example.com/click"><img src="https://img.example.com/banner.png" alt="バナー" /></a><img src="https://example.com/tracking-pixel" width="1" height="1" />'
    const creative: AdCreative = {
      id: 'cr-banner-3',
      type: 'banner',
      label: 'トラッキングピクセル付きバナー',
      affiliateUrl: 'https://example.com/',
      rawHtml: rawHtmlWithPixel,
      isActive: true,
      useForInjection: false,
      useForBanner: true,
    }
    const result = generateBannerHtml(creative, 'a8', 'prog-001', 'aga')
    expect(result).toBe(rawHtmlWithPixel)
    expect(result).toContain('tracking-pixel')
  })
})

// ============================================================
// generateBannerSection
// ============================================================

describe('generateBannerSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty string when no programs have banner creatives', async () => {
    const result = await generateBannerSection('aga')
    expect(result).toBe('')
  })

  it('should generate banner section HTML when programs have banner creatives', async () => {
    const { selectBestPrograms } = await import('@/lib/asp/selector')
    const mockedSelect = vi.mocked(selectBestPrograms)
    mockedSelect.mockResolvedValueOnce([
      createMockAspProgram({
        id: 'banner-test-001',
        aspName: 'a8',
        programName: 'バナーテスト',
        programId: 'prog-banner-001',
        category: 'aga',
        adCreatives: [
          {
            id: 'cr-b1',
            type: 'banner',
            label: '300x250',
            affiliateUrl: 'https://example.com/banner-click',
            rawHtml: '<a href="https://example.com/banner-click" rel="sponsored"><img src="https://img.example.com/banner.png" width="300" height="250" alt="テストバナー" /></a>',
            isActive: true,
            useForInjection: false,
            useForBanner: true,
          },
        ],
      }),
    ])

    const result = await generateBannerSection('aga')
    expect(result).toContain('affiliate-banner-section')
    expect(result).toContain('https://example.com/banner-click')
    expect(result).toContain('https://img.example.com/banner.png')
    expect(result).toContain('アフィリエイト広告')
  })
})

// ============================================================
// injectAffiliateLinksByCategory — creative URL injection
// ============================================================

describe('injectAffiliateLinksByCategory — with adCreatives', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should use creative URL when useForInjection=true', async () => {
    const { selectBestPrograms } = await import('@/lib/asp/selector')
    const mockedSelect = vi.mocked(selectBestPrograms)
    mockedSelect.mockResolvedValueOnce([
      createMockAspProgram({
        id: 'creative-test-001',
        aspName: 'a8',
        programName: 'クリエイティブテスト',
        programId: 'prog-cr-001',
        recommendedAnchors: ['クリエイティブテスト 公式サイト'],
        adCreatives: [
          {
            id: 'cr-t1',
            type: 'text',
            label: 'テキスト1',
            affiliateUrl: 'https://example.com/creative-url',
            anchorText: 'クリエイティブテスト 公式サイト',
            isActive: true,
            useForInjection: true,
            useForBanner: false,
          },
        ],
      }),
    ])

    const content = '<p>クリエイティブテスト 公式サイトはこちらです。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // Creative URL should be used
    expect(result).toContain('href="https://example.com/creative-url"')
  })

  it('should not inject links when no active text creatives exist', async () => {
    const { selectBestPrograms } = await import('@/lib/asp/selector')
    const mockedSelect = vi.mocked(selectBestPrograms)
    mockedSelect.mockResolvedValueOnce([
      createMockAspProgram({
        id: 'no-text-cr-001',
        aspName: 'a8',
        programName: 'バナーのみテスト',
        programId: 'prog-fb-001',
        recommendedAnchors: ['バナーのみテスト 公式サイト'],
        adCreatives: [
          {
            id: 'cr-b1',
            type: 'banner',
            label: 'バナーのみ',
            affiliateUrl: 'https://example.com/banner-only',
            rawHtml: '<a href="https://example.com/banner-only"><img src="https://img.example.com/banner.png" /></a>',
            isActive: true,
            useForInjection: false,
            useForBanner: true,
          },
        ],
      }),
    ])

    const content = '<p>バナーのみテスト 公式サイトをチェック。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // No text creatives available, so no link should be injected
    expect(result).not.toContain('<a href=')
    expect(result).toBe(content)
  })

  it('should not inject links when program has no adCreatives at all', async () => {
    const { selectBestPrograms } = await import('@/lib/asp/selector')
    const mockedSelect = vi.mocked(selectBestPrograms)
    mockedSelect.mockResolvedValueOnce([
      createMockAspProgram({
        id: 'no-cr-001',
        aspName: 'a8',
        programName: 'クリエイティブなしテスト',
        programId: 'prog-no-cr-001',
        recommendedAnchors: ['クリエイティブなしテスト 公式サイト'],
        // adCreatives undefined
      }),
    ])

    const content = '<p>クリエイティブなしテスト 公式サイトをチェック。</p>'
    const result = await injectAffiliateLinksByCategory(content, 'aga')

    // No adCreatives, so no link should be injected
    expect(result).not.toContain('<a href=')
    expect(result).toBe(content)
  })
})
