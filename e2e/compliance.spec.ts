/**
 * E2E コンプライアンステスト (P0優先度)
 *
 * 薬機法・景表法・ステマ規制の3軸で公開サイトを自動スキャン。
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

  test('記事一覧ページにNG表現が含まれないこと', async ({ page }) => {
    await page.goto('/articles');
    const bodyText = await page.locator('body').textContent() ?? '';

    const found = ALL_NG_TEXTS.filter((ng) => bodyText.includes(ng));
    expect(found, `NG表現が検出されました: ${found.join(', ')}`).toHaveLength(0);
  });

  test('記事詳細ページをスキャンしNG表現がないこと', async ({ page }) => {
    // まずリンク先URLを収集
    await page.goto('/articles');
    const hrefs = await page.locator('a[href^="/articles/"]').evaluateAll(
      (links) => links.map((a) => a.getAttribute('href')).filter(Boolean)
    );
    const uniqueHrefs = [...new Set(hrefs)].slice(0, 6);

    for (const href of uniqueHrefs) {
      await page.goto(href!);
      const bodyText = await page.locator('body').textContent() ?? '';

      const found = ALL_NG_TEXTS.filter((ng) => bodyText.includes(ng));
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
  const PR_ARTICLE_URLS = [
    '/articles/aga-treatment-guide',
    '/articles/mens-skincare-basics',
  ];

  for (const url of PR_ARTICLE_URLS) {
    test(`${url}: PR表記が記事ページに表示されること`, async ({ page }) => {
      await page.goto(url);

      const prDisclosure = page.locator('[data-testid="pr-disclosure"]');
      await expect(prDisclosure).toBeVisible();
    });
  }
});

// =============================================================================
// P0: アフィリリンクの属性確認
// =============================================================================

test.describe('P0: アフィリリンク確認', () => {
  test('target="_blank"のリンクにrel="noopener"が設定されていること', async ({ page }) => {
    await page.goto('/articles/aga-treatment-guide');

    const blankLinks = await page.locator('a[target="_blank"]').all();
    for (const link of blankLinks) {
      const rel = await link.getAttribute('rel') ?? '';
      expect(rel).toContain('noopener');
    }
  });
});
