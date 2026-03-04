/**
 * E2E 法的ページテスト
 *
 * /privacy, /disclaimer, /contact, /advertising-policy の
 * 存在確認・h1タグ・フッターリンクを検証する。
 */

import { test, expect } from '@playwright/test';

const LEGAL_PAGES = [
  { url: '/privacy', name: 'プライバシーポリシー' },
  { url: '/disclaimer', name: '免責事項' },
  { url: '/contact', name: 'お問い合わせ' },
  { url: '/advertising-policy', name: '広告掲載ポリシー' },
] as const;

test.describe('法的ページの存在確認', () => {
  for (const { url, name } of LEGAL_PAGES) {
    test(`${name} (${url}): ステータス200を返すこと`, async ({ page }) => {
      const response = await page.goto(url);
      expect(response?.status(), `${url} が200を返さなかった`).toBe(200);
    });

    test(`${name} (${url}): h1タグが存在すること`, async ({ page }) => {
      await page.goto(url);
      const h1Count = await page.locator('h1').count();
      expect(h1Count, `${url} に h1 が存在しない`).toBeGreaterThanOrEqual(1);
    });
  }
});

test.describe('フッターから法的ページへのリンク', () => {
  test('フッターにプライバシーポリシーへのリンクがあること', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const link = footer.locator('a[href="/privacy"]');
    await expect(link).toBeVisible();
  });

  test('フッターに免責事項へのリンクがあること', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const link = footer.locator('a[href="/disclaimer"]');
    await expect(link).toBeVisible();
  });

  test('フッターにお問い合わせへのリンクがあること', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const link = footer.locator('a[href="/contact"]');
    await expect(link).toBeVisible();
  });

  test('フッターに広告掲載ポリシーへのリンクがあること', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    const link = footer.locator('a[href="/advertising-policy"]');
    await expect(link).toBeVisible();
  });

  test('フッターの法的リンクがすべて正しいhrefを持つこと', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');

    for (const { url } of LEGAL_PAGES) {
      const link = footer.locator(`a[href="${url}"]`);
      const count = await link.count();
      expect(count, `フッターに ${url} へのリンクが見つからない`).toBeGreaterThanOrEqual(1);
    }
  });
});
