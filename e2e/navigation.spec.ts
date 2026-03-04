/**
 * E2E ナビゲーションテスト
 *
 * ヘッダーナビリンク・パンくずリスト・モバイルメニュー開閉を検証する。
 */

import { test, expect } from '@playwright/test';

// ヘッダーのメインナビゲーション項目 (Header.tsx NAV_ITEMS に対応)
const MAIN_NAV_ITEMS = [
  { label: 'AGA治療', href: '/articles?category=aga' },
  { label: 'ED治療', href: '/articles?category=ed' },
  { label: '医療脱毛', href: '/articles?category=hair-removal' },
  { label: 'スキンケア', href: '/articles?category=skincare' },
] as const;

// セカンダリナビ (Header.tsx SECONDARY_NAV)
const SECONDARY_NAV_ITEMS = [
  { label: '監修者紹介', href: '/supervisors' },
  { label: '運営情報', href: '/about' },
] as const;

test.describe('ヘッダーナビゲーション', () => {
  test('ヘッダーにメインナビリンクが正しいURLで存在すること', async ({ page }) => {
    await page.goto('/');

    const headerNav = page.locator('header nav[aria-label="メインナビゲーション"]');
    // デスクトップ表示でテスト
    await page.setViewportSize({ width: 1280, height: 800 });

    for (const { label, href } of MAIN_NAV_ITEMS) {
      const link = headerNav.locator(`a[href="${href}"]`);
      await expect(link, `ナビに「${label}」(${href}) のリンクが見つからない`).toBeVisible();

      const text = await link.textContent();
      expect(text?.trim()).toBe(label);
    }
  });

  test('ヘッダーにセカンダリナビリンクが正しいURLで存在すること', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1280, height: 800 });

    const headerNav = page.locator('header nav[aria-label="メインナビゲーション"]');

    for (const { label, href } of SECONDARY_NAV_ITEMS) {
      const link = headerNav.locator(`a[href="${href}"]`);
      await expect(link, `ナビに「${label}」(${href}) のリンクが見つからない`).toBeVisible();
    }
  });

  test('ロゴがトップページへのリンクであること', async ({ page }) => {
    await page.goto('/about');

    const logo = page.locator('header a[href="/"]');
    await expect(logo).toBeVisible();
  });
});

test.describe('モバイルメニュー', () => {
  test.beforeEach(async ({ page }) => {
    // モバイルビューポート
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('ハンバーガーボタンでモバイルメニューが開閉すること', async ({ page }) => {
    await page.goto('/');

    // ハンバーガーボタンを見つける
    const menuButton = page.locator('header button[aria-controls="mobile-menu"]');
    await expect(menuButton).toBeVisible();

    // 初期状態ではメニューは非表示 (aria-expanded=false)
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    // モバイルメニューはDOMに存在しない（条件付きレンダリング）
    const mobileMenu = page.locator('#mobile-menu');
    await expect(mobileMenu).toHaveCount(0);

    // メニューを開く
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(mobileMenu).toBeVisible();

    // メニューを閉じる
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await expect(mobileMenu).toHaveCount(0);
  });

  test('モバイルメニューにカテゴリリンクが含まれること', async ({ page }) => {
    await page.goto('/');

    const menuButton = page.locator('header button[aria-controls="mobile-menu"]');
    await menuButton.click();

    const mobileMenu = page.locator('#mobile-menu');
    await expect(mobileMenu).toBeVisible();

    for (const { label, href } of MAIN_NAV_ITEMS) {
      const link = mobileMenu.locator(`a[href="${href}"]`);
      await expect(link, `モバイルメニューに「${label}」が見つからない`).toBeVisible();
    }
  });

  test('モバイルメニューのリンクをクリックするとメニューが閉じること', async ({ page }) => {
    await page.goto('/');

    const menuButton = page.locator('header button[aria-controls="mobile-menu"]');
    await menuButton.click();

    const mobileMenu = page.locator('#mobile-menu');
    await expect(mobileMenu).toBeVisible();

    // 最初のリンクをクリック（ナビゲーション発生）
    const firstLink = mobileMenu.locator('a').first();
    await firstLink.click();

    // ページ遷移後、メニューは閉じているはず
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#mobile-menu')).toHaveCount(0);
  });
});

test.describe('パンくずリスト', () => {
  const PAGES_WITH_BREADCRUMB = [
    { url: '/about', label: 'メンズカタリについて' },
    { url: '/supervisors', label: '監修者紹介' },
  ] as const;

  for (const { url, label } of PAGES_WITH_BREADCRUMB) {
    test(`${label} (${url}): パンくずリストが表示されること`, async ({ page }) => {
      await page.goto(url);

      const breadcrumb = page.locator('nav[aria-label="パンくずリスト"]');
      await expect(breadcrumb).toBeVisible();
    });

    test(`${label} (${url}): パンくずの先頭に「ホーム」があること`, async ({ page }) => {
      await page.goto(url);

      const breadcrumb = page.locator('nav[aria-label="パンくずリスト"]');
      const homeLink = breadcrumb.locator('a[href="/"]');
      await expect(homeLink).toBeVisible();

      const text = await homeLink.textContent();
      expect(text?.trim()).toBe('ホーム');
    });

    test(`${label} (${url}): パンくずの最後にカレントページが表示されること`, async ({ page }) => {
      await page.goto(url);

      const breadcrumb = page.locator('nav[aria-label="パンくずリスト"]');
      const currentPage = breadcrumb.locator('[aria-current="page"]');
      await expect(currentPage).toBeVisible();
    });
  }
});
