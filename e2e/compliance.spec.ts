/**
 * E2E コンプライアンステスト (P0優先度)
 *
 * 薬機法・景表法・ステマ規制の3軸で公開サイトを自動スキャン。
 * TODO: タスク#2 (Next.js セットアップ) 完了後にURL・セレクタを調整すること。
 */

import { test, expect } from '@playwright/test';

// 辞書からNGパターンを読み込み
import aGA from '../src/lib/compliance/dictionaries/aga.json';
import eD from '../src/lib/compliance/dictionaries/ed.json';
import hairRemoval from '../src/lib/compliance/dictionaries/hair-removal.json';
import skincare from '../src/lib/compliance/dictionaries/skincare.json';

const ALL_NG_TEXTS = [
  ...aGA.entries.map((e) => e.ng),
  ...eD.entries.map((e) => e.ng),
  ...hairRemoval.entries.map((e) => e.ng),
  ...skincare.entries.map((e) => e.ng),
];

// =============================================================================
// P0: 薬機法NG表現が公開記事に含まれないこと
// =============================================================================

test.describe('P0: 薬機法コンプライアンス — 公開サイトスキャン', () => {
  test('トップページにNG表現が含まれないこと', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent() ?? '';

    const found = ALL_NG_TEXTS.filter((ng) => bodyText.includes(ng));
    expect(found, `NG表現が検出されました: ${found.join(', ')}`).toHaveLength(0);
  });

  test('最新記事一覧から10件をスキャンしNG表現がないこと', async ({ page }) => {
    await page.goto('/articles');

    const articleLinks = await page.locator('a[href^="/articles/"]').all();
    const targets = articleLinks.slice(0, 10);

    for (const link of targets) {
      const href = await link.getAttribute('href');
      if (!href) continue;

      await page.goto(href);
      const articleText = await page.locator('article').textContent() ?? '';

      const found = ALL_NG_TEXTS.filter((ng) => articleText.includes(ng));
      expect(
        found,
        `記事 ${href} でNG表現が検出されました: ${found.join(', ')}`
      ).toHaveLength(0);
    }
  });
});

// =============================================================================
// P0: PR表記の確認 (ステマ規制対応)
// =============================================================================

test.describe('P0: ステマ規制 — PR表記確認', () => {
  // TODO: PR記事のURLを実際のコンテンツに合わせて更新
  const PR_ARTICLE_URLS = [
    '/articles/aga-clinic-comparison',
    '/articles/mens-skincare-ranking',
  ];

  for (const url of PR_ARTICLE_URLS) {
    test(`${url}: PR表記が記事冒頭に表示されること`, async ({ page }) => {
      await page.goto(url);

      const prDisclosure = page.locator('[data-testid="pr-disclosure"]');
      await expect(prDisclosure).toBeVisible();

      // 記事本文より上部に表示されることを確認
      const prBox = await prDisclosure.boundingBox();
      const articleBody = await page.locator('article').boundingBox();

      if (prBox && articleBody) {
        expect(prBox.y).toBeLessThan(articleBody.y + 200);
      }
    });
  }
});

// =============================================================================
// P0: アフィリリンクの属性確認 (rel="sponsored" + ITP対策)
// =============================================================================

test.describe('P0: アフィリリンク確認', () => {
  test('アフィリリンクにrel="sponsored"が設定されていること', async ({ page }) => {
    await page.goto('/articles/aga-clinic-comparison');

    const affiliateLinks = await page.locator('a[rel*="sponsored"]').all();
    expect(affiliateLinks.length).toBeGreaterThan(0);
  });

  test('target="_blank"のリンクにrel="noopener"が設定されていること', async ({ page }) => {
    await page.goto('/articles/aga-clinic-comparison');

    const blankLinks = await page.locator('a[target="_blank"]').all();
    for (const link of blankLinks) {
      const rel = await link.getAttribute('rel') ?? '';
      expect(rel).toContain('noopener');
    }
  });

  test('Safari: ITP環境でアフィリリンクにトラッキングパラメータが存在すること', async ({
    page,
    browserName,
  }) => {
    // Safariでのみ実行
    if (browserName !== 'webkit') return;

    await page.goto('/articles/aga-clinic-comparison');

    const affiliateLinks = await page.locator('a[rel*="sponsored"]').all();
    for (const link of affiliateLinks) {
      const href = await link.getAttribute('href') ?? '';
      // ITP対応: ファーストパーティパラメータの存在確認
      const hasTracking = /[?&](utm_|aff_|aid=|sid=|click_id=)/.test(href);
      expect(hasTracking).toBe(true);
    }
  });
});

// =============================================================================
// P1: コンバージョン導線 (カテゴリ → 記事 → CV)
// =============================================================================

test.describe('P1: コンバージョン導線', () => {
  test('AGAカテゴリ → 記事 → CVボタンが視認可能であること', async ({ page }) => {
    // 1. カテゴリページ
    await page.goto('/categories/aga');
    await expect(page.locator('h1')).toBeVisible();

    // 2. 記事選択
    await page.locator('article a').first().click();
    await page.waitForLoadState('networkidle');

    // 3. 記事内容確認
    await expect(page.locator('h1')).toBeVisible();

    // 4. CVボタン確認
    const cvButton = page.locator('[data-testid="cv-button"]').first();
    await expect(cvButton).toBeVisible();
    await expect(cvButton).toBeInViewport({ ratio: 0.5 });

    // 5. CVボタンのhref確認
    const href = await cvButton.getAttribute('href');
    expect(href).toMatch(/^https?:\/\//);
  });
});

// =============================================================================
// P1: 構造化データの出力確認 (SEO)
// =============================================================================

test.describe('P1: 構造化データ (SEO)', () => {
  test('記事ページにArticle/MedicalWebPage構造化データが出力されること', async ({ page }) => {
    await page.goto('/articles/aga-clinic-comparison');

    const jsonLdScripts = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      );
      return scripts.map((s) => {
        try {
          return JSON.parse(s.textContent || '{}');
        } catch {
          return {};
        }
      });
    });

    const articleSchema = jsonLdScripts.find(
      (s) => s['@type'] === 'Article' || s['@type'] === 'MedicalWebPage'
    );

    expect(articleSchema).toBeDefined();
    expect(articleSchema?.author).toBeTruthy();
    expect(articleSchema?.dateModified).toBeTruthy();
  });

  test('BreadcrumbListが出力されること', async ({ page }) => {
    await page.goto('/articles/aga-clinic-comparison');

    const jsonLdScripts = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      );
      return scripts.map((s) => {
        try {
          return JSON.parse(s.textContent || '{}');
        } catch {
          return {};
        }
      });
    });

    const breadcrumb = jsonLdScripts.find((s) => s['@type'] === 'BreadcrumbList');
    expect(breadcrumb).toBeDefined();
    expect(breadcrumb?.itemListElement?.length).toBeGreaterThanOrEqual(2);
  });
});
