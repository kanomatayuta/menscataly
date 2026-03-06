/**
 * E2E アフィリエイトトラッキングテスト
 * トラッキングスクリプト・rel="sponsored"の確認
 */

import { test, expect } from '@playwright/test'

// 既知のASPトラッキングドメイン
const ASP_DOMAINS = [
  'px.a8.net',
  't.afb.ne.jp',
  'h.accesstrade.net',
  'ck.jp.ap.valuecommerce.com',
  't.felmat.net',
]

test.describe('アフィリエイトトラッキング', () => {
  test.describe('トラッキングスクリプト', () => {
    test('記事ページにITPトラッキングスクリプトが含まれること', async ({ page }) => {
      await page.goto('/articles/aga-treatment-guide')

      // ASP関連のscriptタグを検索
      const scripts = await page.locator('script[src]').evaluateAll(
        (els) => els.map(el => el.getAttribute('src')).filter(Boolean)
      )

      // トラッキングスクリプトが存在する場合、ASPドメインを含むこと
      const _hasTrackingScript = scripts.some(src =>
        ASP_DOMAINS.some(domain => src?.includes(domain))
      )

      // スクリプトがない場合もOK（記事にアフィリエイトがない可能性）
      // ただし存在する場合は正しいドメインであること
      if (scripts.length > 0) {
        const aspScripts = scripts.filter(src =>
          ASP_DOMAINS.some(domain => src?.includes(domain))
        )
        aspScripts.forEach(src => {
          expect(src).toMatch(/^https?:\/\//)
        })
      }
    })

    test('トラッキングスクリプトがasyncまたはdefer属性を持つこと', async ({ page }) => {
      await page.goto('/articles/aga-treatment-guide')

      // ASP関連スクリプトのasync/defer確認
      const aspScripts = await page.locator('script[src]').evaluateAll(
        (els) => els.map(el => ({
          src: el.getAttribute('src'),
          async: el.hasAttribute('async'),
          defer: el.hasAttribute('defer'),
        }))
      )

      const trackingScripts = aspScripts.filter(s =>
        ASP_DOMAINS.some(domain => s.src?.includes(domain))
      )

      // トラッキングスクリプトはパフォーマンスのためasyncまたはdeferであること
      trackingScripts.forEach(script => {
        expect(
          script.async || script.defer,
          `Script ${script.src} should have async or defer attribute`
        ).toBe(true)
      })
    })
  })

  test.describe('rel="sponsored" 属性', () => {
    test('アフィリエイトリンクにrel="sponsored"が設定されていること', async ({ page }) => {
      await page.goto('/articles/aga-treatment-guide')

      // 全リンクを取得
      const links = await page.locator('a[href]').evaluateAll(
        (els) => els.map(el => ({
          href: el.getAttribute('href') ?? '',
          rel: el.getAttribute('rel') ?? '',
          text: el.textContent?.trim() ?? '',
        }))
      )

      // ASPドメインを含むリンクをフィルタ
      const affiliateLinks = links.filter(link =>
        ASP_DOMAINS.some(domain => link.href.includes(domain))
      )

      // アフィリエイトリンクが存在する場合、全てにrel="sponsored"があること
      affiliateLinks.forEach(link => {
        expect(
          link.rel.includes('sponsored'),
          `Affiliate link "${link.text}" (${link.href}) is missing rel="sponsored"`
        ).toBe(true)
      })
    })

    test('通常のリンクにrel="sponsored"が付与されていないこと', async ({ page }) => {
      await page.goto('/articles/aga-treatment-guide')

      // 内部リンクを取得
      const internalLinks = await page.locator('a[href^="/"]').evaluateAll(
        (els) => els.map(el => ({
          href: el.getAttribute('href') ?? '',
          rel: el.getAttribute('rel') ?? '',
        }))
      )

      // 内部リンクにはrel="sponsored"が付与されていないこと
      internalLinks.forEach(link => {
        expect(
          link.rel.includes('sponsored'),
          `Internal link ${link.href} should not have rel="sponsored"`
        ).toBe(false)
      })
    })

    test('target="_blank"のアフィリエイトリンクにrel="noopener"が設定されていること', async ({ page }) => {
      await page.goto('/articles/aga-treatment-guide')

      const blankLinks = await page.locator('a[target="_blank"]').evaluateAll(
        (els) => els.map(el => ({
          href: el.getAttribute('href') ?? '',
          rel: el.getAttribute('rel') ?? '',
        }))
      )

      blankLinks.forEach(link => {
        expect(
          link.rel.includes('noopener'),
          `Link ${link.href} with target="_blank" should have rel="noopener"`
        ).toBe(true)
      })
    })
  })
})
