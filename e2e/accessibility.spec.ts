/**
 * E2E アクセシビリティテスト (WCAG 2.1 AA)
 */

import { test, expect } from '@playwright/test';

const TARGET_PAGES = [
  { url: '/', name: 'トップページ' },
  { url: '/articles', name: '記事一覧' },
  { url: '/articles/aga-treatment-guide', name: '記事詳細' },
];

test.describe('アクセシビリティ (WCAG 2.1 AA)', () => {
  for (const { url, name } of TARGET_PAGES) {
    test(`${name} (${url}): 画像にalt属性が設定されていること`, async ({ page }) => {
      await page.goto(url);

      const images = await page.locator('img:not([role="presentation"])').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        // alt="" は装飾画像として許容、null は違反
        expect(alt, 'alt属性がnullの画像が存在します').not.toBeNull();
      }
    });

    test(`${name} (${url}): h1が1つだけ存在すること`, async ({ page }) => {
      await page.goto(url);
      const h1Count = await page.locator('h1').count();
      expect(h1Count).toBe(1);
    });

    test(`${name} (${url}): フォーカス時にアウトラインが表示されること`, async ({ page }) => {
      await page.goto(url);

      await page.keyboard.press('Tab');

      const focusedElement = page.locator(':focus');
      const count = await focusedElement.count();
      if (count === 0) return; // フォーカス可能要素がない場合はスキップ

      const outlineStyle = await focusedElement.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          outline: style.outline,
          outlineWidth: style.outlineWidth,
          boxShadow: style.boxShadow,
        };
      });

      const hasFocusIndicator =
        (outlineStyle.outline !== 'none' && outlineStyle.outlineWidth !== '0px') ||
        outlineStyle.boxShadow !== 'none';

      expect(hasFocusIndicator).toBe(true);
    });
  }

  test('記事ページ: 見出し階層が正しいこと (h1→h2→h3)', async ({ page }) => {
    await page.goto('/articles/aga-treatment-guide');

    const headings = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return els.map((el) => parseInt(el.tagName[1]));
    });

    // 見出しレベルが2以上スキップしていないこと
    for (let i = 1; i < headings.length; i++) {
      const diff = headings[i] - headings[i - 1];
      expect(diff, `見出しレベルが ${headings[i - 1]} から ${headings[i]} に飛んでいます`).toBeLessThanOrEqual(1);
    }
  });
});
