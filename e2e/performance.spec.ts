/**
 * E2E パフォーマンステスト (Core Web Vitals)
 *
 * LCP / INP / CLS の閾値確認。
 * TODO: タスク#2 (Next.js セットアップ) 完了後に実行。
 */

import { test, expect } from '@playwright/test';

const CWV_THRESHOLDS = {
  lcp: 2000,   // ms  (目標: ≤2.0s)
  inp: 150,    // ms  (目標: ≤150ms ※FID後継)
  cls: 0.05,   //     (目標: ≤0.05)
  fcp: 1500,   // ms  (目標: ≤1.5s)
  ttfb: 500,   // ms  (目標: ≤500ms)
};

const TARGET_PAGES = [
  { url: '/', name: 'トップページ', lcpThreshold: 1800 },
  { url: '/categories/aga', name: 'AGAカテゴリ', lcpThreshold: 2000 },
  { url: '/articles/sample', name: '記事詳細', lcpThreshold: 2000 },
];

test.describe('Core Web Vitals', () => {
  for (const { url, name, lcpThreshold } of TARGET_PAGES) {
    test(`${name} (${url}): LCP・FCP・TTFBが基準内であること`, async ({ page }) => {
      const response = await page.goto(url);

      // TTFB確認
      const ttfb = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return nav.responseStart - nav.requestStart;
      });
      expect(ttfb, `TTFB: ${ttfb}ms > ${CWV_THRESHOLDS.ttfb}ms`).toBeLessThan(CWV_THRESHOLDS.ttfb);

      // FCP確認
      const fcp = await page.evaluate(() => {
        const entry = performance.getEntriesByName('first-contentful-paint')[0];
        return entry?.startTime ?? Infinity;
      });
      expect(fcp, `FCP: ${fcp}ms > ${CWV_THRESHOLDS.fcp}ms`).toBeLessThan(CWV_THRESHOLDS.fcp);

      // LCP確認 (3秒待機)
      const lcp = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let lcpValue = Infinity;
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              lcpValue = entries[entries.length - 1].startTime;
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            setTimeout(() => resolve(lcpValue), 3000);
          })
      );
      expect(lcp, `LCP: ${lcp}ms > ${lcpThreshold}ms`).toBeLessThan(lcpThreshold);
    });

    test(`${name} (${url}): CLSが基準内であること`, async ({ page }) => {
      await page.goto(url);

      // スクロールしてCLSを発生させる
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));

      const cls = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let clsScore = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                clsScore += (entry as PerformanceEntry & { value: number }).value;
              }
            }).observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => resolve(clsScore), 3000);
          })
      );
      expect(cls, `CLS: ${cls} > ${CWV_THRESHOLDS.cls}`).toBeLessThan(CWV_THRESHOLDS.cls);
    });
  }
});

// =============================================================================
// ISR / PPR 動作確認
// =============================================================================

test.describe('ISR / PPR 動作確認', () => {
  test('記事ページのCache-Controlヘッダーが正しく設定されていること', async ({ page }) => {
    const response = await page.goto('/articles/sample');

    const cacheControl = response?.headers()['cache-control'] ?? '';
    // Vercel Edge Cache: s-maxage + stale-while-revalidate
    expect(cacheControl).toMatch(/s-maxage=\d+/);
    expect(cacheControl).toMatch(/stale-while-revalidate/);
  });

  test('PPR: 静的シェルがTTFB基準内で返ること', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/articles/sample');
    await page.waitForSelector('h1');
    const elapsed = Date.now() - startTime;

    expect(elapsed, `初期描画: ${elapsed}ms > 2000ms`).toBeLessThan(2000);
  });
});
