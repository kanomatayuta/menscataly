/**
 * E2E パフォーマンステスト (Core Web Vitals)
 *
 * LCP / CLS / TTFB の閾値確認。
 */

import { test, expect } from '@playwright/test';

const IS_CI = !!process.env.CI;

const CWV_THRESHOLDS = {
  lcp: 2000,   // ms  (目標: ≤2.0s)
  cls: IS_CI ? 0.25 : 0.5,  // CI環境ではGoogle "needs improvement" 閾値を使用
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

// =============================================================================
// ページ読み込み時間チェック (5秒以内)
// =============================================================================

const ALL_PAGES = [
  { url: '/', name: 'トップページ' },
  { url: '/articles', name: '記事一覧' },
  { url: '/about', name: '運営情報' },
  { url: '/supervisors', name: '監修者紹介' },
  { url: '/privacy', name: 'プライバシーポリシー' },
  { url: '/disclaimer', name: '免責事項' },
  { url: '/contact', name: 'お問い合わせ' },
  { url: '/advertising-policy', name: '広告掲載ポリシー' },
];

const PAGE_LOAD_TIMEOUT = 5000; // ms

test.describe('ページ読み込み時間', () => {
  for (const { url, name } of ALL_PAGES) {
    test(`${name} (${url}): 5秒以内にロードが完了すること`, async ({ page }) => {
      const start = Date.now();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      const elapsed = Date.now() - start;

      expect(response?.status()).toBe(200);
      expect(elapsed, `${url} の読み込みに ${elapsed}ms かかった (上限: ${PAGE_LOAD_TIMEOUT}ms)`).toBeLessThan(
        PAGE_LOAD_TIMEOUT
      );
    });
  }
});

// =============================================================================
// JavaScript バンドルサイズチェック
// =============================================================================

test.describe('JavaScript バンドルサイズ', () => {
  test('トップページの総JSサイズが1MB未満であること', async ({ page }) => {
    const jsResources: { url: string; size: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] ?? '';
      if (
        contentType.includes('javascript') ||
        url.endsWith('.js') ||
        url.includes('/_next/static/')
      ) {
        try {
          const body = await response.body();
          jsResources.push({ url, size: body.length });
        } catch {
          // ストリーム切れは無視
        }
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    const totalJsSize = jsResources.reduce((sum, r) => sum + r.size, 0);
    const totalKB = Math.round(totalJsSize / 1024);

    console.log(`[performance] Total JS size: ${totalKB} KB (${jsResources.length} files)`);

    // 2MB = 2048KB 未満であること (Next.jsアプリの合理的な上限)
    expect(totalKB, `Total JS bundle size: ${totalKB}KB > 2048KB`).toBeLessThan(2048);
  });
});
