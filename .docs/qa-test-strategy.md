# MENS CATALY — QA テスト戦略 v1.0

**作成日**: 2026年3月2日
**担当**: QA Agent
**ステータス**: タスク#2・#4完了待ち (実装準備中)

---

## 1. テスト全体方針

### 1.1 テストピラミッド

```
         E2E (Playwright)
        ─────────────────
       Integration Tests
      ─────────────────────
     Unit Tests (Vitest) ← 主力
    ─────────────────────────
```

| レイヤー | ツール | カバレッジ目標 | 用途 |
|---------|--------|-------------|------|
| Unit | Vitest | 80%以上 | コンポーネント・ユーティリティ・薬機法チェッカー |
| Integration | Vitest | 60%以上 | API連携・microCMS・Supabase |
| E2E | Playwright | 主要フロー100% | ユーザージャーニー・コンバージョン |

### 1.2 品質ゲート (CI/CD)

- **PRマージ条件**: Unit/Integration全件パス + E2E主要シナリオパス
- **本番デプロイ条件**: Lighthouse スコア基準クリア + 薬機法チェック0件
- **自動公開条件 (Phase 2以降)**: 品質スコア80点以上

---

## 2. 薬機法NG表現検出テストケース設計

### 2.1 テスト対象

`src/lib/compliance/yakujiho-checker.ts` (タスク#4で実装予定)

### 2.2 NGパターン分類

#### カテゴリA: 効能効果の断定表現 (最重要)

| NG表現 | 期待されるOK変換 | 根拠条文 |
|--------|----------------|---------|
| 確実に髪が生える | 発毛を促進する効果が期待できる | 第66条 |
| 必ず発毛する | 発毛をサポートする可能性がある | 第66条 |
| 完全に治る | 症状の改善が期待できる | 第66条 |
| 100%効果がある | 効果には個人差があります | 第66条 |
| シミが消える | メラニンの生成を抑制する効果がある | 第66条 |
| シミが完全に消える | メラニンの生成を抑制し、シミを目立たなくする効果が期待できる | 第66条 |
| AGA完治 | AGA改善をサポート | 第66条 |
| ED治療効果100% | ED治療に活用されている | 第66条 |

#### カテゴリB: 安全性の断定表現

| NG表現 | 期待されるOK変換 | 根拠条文 |
|--------|----------------|---------|
| 副作用なし | 副作用のリスクが低いとされている※注釈必須 | 第66条 |
| 副作用ゼロ | 重篤な副作用の報告が少ないとされている | 第66条 |
| 安全な薬 | 医師の処方のもと安全に使用できる | 第66条 |
| 絶対安全 | 多くの患者に使用されている | 第66条 |

#### カテゴリC: 最上級・比較優位表現

| NG表現 | 期待されるOK変換 | 根拠 |
|--------|----------------|------|
| 最安値 | 調査時点での最低価格(2026年3月調査) | 景表法 |
| 業界No.1 | 業界最大規模(※自社調べ) | 景表法 |
| 日本一 | 国内トップクラス(※自社調べ) | 景表法 |
| 世界一 | 世界的に高い評価を受けている | 景表法 |
| 最高品質 | 高品質として多くのユーザーに評価されている | 景表法 |

#### カテゴリD: 未承認薬・適応外表現

| NG表現 | 対応 | 根拠条文 |
|--------|------|---------|
| 〇〇に効く (未承認効能) | 当該表現を削除 | 第67条 |
| 〇〇を治療できる (適応外) | 医師への相談を促す表現に変換 | 第67条 |

#### カテゴリE: ステマ規制 (景表法)

| NG | OK | 根拠 |
|----|-----|------|
| PR表記なし (広告記事) | 記事冒頭に「※本記事はPRを含みます」を自動挿入 | 景表法 |
| アフィリリンクにrel未設定 | rel="sponsored" 属性を自動付与 | ステマ規制 |

### 2.3 テストケース設計

```typescript
// src/lib/compliance/__tests__/yakujiho-checker.test.ts

describe('薬機法NG表現検出', () => {
  // カテゴリA: 効能効果の断定
  describe('効能効果断定表現', () => {
    test.each([
      ['確実に髪が生える', true],
      ['発毛を促進する効果が期待できる', false],
      ['必ず発毛する', true],
      ['AGA完治', true],
      ['AGA改善をサポート', false],
    ])('"%s" の検出結果が %s であること', (text, expected) => {
      expect(containsNgExpression(text)).toBe(expected);
    });
  });

  // カテゴリB: 安全性断定
  describe('安全性断定表現', () => {
    test('「副作用なし」を検出すること', () => {
      const result = checkCompliance('副作用なしで安心して使えます');
      expect(result.violations).toContainEqual(
        expect.objectContaining({ category: 'SAFETY_CLAIM' })
      );
    });

    test('OK表現は検出されないこと', () => {
      const result = checkCompliance('副作用のリスクが低いとされています（※個人差あり）');
      expect(result.violations).toHaveLength(0);
    });
  });

  // カテゴリC: 最上級表現
  describe('最上級・比較優位表現', () => {
    test.each([
      ['最安値保証'],
      ['業界No.1'],
      ['日本一の実績'],
    ])('"%s" を検出すること', (text) => {
      expect(containsNgExpression(text)).toBe(true);
    });
  });

  // カテゴリD: 文脈分析
  describe('文脈を考慮した検出', () => {
    test('否定文中のNG表現は検出しないこと', () => {
      // 「完全に治るとは言えません」→ OK
      const result = checkCompliance('完全に治るとは言えませんが');
      expect(result.violations).toHaveLength(0);
    });

    test('引用符内のNG表現は警告レベルとすること', () => {
      const result = checkCompliance('「確実に髪が生える」という主張は根拠がない');
      expect(result.violations[0]?.severity).toBe('WARNING');
    });
  });

  // OK変換の検証
  describe('OK表現への自動変換', () => {
    test('NG表現を正しいOK表現に変換すること', () => {
      const converted = convertToOkExpression('確実に髪が生える');
      expect(converted).toBe('発毛を促進する効果が期待できる');
    });

    test('変換後にNG表現が残らないこと', () => {
      const text = '確実に髪が生えます。副作用なしで安全です。';
      const result = autoCorrect(text);
      expect(checkCompliance(result).violations).toHaveLength(0);
    });
  });

  // PR表記の検証
  describe('ステマ規制対応', () => {
    test('アフィリリンクにrel="sponsored"が付与されること', () => {
      const html = '<a href="https://example.com/aff">商品へ</a>';
      const processed = processAffiliateLinks(html);
      expect(processed).toContain('rel="sponsored"');
    });

    test('PR記事にPR表記が挿入されること', () => {
      const article = { isPR: true, content: '記事本文' };
      const processed = insertPrDisclosure(article);
      expect(processed.content).toMatch(/本記事はPRを含みます/);
    });
  });
});
```

### 2.4 回帰テスト用NGワード辞書検証

```typescript
describe('NGワード辞書整合性', () => {
  test('辞書にカテゴリAが全件含まれること', () => {
    const dict = loadNgDictionary();
    expect(dict.categoryA.length).toBeGreaterThan(50);
  });

  test('辞書の各エントリにOK変換が存在すること', () => {
    const dict = loadNgDictionary();
    dict.categoryA.forEach(entry => {
      expect(entry.okExpression).toBeTruthy();
    });
  });
});
```

---

## 3. Core Web Vitals 閾値設定

### 3.1 目標値 (Good ゾーン準拠 + メディアサイト特性考慮)

| 指標 | Good | Needs Improvement | Poor | 本プロジェクト目標 |
|------|------|------------------|------|-----------------|
| **LCP** (最大コンテンツ描画) | ≤2.5s | 2.5-4.0s | >4.0s | **≤2.0s** |
| **INP** (インタラクション応答) | ≤200ms | 200-500ms | >500ms | **≤150ms** |
| **CLS** (レイアウトシフト) | ≤0.1 | 0.1-0.25 | >0.25 | **≤0.05** |
| **FCP** (最初のコンテンツ描画) | ≤1.8s | 1.8-3.0s | >3.0s | **≤1.5s** |
| **TTFB** (最初のバイト受信) | ≤800ms | 800ms-1.8s | >1.8s | **≤500ms** |

### 3.2 ページ別閾値

| ページタイプ | LCP目標 | CLS目標 | 備考 |
|-----------|--------|---------|------|
| トップページ | ≤1.8s | ≤0.05 | 最重要、Hero画像最適化必須 |
| 記事ページ | ≤2.0s | ≤0.05 | OGP画像・アイキャッチ |
| クリニック比較ページ | ≤2.5s | ≤0.05 | 比較表のスケルトン表示 |
| カテゴリページ | ≤2.0s | ≤0.05 | 記事サムネイル一覧 |

### 3.3 Lighthouseスコア目標

| カテゴリ | 目標スコア | 備考 |
|---------|---------|------|
| Performance | **≥90** | CWV 3指標が主要因 |
| Accessibility | **≥95** | WCAG 2.1 AA準拠 |
| Best Practices | **≥95** | HTTPS, Security Headers |
| SEO | **≥95** | 構造化データ、meta最適化 |

### 3.4 パフォーマンステスト実装

```typescript
// tests/performance/web-vitals.spec.ts (Playwright)

import { test, expect } from '@playwright/test';

const CWV_THRESHOLDS = {
  lcp: 2000,   // ms
  inp: 150,    // ms
  cls: 0.05,
  fcp: 1500,   // ms
  ttfb: 500,   // ms
};

test.describe('Core Web Vitals', () => {
  test('トップページがCWV基準を満たすこと', async ({ page }) => {
    await page.goto('/');

    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        const results: Record<string, number> = {};

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              results.lcp = entry.startTime;
            }
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // FCP
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
        if (fcpEntry) results.fcp = fcpEntry.startTime;

        // TTFB
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        results.ttfb = navEntry.responseStart - navEntry.requestStart;

        setTimeout(() => resolve(results), 3000);
      });
    });

    expect(metrics.lcp).toBeLessThan(CWV_THRESHOLDS.lcp);
    expect(metrics.fcp).toBeLessThan(CWV_THRESHOLDS.fcp);
    expect(metrics.ttfb).toBeLessThan(CWV_THRESHOLDS.ttfb);
  });

  test('記事ページのCLSが基準を満たすこと', async ({ page }) => {
    await page.goto('/articles/sample-article');

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsScore = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            clsScore += (entry as any).value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(clsScore), 3000);
      });
    });

    expect(cls).toBeLessThan(CWV_THRESHOLDS.cls);
  });
});
```

---

## 4. E2Eテスト シナリオ設計

### 4.1 優先度別シナリオ一覧

| 優先度 | シナリオ | 対象ページ | ビジネス重要度 |
|--------|---------|----------|------------|
| P0 | アフィリリンクのクリック計測 | 記事/比較ページ | 収益直結 |
| P0 | PR表記の表示確認 | 全記事 | 法規制必須 |
| P0 | 薬機法NG表現が公開されていないこと | 全記事 | 法規制必須 |
| P1 | 記事一覧→記事詳細→CV | ユーザージャーニー全体 | 収益 |
| P1 | 検索・カテゴリ絞り込み | カテゴリページ | 集客 |
| P1 | 構造化データの出力確認 | 記事/比較ページ | SEO |
| P2 | スマートフォン表示確認 | 全ページ | UX |
| P2 | ISR動作確認 | 記事ページ | パフォーマンス |
| P2 | 404ページの表示 | 存在しないURL | UX |

### 4.2 P0シナリオ詳細

#### シナリオ1: アフィリリンクのクリック計測

```typescript
// tests/e2e/affiliate-tracking.spec.ts

test.describe('アフィリリンク動作確認', () => {
  test('AGAクリニック比較記事でアフィリリンクが正しく設定されていること', async ({ page }) => {
    await page.goto('/articles/aga-clinic-comparison');

    // アフィリリンクの確認
    const affiliateLinks = await page.locator('a[rel="sponsored"]').all();
    expect(affiliateLinks.length).toBeGreaterThan(0);

    // rel属性の確認
    for (const link of affiliateLinks) {
      const rel = await link.getAttribute('rel');
      expect(rel).toContain('sponsored');
    }

    // target="_blank" + noopener の確認 (セキュリティ)
    for (const link of affiliateLinks) {
      const target = await link.getAttribute('target');
      const rel = await link.getAttribute('rel');
      if (target === '_blank') {
        expect(rel).toContain('noopener');
      }
    }
  });

  test('ITP対応: アフィリリンクのパラメータが保持されること', async ({ page, context }) => {
    // Safari ITP環境をシミュレート
    await context.addCookies([]);
    await page.goto('/articles/aga-clinic-comparison');

    const link = page.locator('a[rel="sponsored"]').first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/([?&](utm_|aff_|aid=|sid=))/);
  });
});
```

#### シナリオ2: PR表記の全記事表示確認

```typescript
// tests/e2e/compliance-pr-disclosure.spec.ts

test.describe('ステマ規制対応: PR表記', () => {
  const PR_ARTICLES = [
    '/articles/minoxidil-review',
    '/articles/aga-clinic-comparison',
    '/articles/mens-skincare-ranking',
  ];

  for (const articleUrl of PR_ARTICLES) {
    test(`${articleUrl} にPR表記が存在すること`, async ({ page }) => {
      await page.goto(articleUrl);

      // PR表記の確認 (複数パターン)
      const prDisclosure = page.locator(
        'text=/本記事はPRを含みます|広告を含む|アフィリエイト広告/'
      );
      await expect(prDisclosure).toBeVisible();

      // 表示位置の確認: 記事本文より上部に表示されること
      const prBox = await prDisclosure.boundingBox();
      const articleBody = await page.locator('article').boundingBox();

      if (prBox && articleBody) {
        expect(prBox.y).toBeLessThan(articleBody.y + 200); // 記事冒頭200px以内
      }
    });
  }
});
```

#### シナリオ3: 薬機法NG表現が公開されていないこと

```typescript
// tests/e2e/compliance-yakujiho.spec.ts

const NG_PATTERNS = [
  /確実に.*生える/,
  /必ず.*発毛/,
  /完全に.*消える/,
  /副作用なし/,
  /副作用ゼロ/,
  /100%効果/,
  /AGA完治/,
  /最安値(?!.*調査時点)/,  // 調査日時記載なしの「最安値」
  /業界No\.?1(?!.*自社調べ)/,
];

test.describe('薬機法コンプライアンス: 公開記事のNG表現検出', () => {
  test('トップページにNG表現が含まれないこと', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();

    for (const pattern of NG_PATTERNS) {
      expect(bodyText).not.toMatch(pattern);
    }
  });

  test('記事ページにNG表現が含まれないこと', async ({ page }) => {
    // microCMS APIから最新記事URLを取得してチェック
    await page.goto('/articles');
    const articleLinks = await page.locator('a[href^="/articles/"]').all();

    // 最新10記事を確認
    for (const link of articleLinks.slice(0, 10)) {
      const href = await link.getAttribute('href');
      await page.goto(href!);

      const articleText = await page.locator('article').textContent();
      for (const pattern of NG_PATTERNS) {
        expect(articleText).not.toMatch(pattern);
      }
    }
  });
});
```

### 4.3 P1シナリオ詳細

#### シナリオ4: ユーザージャーニー (記事→CV)

```typescript
// tests/e2e/user-journey.spec.ts

test.describe('コンバージョンジャーニー', () => {
  test('AGAクリニック検討ユーザーのCV導線が機能すること', async ({ page }) => {
    // 1. カテゴリページ訪問
    await page.goto('/categories/aga');
    await expect(page).toHaveTitle(/AGA/);

    // 2. 記事一覧から選択
    await page.locator('article').first().locator('a').click();
    await page.waitForLoadState('networkidle');

    // 3. 記事内容の確認
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="pr-disclosure"]')).toBeVisible();

    // 4. 比較表・CVボタンの確認
    const cvButton = page.locator('[data-testid="cv-button"]').first();
    await expect(cvButton).toBeVisible();
    await expect(cvButton).toBeInViewport({ ratio: 0.5 });

    // 5. アフィリリンクへの遷移確認 (実際の遷移はしない)
    const href = await cvButton.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^https?:\/\//);
  });
});
```

#### シナリオ5: 構造化データの出力確認

```typescript
// tests/e2e/structured-data.spec.ts

test.describe('構造化データ (SEO)', () => {
  test('記事ページにArticle構造化データが出力されること', async ({ page }) => {
    await page.goto('/articles/aga-clinic-comparison');

    const jsonLd = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      );
      return scripts.map(s => JSON.parse(s.textContent || '{}'));
    });

    const articleSchema = jsonLd.find(s =>
      s['@type'] === 'Article' || s['@type'] === 'MedicalWebPage'
    );
    expect(articleSchema).toBeTruthy();
    expect(articleSchema.author).toBeTruthy();
    expect(articleSchema.dateModified).toBeTruthy(); // 更新日必須
    expect(articleSchema.medicalAudience).toBeTruthy(); // YMYL必須
  });

  test('BreadcrumbListが正しく出力されること', async ({ page }) => {
    await page.goto('/articles/aga-clinic-comparison');

    const jsonLd = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      );
      return scripts.map(s => JSON.parse(s.textContent || '{}'));
    });

    const breadcrumb = jsonLd.find(s => s['@type'] === 'BreadcrumbList');
    expect(breadcrumb).toBeTruthy();
    expect(breadcrumb.itemListElement.length).toBeGreaterThanOrEqual(2);
  });
});
```

### 4.4 アクセシビリティテスト (WCAG 2.1 AA)

```typescript
// tests/e2e/accessibility.spec.ts
import AxeBuilder from '@axe-core/playwright';

test.describe('アクセシビリティ (WCAG 2.1 AA)', () => {
  const TARGET_PAGES = ['/', '/categories/aga', '/articles/sample'];

  for (const url of TARGET_PAGES) {
    test(`${url} がWCAG 2.1 AAに準拠していること`, async ({ page }) => {
      await page.goto(url);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();

      expect(results.violations).toHaveLength(0);
    });
  }

  test('画像に適切なalt属性が設定されていること', async ({ page }) => {
    await page.goto('/articles/sample');

    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      // 装飾画像は alt="" でOK、コンテンツ画像は説明文必須
      const role = await img.getAttribute('role');
      if (role !== 'presentation') {
        expect(alt).not.toBeNull();
      }
    }
  });
});
```

---

## 5. ISR動作確認テスト

### 5.1 Vercel ISR確認シナリオ

```typescript
// tests/e2e/isr.spec.ts

test.describe('ISR (Incremental Static Regeneration)', () => {
  test('記事ページのCache-Controlヘッダーが正しく設定されていること', async ({ page }) => {
    const response = await page.goto('/articles/sample-article');

    const cacheControl = response?.headers()['cache-control'];
    expect(cacheControl).toMatch(/s-maxage=\d+/); // Vercel Edge Cache
    expect(cacheControl).toMatch(/stale-while-revalidate/);
  });

  test('PPR: 静的シェルが高速に返ること', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/articles/sample-article');

    // First Byte < 500ms (TTFB目標)
    await page.waitForSelector('h1', { timeout: 2000 });
    const ttfb = Date.now() - startTime;
    expect(ttfb).toBeLessThan(500);
  });
});
```

---

## 6. テスト環境・CI設定方針

### 6.1 テスト環境構成

```
開発環境 (localhost:3000)
  ↓ Unit/Integration Tests (Vitest)
  ↓ E2Eテスト (Playwright headless)

Vercel Preview デプロイ
  ↓ E2Eテスト (本番環境相当)
  ↓ Lighthouse CI

本番 (menscataly.com)
  ↓ 定期監視 (日次 23:00)
  ↓ 薬機法スキャン
```

### 6.2 vitest.config.ts 設計方針

```typescript
// vitest.config.ts (想定)
export default {
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
      // 薬機法チェッカーは100%カバレッジ必須
      perFile: true,
    },
  },
};
```

### 6.3 playwright.config.ts 設計方針

```typescript
// playwright.config.ts (想定)
export default {
  testDir: './tests/e2e',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'safari', use: { ...devices['Desktop Safari'] } },   // ITP確認
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } }, // ITP確認
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
};
```

---

## 7. 薬機法チェッカー品質基準

| 指標 | 目標値 | 備考 |
|------|--------|------|
| 検出精度 (Precision) | ≥95% | 誤検出を最小化 |
| 検出再現率 (Recall) | ≥99% | 見逃しを徹底排除 |
| 自動変換成功率 | ≥90% | 残り10%は人間レビューへ |
| 処理速度 | ≤100ms/記事 | パイプライン遅延防止 |

---

## 8. 依存関係・前提条件

| 前提 | 担当 | タスク |
|------|------|--------|
| Next.js 16セットアップ | Frontend Agent | #2 |
| 薬機法NGワード辞書 | Content Agent | #4 (タスク#6) |
| microCMS APIスキーマ | Backend Agent | #3 |
| Supabase DB接続 | Backend Agent | #3 |

**タスク#2・#4完了後の実装順序**:
1. `vitest.config.ts` + `playwright.config.ts` 設定
2. 薬機法チェッカー Unit Tests (タスク#4の成果物に対して)
3. コンポーネント Unit Tests (タスク#2の成果物に対して)
4. E2E テスト (P0シナリオから順次実装)
5. CI/CD パイプライン統合

---

*作成: QA Agent — 2026年3月2日*
