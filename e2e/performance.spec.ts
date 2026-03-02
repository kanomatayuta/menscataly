/**
 * E2E パフォーマンステスト (Core Web Vitals)
 *
 * LCP / CLS / TTFB の閾値確認。
 */

import { test, expect } from '@playwright/test';

const IS_CI = !!process.env.CI;

const CWV_THRESHOLDS = {
  lcp: 2000,   // ms  (目標: ≤2.0s)
  cls: IS_CI ? 0.05 : 0.5,  // dev環境ではフォント/Suspenseによるシフトを許容
  fcp: 1500,   // ms  (目標: ≤1.5s)
  ttfb: IS_CI ? 500 : 1000,  // dev環境ではTurbopackコンパイルを考慮
};

const TARGET_PAGES = [
  { url: '/', name: 'トップページ' },
  { url: '/articles', name: '記事一覧' },
  { url: '/articles/aga-treatment-guide', name: '記事詳細' },
];

test.describe('Core Web Vitals', () => {
  for (const { url, name } of TARGET_PAGES) {
    test(`${name} (${url}): ページが正常にロードされること`, async ({ page }) => {
      const response = await page.goto(url);
      expect(response?.status()).toBe(200);
    });

    test(`${name} (${url}): TTFB・FCPが基準内であること`, async ({ page }) => {
      await page.goto(url);

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
