/**
 * バナー広告自動最適配置モジュール Unit Tests
 * insertBannerAds / findH2Positions の動作を検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockAspProgram } from '@/test/helpers'
import type { AspProgram } from '@/types/asp-config'

// ============================================================
// モック定義
// ============================================================

const mockBannerPrograms: AspProgram[] = [
  createMockAspProgram({
    id: 'afb-aga-banner-001',
    aspName: 'afb',
    programName: 'AGAスキンクリニック',
    category: 'aga',
    epc: 85.5,
    adCreatives: [
      {
        id: 'banner-001',
        type: 'banner',
        label: 'バナー728x90',
        rawHtml: '<a href="https://example.com/aga"><img src="https://example.com/banner1.png" width="728" height="90" alt="AGA治療"></a>',
        isActive: true,
        useForInjection: false,
        useForBanner: true,
      },
    ],
  }),
  createMockAspProgram({
    id: 'a8-aga-banner-002',
    aspName: 'a8',
    programName: 'Dクリニック',
    category: 'aga',
    epc: 70.2,
    adCreatives: [
      {
        id: 'banner-002',
        type: 'banner',
        label: 'バナー300x250',
        rawHtml: '<a href="https://example.com/dclinic"><img src="https://example.com/banner2.png" width="300" height="250" alt="Dクリニック"></a>',
        isActive: true,
        useForInjection: false,
        useForBanner: true,
      },
    ],
  }),
]

vi.mock('../selector', () => ({
  selectBestPrograms: vi.fn().mockResolvedValue([]),
}))

import { selectBestPrograms } from '../selector'
const mockSelectBestPrograms = vi.mocked(selectBestPrograms)

import { insertBannerAds, findH2Positions } from '../banner-injector'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// ヘルパー
// ============================================================

/** h2を含む記事HTMLを生成 */
function generateArticleHtml(h2Count: number, paragraphsPerSection: number = 3): string {
  let html = '<h2 id="intro">はじめに</h2>\n'
  for (let p = 0; p < paragraphsPerSection; p++) {
    html += `<p>イントロダクションの段落${p + 1}です。AGA治療について詳しく解説します。</p>\n`
  }

  for (let i = 1; i < h2Count - 1; i++) {
    html += `<h2 id="section-${i}">セクション${i}の見出し</h2>\n`
    for (let p = 0; p < paragraphsPerSection; p++) {
      html += `<p>セクション${i}の段落${p + 1}です。治療方法について説明します。</p>\n`
    }
  }

  if (h2Count > 1) {
    html += '<h2 id="matome">まとめ</h2>\n'
    html += '<p>この記事では、AGA治療について解説しました。</p>\n'
  }

  return html
}

// ============================================================
// findH2Positions テスト
// ============================================================

describe('findH2Positions', () => {
  it('h2タグの位置とテキストを正しく検出する', () => {
    const html = '<h2>はじめに</h2><p>本文</p><h2>治療法</h2><p>内容</p>'
    const positions = findH2Positions(html)

    expect(positions).toHaveLength(2)
    expect(positions[0].text).toBe('はじめに')
    expect(positions[1].text).toBe('治療法')
  })

  it('まとめ/結論セクションを正しく検出する', () => {
    const html = '<h2>はじめに</h2><p>本文</p><h2>まとめ</h2><p>まとめ内容</p>'
    const positions = findH2Positions(html)

    expect(positions[0].isMatome).toBe(false)
    expect(positions[1].isMatome).toBe(true)
  })

  it('「結論」「おわりに」もまとめとして検出する', () => {
    const html1 = '<h2>結論</h2><p>内容</p>'
    const html2 = '<h2>おわりに</h2><p>内容</p>'

    expect(findH2Positions(html1)[0].isMatome).toBe(true)
    expect(findH2Positions(html2)[0].isMatome).toBe(true)
  })

  it('h2が無い場合は空配列を返す', () => {
    const html = '<p>本文のみ</p><h3>h3見出し</h3>'
    expect(findH2Positions(html)).toHaveLength(0)
  })

  it('h2内のHTMLタグを除去してテキストを取得する', () => {
    const html = '<h2><span class="heading">治療<strong>方法</strong></span></h2>'
    const positions = findH2Positions(html)
    expect(positions[0].text).toBe('治療方法')
  })
})

// ============================================================
// insertBannerAds テスト
// ============================================================

describe('insertBannerAds', () => {
  it('h2が3個未満の場合はバナーを挿入しない', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)
    const html = '<h2>はじめに</h2><p>本文</p><h2>まとめ</h2><p>終わり</p>'
    const result = await insertBannerAds(html, 'aga')
    expect(result).toBe(html)
  })

  it('バナークリエイティブが無い場合はバナーを挿入しない', async () => {
    mockSelectBestPrograms.mockResolvedValue([])
    const html = generateArticleHtml(5)
    const result = await insertBannerAds(html, 'aga')
    expect(result).toBe(html)
  })

  it('h2が3個以上の記事にバナーを挿入する', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)
    const html = generateArticleHtml(5)
    const result = await insertBannerAds(html, 'aga')

    expect(result).toContain('affiliate-inline-banner')
    expect(result).toContain('banner-disclosure')
    expect(result).toContain('role="complementary"')
    expect(result).toContain('aria-label="広告"')
  })

  it('まとめセクションの前にバナーを挿入する', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)
    const html = generateArticleHtml(5)
    const result = await insertBannerAds(html, 'aga')

    // まとめh2の前にバナーがある
    const matomeIndex = result.indexOf('id="matome"')
    const bannerBeforeMatome = result.lastIndexOf('affiliate-inline-banner', matomeIndex)
    expect(bannerBeforeMatome).toBeGreaterThan(-1)
    expect(bannerBeforeMatome).toBeLessThan(matomeIndex)
  })

  it('PR表記が各バナーに含まれる', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)
    const html = generateArticleHtml(5)
    const result = await insertBannerAds(html, 'aga')

    const bannerCount = (result.match(/banner-disclosure/g) || []).length
    expect(bannerCount).toBeGreaterThanOrEqual(1)
  })

  it('最大3つまでのバナーしか挿入しない', async () => {
    // 3つのバナープログラムを用意
    const threePrograms = [
      ...mockBannerPrograms,
      createMockAspProgram({
        id: 'third-banner',
        aspName: 'a8',
        programName: 'Third',
        category: 'aga',
        adCreatives: [{
          id: 'banner-003',
          type: 'banner',
          label: 'バナー3',
          rawHtml: '<a href="https://example.com/3"><img src="https://example.com/b3.png" width="728" height="90" alt="3"></a>',
          isActive: true,
          useForInjection: false,
          useForBanner: true,
        }],
      }),
    ]
    mockSelectBestPrograms.mockResolvedValue(threePrograms)

    // 大きな記事（h2が8個）
    const html = generateArticleHtml(8, 4)
    const result = await insertBannerAds(html, 'aga')

    const bannerCount = (result.match(/<aside class="affiliate-inline-banner/g) || []).length
    expect(bannerCount).toBeLessThanOrEqual(3)
  })

  it('比較テーブルの後にバナーを挿入する', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)

    const html = `
<h2>はじめに</h2>
<p>導入文です。</p>
<p>詳細です。</p>
<p>補足です。</p>
<h2>比較表</h2>
<table><thead><tr><th>クリニック</th><th>料金</th></tr></thead>
<tbody><tr><td>A</td><td>10,000円</td></tr></tbody></table>
<p>テーブルの後の説明です。</p>
<h2>治療の流れ</h2>
<p>治療フローの説明。</p>
<p>続きの説明。</p>
<p>もう少し説明。</p>
<h2>副作用</h2>
<p>副作用について。</p>
<p>注意事項。</p>
<p>まとめ的な内容。</p>
<h2>まとめ</h2>
<p>この記事のまとめです。</p>`

    const result = await insertBannerAds(html, 'aga')
    expect(result).toContain('affiliate-inline-banner')
  })

  it('configで最大バナー数を制限できる', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)
    const html = generateArticleHtml(8, 4)
    const result = await insertBannerAds(html, 'aga', { maxBanners: 1 })

    const bannerCount = (result.match(/<aside class="affiliate-inline-banner/g) || []).length
    expect(bannerCount).toBeLessThanOrEqual(1)
  })

  it('バナーHTMLにrawHtmlの内容が含まれる', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)
    const html = generateArticleHtml(5)
    const result = await insertBannerAds(html, 'aga')

    expect(result).toContain('banner1.png')
  })

  it('元のコンテンツ構造を壊さない', async () => {
    mockSelectBestPrograms.mockResolvedValue(mockBannerPrograms)
    const html = generateArticleHtml(5)
    const result = await insertBannerAds(html, 'aga')

    // 全てのh2が保持されている
    const originalH2Count = (html.match(/<h2/g) || []).length
    const resultH2Count = (result.match(/<h2/g) || []).length
    expect(resultH2Count).toBe(originalH2Count)
  })
})
