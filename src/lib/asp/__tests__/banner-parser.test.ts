/**
 * バナーパーサー Unit Tests
 *
 * ASP発行HTMLからバナーサイズ・画像URL・アフィリエイトURLを
 * 正しくパースできることを網羅的に検証する。
 *
 * テスト対象:
 * - parseBannerHtml: メインパース関数
 * - enrichCreativeWithParsedSize: AdCreativeのサイズ補完
 * - isBannerSuitableFor: バナー配置適合性判定
 * - containsScriptTag: XSS検出
 * - isValidUrl: URLバリデーション
 * - isValidBannerSize: サイズバリデーション
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseBannerHtml,
  enrichCreativeWithParsedSize,
  isBannerSuitableFor,
  containsScriptTag,
  isValidUrl,
  isValidBannerSize,
} from '@/lib/asp/banner-parser'
import type { AdCreative } from '@/types/asp-config'

// ============================================================
// parseBannerHtml — ASP別バナーHTMLパース
// ============================================================

describe('parseBannerHtml', () => {
  // ── a) A8.net バナー ──────────────────────────────────────
  describe('A8.net バナー', () => {
    it('should parse A8.net banner with tracking pixel', () => {
      const html = '<a href="https://px.a8.net/svt/ejp?a8mat=XXXXX&a8ejpredirect=https%3A%2F%2Fexample.com"><img src="https://www24.a8.net/svt/bgt?aid=XXXXX&wid=001&eno=01&mid=XXXXX&mc=1" width="300" height="250" border="0" /></a><img src="https://www13.a8.net/0.gif?a8mat=XXXXX" width="1" height="1" border="0" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(300)
      expect(result!.height).toBe(250)
      expect(result!.imageUrl).toBe('https://www24.a8.net/svt/bgt?aid=XXXXX&wid=001&eno=01&mid=XXXXX&mc=1')
      expect(result!.affiliateUrl).toBe('https://px.a8.net/svt/ejp?a8mat=XXXXX&a8ejpredirect=https%3A%2F%2Fexample.com')
    })

    it('should parse A8.net 728x90 leaderboard banner', () => {
      const html = '<a href="https://px.a8.net/svt/ejp?a8mat=YYYYY"><img src="https://www24.a8.net/svt/bgt?aid=YYYYY&wid=001&eno=01&mid=YYYYY&mc=1" width="728" height="90" /></a><img src="https://www13.a8.net/0.gif?a8mat=YYYYY" width="1" height="1" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(728)
      expect(result!.height).toBe(90)
    })
  })

  // ── b) afb バナー ──────────────────────────────────────
  describe('afb バナー', () => {
    it('should parse afb banner HTML', () => {
      const html = '<a href="https://t.afi-b.com/visit.php?guid=ON&a=ZZZZZ&p=ZZZZZ"><img src="https://www.afi-b.com/upload/image/ZZZZZ.jpg" width="728" height="90" /></a>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(728)
      expect(result!.height).toBe(90)
      expect(result!.imageUrl).toBe('https://www.afi-b.com/upload/image/ZZZZZ.jpg')
      expect(result!.affiliateUrl).toBe('https://t.afi-b.com/visit.php?guid=ON&a=ZZZZZ&p=ZZZZZ')
    })

    it('should parse afb 300x250 rectangle banner', () => {
      const html = '<a href="https://t.afi-b.com/visit.php?guid=ON&a=AAAA"><img src="https://www.afi-b.com/upload/image/banner300x250.png" width="300" height="250" /></a>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(300)
      expect(result!.height).toBe(250)
    })
  })

  // ── c) AccessTrade バナー ──────────────────────────────────────
  describe('AccessTrade バナー', () => {
    it('should parse AccessTrade banner (img only)', () => {
      const html = '<img src="https://h.accesstrade.net/sp/cc?rk=BBBBB&src=banner" width="468" height="60" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(468)
      expect(result!.height).toBe(60)
      expect(result!.imageUrl).toBe('https://h.accesstrade.net/sp/cc?rk=BBBBB&src=banner')
      // aタグがないのでaffiliateUrlはnull
      expect(result!.affiliateUrl).toBeNull()
    })

    it('should parse AccessTrade banner with link wrapper', () => {
      const html = '<a href="https://h.accesstrade.net/sp/cc?rk=CCCCC"><img src="https://h.accesstrade.net/sp/cc?rk=CCCCC&src=banner" width="468" height="60" /></a>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(468)
      expect(result!.height).toBe(60)
      expect(result!.affiliateUrl).toBe('https://h.accesstrade.net/sp/cc?rk=CCCCC')
    })
  })

  // ── d) ValueCommerce iframe ──────────────────────────────────────
  describe('ValueCommerce iframe', () => {
    it('should parse ValueCommerce iframe banner', () => {
      const html = '<iframe src="https://ad.jp.ap.valuecommerce.com/servlet/htmlbanner?sid=DDDDD&pid=DDDDD" width="160" height="600" frameborder="0" scrolling="no"></iframe>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(160)
      expect(result!.height).toBe(600)
      // iframe の src はimageUrlとして取得
      expect(result!.imageUrl).toBe('https://ad.jp.ap.valuecommerce.com/servlet/htmlbanner?sid=DDDDD&pid=DDDDD')
    })

    it('should parse self-closing iframe', () => {
      const html = '<iframe src="https://ad.jp.ap.valuecommerce.com/servlet/htmlbanner?sid=EEEEE" width="300" height="250" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(300)
      expect(result!.height).toBe(250)
    })
  })

  // ── e) style属性指定 ──────────────────────────────────────
  describe('style属性指定', () => {
    it('should parse size from style attribute', () => {
      const html = '<img style="width: 336px; height: 280px;" src="https://example.com/banner336x280.png" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(336)
      expect(result!.height).toBe(280)
      expect(result!.imageUrl).toBe('https://example.com/banner336x280.png')
    })

    it('should parse style with no spaces around colon', () => {
      const html = '<img style="width:320px;height:100px;" src="https://example.com/banner.jpg" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(320)
      expect(result!.height).toBe(100)
    })

    it('should prefer width/height attributes over style', () => {
      const html = '<img width="300" height="250" style="width: 600px; height: 500px;" src="https://example.com/banner.png" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      // 属性のwidth/heightが優先される
      expect(result!.width).toBe(300)
      expect(result!.height).toBe(250)
    })
  })

  // ── f) トラッキングピクセル除外 ──────────────────────────────────────
  describe('トラッキングピクセル除外', () => {
    it('should exclude 1x1 tracking pixel and return main banner size', () => {
      const html = '<a href="https://px.a8.net/svt/ejp?a8mat=TEST"><img src="https://example.com/banner.png" width="300" height="250" /></a><img src="https://www13.a8.net/0.gif" width="1" height="1" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(300)
      expect(result!.height).toBe(250)
      // メインバナーの画像URLが取得されること
      expect(result!.imageUrl).toBe('https://example.com/banner.png')
    })

    it('should exclude 2x2 tracking pixel', () => {
      const html = '<img src="https://tracking.example.com/pixel" width="2" height="2" /><img src="https://example.com/banner.png" width="468" height="60" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.width).toBe(468)
      expect(result!.height).toBe(60)
    })

    it('should return null when only tracking pixel exists', () => {
      const html = '<img src="https://tracking.example.com/pixel" width="1" height="1" />'

      const result = parseBannerHtml(html)

      expect(result).toBeNull()
    })
  })

  // ── g) 空/不正HTML ──────────────────────────────────────
  describe('空/不正HTML', () => {
    it('should return null for null input', () => {
      expect(parseBannerHtml(null)).toBeNull()
    })

    it('should return null for undefined input', () => {
      expect(parseBannerHtml(undefined)).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(parseBannerHtml('')).toBeNull()
    })

    it('should return null for whitespace-only string', () => {
      expect(parseBannerHtml('   \n\t  ')).toBeNull()
    })

    it('should return null for plain text without tags', () => {
      expect(parseBannerHtml('これはバナーではありません')).toBeNull()
    })

    it('should return null for HTML without img or iframe', () => {
      expect(parseBannerHtml('<div><p>テキストのみ</p></div>')).toBeNull()
    })

    it('should return null for img without width/height', () => {
      expect(parseBannerHtml('<img src="https://example.com/img.png" />')).toBeNull()
    })
  })

  // ── h) imageUrl抽出 ──────────────────────────────────────
  describe('imageUrl抽出', () => {
    it('should extract imageUrl from src attribute', () => {
      const html = '<img src="https://cdn.example.com/banners/aga-300x250.png" width="300" height="250" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.imageUrl).toBe('https://cdn.example.com/banners/aga-300x250.png')
    })

    it('should extract imageUrl from img within a tag', () => {
      const html = '<a href="https://example.com/click"><img src="https://img.example.com/creative/banner.jpg" width="728" height="90" /></a>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.imageUrl).toBe('https://img.example.com/creative/banner.jpg')
    })

    it('should return null imageUrl for invalid src', () => {
      const html = '<img src="javascript:alert(1)" width="300" height="250" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.imageUrl).toBeNull()
    })

    it('should handle img with single-quoted src', () => {
      const html = "<img src='https://example.com/banner.png' width='300' height='250' />"

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.imageUrl).toBe('https://example.com/banner.png')
    })
  })

  // ── i) affiliateUrl抽出 ──────────────────────────────────────
  describe('affiliateUrl抽出', () => {
    it('should extract affiliateUrl from a tag href', () => {
      const html = '<a href="https://px.a8.net/svt/ejp?a8mat=TEST123"><img src="https://example.com/banner.png" width="300" height="250" /></a>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.affiliateUrl).toBe('https://px.a8.net/svt/ejp?a8mat=TEST123')
    })

    it('should return null affiliateUrl when no a tag exists', () => {
      const html = '<img src="https://example.com/banner.png" width="300" height="250" />'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.affiliateUrl).toBeNull()
    })

    it('should return null affiliateUrl for invalid href', () => {
      const html = '<a href="javascript:void(0)"><img src="https://example.com/banner.png" width="300" height="250" /></a>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.affiliateUrl).toBeNull()
    })

    it('should handle a tag with other attributes', () => {
      const html = '<a target="_blank" rel="noopener" href="https://t.afi-b.com/visit.php?a=12345"><img src="https://example.com/banner.png" width="300" height="250" /></a>'

      const result = parseBannerHtml(html)

      expect(result).not.toBeNull()
      expect(result!.affiliateUrl).toBe('https://t.afi-b.com/visit.php?a=12345')
    })
  })
})

// ============================================================
// enrichCreativeWithParsedSize
// ============================================================

describe('enrichCreativeWithParsedSize', () => {
  const baseCreative: AdCreative = {
    id: 'cr-test-001',
    type: 'banner',
    label: '300x250 バナー',
    isActive: true,
    useForInjection: false,
    useForBanner: true,
  }

  // ── j) rawHtml有りの場合にwidth/heightが補完されること ──
  it('should enrich creative with parsed width/height from rawHtml', () => {
    const creative: AdCreative = {
      ...baseCreative,
      rawHtml: '<a href="https://px.a8.net/svt/ejp?a8mat=TEST"><img src="https://example.com/banner.png" width="300" height="250" /></a>',
    }

    const result = enrichCreativeWithParsedSize(creative)

    expect(result.width).toBe(300)
    expect(result.height).toBe(250)
    expect(result.imageUrl).toBe('https://example.com/banner.png')
    expect(result.affiliateUrl).toBe('https://px.a8.net/svt/ejp?a8mat=TEST')
  })

  it('should not mutate original creative object', () => {
    const creative: AdCreative = {
      ...baseCreative,
      rawHtml: '<img src="https://example.com/banner.png" width="728" height="90" />',
    }

    const result = enrichCreativeWithParsedSize(creative)

    expect(result).not.toBe(creative)
    expect(creative.width).toBeUndefined()
    expect(creative.height).toBeUndefined()
  })

  // ── k) 既にwidth/height設定済みの場合はスキップ ──
  it('should skip parsing when width and height are already set', () => {
    const creative: AdCreative = {
      ...baseCreative,
      width: 160,
      height: 600,
      rawHtml: '<img src="https://example.com/banner.png" width="300" height="250" />',
    }

    const result = enrichCreativeWithParsedSize(creative)

    // 既存の値が保持されること
    expect(result.width).toBe(160)
    expect(result.height).toBe(600)
    expect(result).toBe(creative) // 同じオブジェクトが返される
  })

  it('should return creative as-is when rawHtml is missing', () => {
    const creative: AdCreative = {
      ...baseCreative,
    }

    const result = enrichCreativeWithParsedSize(creative)

    expect(result).toBe(creative)
    expect(result.width).toBeUndefined()
    expect(result.height).toBeUndefined()
  })

  it('should return creative as-is when type is text', () => {
    const creative: AdCreative = {
      ...baseCreative,
      type: 'text',
      rawHtml: '<a href="https://example.com/click">テスト</a>',
    }

    const result = enrichCreativeWithParsedSize(creative)

    expect(result).toBe(creative)
    expect(result.width).toBeUndefined()
  })

  it('should return creative as-is when rawHtml has no parseable size', () => {
    const creative: AdCreative = {
      ...baseCreative,
      rawHtml: '<img src="https://example.com/banner.png" />',
    }

    const result = enrichCreativeWithParsedSize(creative)

    expect(result).toBe(creative)
    expect(result.width).toBeUndefined()
  })

  it('should preserve existing affiliateUrl when rawHtml has no href', () => {
    const creative: AdCreative = {
      ...baseCreative,
      affiliateUrl: 'https://existing-url.example.com/click',
      rawHtml: '<img src="https://example.com/banner.png" width="300" height="250" />',
    }

    const result = enrichCreativeWithParsedSize(creative)

    expect(result.width).toBe(300)
    expect(result.height).toBe(250)
    expect(result.affiliateUrl).toBe('https://existing-url.example.com/click')
  })
})

// ============================================================
// containsScriptTag — XSS検出
// ============================================================

describe('containsScriptTag', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('should detect <script> tag', () => {
    expect(containsScriptTag('<script>alert("XSS")</script>')).toBe(true)
  })

  it('should detect <SCRIPT> tag (case insensitive)', () => {
    expect(containsScriptTag('<SCRIPT>alert("XSS")</SCRIPT>')).toBe(true)
  })

  it('should detect <script type="text/javascript">', () => {
    expect(containsScriptTag('<script type="text/javascript">alert(1)</script>')).toBe(true)
  })

  it('should not false-positive on text containing "script"', () => {
    expect(containsScriptTag('<img src="https://example.com/description.png" width="300" height="250" />')).toBe(false)
  })

  it('should return false for normal banner HTML', () => {
    expect(containsScriptTag('<a href="https://example.com"><img src="https://img.example.com/banner.png" width="300" height="250" /></a>')).toBe(false)
  })

  it('should log warning when script is detected', () => {
    containsScriptTag('<script>alert(1)</script>')
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('XSS')
    )
  })

  it('should return null from parseBannerHtml when script is present', () => {
    const html = '<script>alert("XSS")</script><img src="https://example.com/banner.png" width="300" height="250" />'
    expect(parseBannerHtml(html)).toBeNull()
  })
})

// ============================================================
// isValidUrl — URLバリデーション
// ============================================================

describe('isValidUrl', () => {
  it('should accept https URL', () => {
    expect(isValidUrl('https://example.com/page')).toBe(true)
  })

  it('should accept http URL', () => {
    expect(isValidUrl('http://example.com/page')).toBe(true)
  })

  it('should reject javascript: protocol', () => {
    expect(isValidUrl('javascript:alert(1)')).toBe(false)
  })

  it('should reject data: protocol', () => {
    expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('should reject vbscript: protocol', () => {
    expect(isValidUrl('vbscript:msgbox("XSS")')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidUrl('')).toBe(false)
  })

  it('should reject whitespace-only string', () => {
    expect(isValidUrl('   ')).toBe(false)
  })

  it('should reject invalid URL format', () => {
    expect(isValidUrl('not-a-url')).toBe(false)
  })

  it('should accept URL with query parameters', () => {
    expect(isValidUrl('https://px.a8.net/svt/ejp?a8mat=XXXXX&a8ejpredirect=https%3A%2F%2Fexample.com')).toBe(true)
  })

  it('should accept URL with path and fragment', () => {
    expect(isValidUrl('https://example.com/path/to/page#section')).toBe(true)
  })
})

// ============================================================
// isValidBannerSize — サイズバリデーション
// ============================================================

describe('isValidBannerSize', () => {
  it('should accept standard 300x250', () => {
    expect(isValidBannerSize(300, 250)).toBe(true)
  })

  it('should accept standard 728x90', () => {
    expect(isValidBannerSize(728, 90)).toBe(true)
  })

  it('should accept standard 160x600', () => {
    expect(isValidBannerSize(160, 600)).toBe(true)
  })

  it('should accept max boundary 2000x2000', () => {
    expect(isValidBannerSize(2000, 2000)).toBe(true)
  })

  it('should reject width > 2000', () => {
    expect(isValidBannerSize(2001, 250)).toBe(false)
  })

  it('should reject height > 2000', () => {
    expect(isValidBannerSize(300, 2001)).toBe(false)
  })

  it('should reject both > 2000', () => {
    expect(isValidBannerSize(3000, 5000)).toBe(false)
  })

  it('should reject width = 0', () => {
    expect(isValidBannerSize(0, 250)).toBe(false)
  })

  it('should reject height = 0', () => {
    expect(isValidBannerSize(300, 0)).toBe(false)
  })

  it('should reject negative width', () => {
    expect(isValidBannerSize(-300, 250)).toBe(false)
  })

  it('should reject negative height', () => {
    expect(isValidBannerSize(300, -250)).toBe(false)
  })

  it('should return null from parseBannerHtml for oversized banner', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const html = '<img src="https://example.com/huge.png" width="5000" height="3000" />'
    expect(parseBannerHtml(html)).toBeNull()
  })
})

// ============================================================
// isBannerSuitableFor — バナー配置適合性
// ============================================================

describe('isBannerSuitableFor', () => {
  describe('300x250 (Medium Rectangle)', () => {
    it('should be suitable for sidebar', () => {
      expect(isBannerSuitableFor(300, 250, 'sidebar')).toBe(true)
    })

    it('should be suitable for inline', () => {
      expect(isBannerSuitableFor(300, 250, 'inline')).toBe(true)
    })
  })

  describe('728x90 (Leaderboard)', () => {
    it('should NOT be suitable for sidebar', () => {
      expect(isBannerSuitableFor(728, 90, 'sidebar')).toBe(false)
    })

    it('should be suitable for inline', () => {
      expect(isBannerSuitableFor(728, 90, 'inline')).toBe(true)
    })
  })

  describe('160x600 (Wide Skyscraper)', () => {
    it('should be suitable for sidebar', () => {
      expect(isBannerSuitableFor(160, 600, 'sidebar')).toBe(true)
    })

    it('should NOT be suitable for inline', () => {
      expect(isBannerSuitableFor(160, 600, 'inline')).toBe(false)
    })
  })

  describe('320x100 (Large Mobile Banner)', () => {
    it('should NOT be suitable for sidebar (width > 320 threshold for ratio)', () => {
      // 320x100: ratio = 3.2, which is > 1.5, so not suitable for sidebar
      expect(isBannerSuitableFor(320, 100, 'sidebar')).toBe(false)
    })

    it('should be suitable for inline', () => {
      expect(isBannerSuitableFor(320, 100, 'inline')).toBe(true)
    })
  })

  describe('468x60 (Full Banner)', () => {
    it('should NOT be suitable for sidebar', () => {
      expect(isBannerSuitableFor(468, 60, 'sidebar')).toBe(false)
    })

    it('should be suitable for inline', () => {
      expect(isBannerSuitableFor(468, 60, 'inline')).toBe(true)
    })
  })

  describe('120x600 (Skyscraper)', () => {
    it('should be suitable for sidebar', () => {
      expect(isBannerSuitableFor(120, 600, 'sidebar')).toBe(true)
    })

    it('should NOT be suitable for inline', () => {
      expect(isBannerSuitableFor(120, 600, 'inline')).toBe(false)
    })
  })

  describe('970x250 (Billboard)', () => {
    it('should NOT be suitable for sidebar', () => {
      expect(isBannerSuitableFor(970, 250, 'sidebar')).toBe(false)
    })

    it('should be suitable for inline', () => {
      expect(isBannerSuitableFor(970, 250, 'inline')).toBe(true)
    })
  })
})

// ============================================================
// エッジケース / 堅牢性
// ============================================================

describe('堅牢性テスト', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('should handle HTML with multiple main images (use first)', () => {
    const html = '<img src="https://example.com/first.png" width="300" height="250" /><img src="https://example.com/second.png" width="728" height="90" />'

    const result = parseBannerHtml(html)

    expect(result).not.toBeNull()
    expect(result!.width).toBe(300)
    expect(result!.height).toBe(250)
    expect(result!.imageUrl).toBe('https://example.com/first.png')
  })

  it('should handle attributes without quotes', () => {
    const html = '<img src=https://example.com/banner.png width=300 height=250 />'

    const result = parseBannerHtml(html)

    expect(result).not.toBeNull()
    expect(result!.width).toBe(300)
    expect(result!.height).toBe(250)
  })

  it('should handle mixed case attribute names', () => {
    const html = '<img SRC="https://example.com/banner.png" Width="300" HEIGHT="250" />'

    const result = parseBannerHtml(html)

    expect(result).not.toBeNull()
    expect(result!.width).toBe(300)
    expect(result!.height).toBe(250)
  })

  it('should handle img tag with extra whitespace', () => {
    const html = '<img   src="https://example.com/banner.png"   width="300"   height="250"   />'

    const result = parseBannerHtml(html)

    expect(result).not.toBeNull()
    expect(result!.width).toBe(300)
    expect(result!.height).toBe(250)
  })

  it('should log warning for oversized dimensions', () => {
    const html = '<img src="https://example.com/huge.png" width="5000" height="3000" />'
    parseBannerHtml(html)

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('異常サイズ')
    )
  })

  it('should log warning for invalid image URL', () => {
    const html = '<img src="data:image/png;base64,AAAA" width="300" height="250" />'
    const result = parseBannerHtml(html)

    expect(result).not.toBeNull()
    expect(result!.imageUrl).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('不正な画像URL')
    )
  })

  it('should log warning for invalid affiliate URL', () => {
    const html = '<a href="javascript:void(0)"><img src="https://example.com/banner.png" width="300" height="250" /></a>'
    const result = parseBannerHtml(html)

    expect(result).not.toBeNull()
    expect(result!.affiliateUrl).toBeNull()
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('不正なアフィリエイトURL')
    )
  })

  it('should handle only width attribute without height', () => {
    const html = '<img src="https://example.com/banner.png" width="300" />'
    expect(parseBannerHtml(html)).toBeNull()
  })

  it('should handle only height attribute without width', () => {
    const html = '<img src="https://example.com/banner.png" height="250" />'
    expect(parseBannerHtml(html)).toBeNull()
  })
})
