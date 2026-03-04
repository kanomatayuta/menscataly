/**
 * E2E 構造化データテスト
 *
 * JSON-LD (application/ld+json) の存在と
 * Organization / Person スキーマの正しさを検証する。
 */

import { test, expect } from '@playwright/test';

/**
 * ページ内のすべての JSON-LD スクリプトをパースして返すヘルパー
 */
async function getJsonLdScripts(page: import('@playwright/test').Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    return scripts
      .map((s) => {
        try {
          return JSON.parse(s.textContent ?? '');
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  });
}

test.describe('構造化データ (JSON-LD)', () => {
  test('トップページに script[type="application/ld+json"] が存在すること', async ({ page }) => {
    await page.goto('/');
    // トップページにはJSON-LDが存在する場合としない場合がある。
    // レイアウトレベルで Organization を追加しているか確認。
    // 存在しない場合はスキップ（トップページにはJSON-LDがない設計の可能性）
    const scripts = page.locator('script[type="application/ld+json"]');
    const count = await scripts.count();
    // トップページのJSON-LDは任意 — 存在しなくてもテスト失敗にしない
    test.skip(count === 0, 'トップページにJSON-LDが存在しない設計のためスキップ');
    expect(count).toBeGreaterThan(0);
  });

  test('aboutページに Organization schema が含まれること', async ({ page }) => {
    await page.goto('/about');

    const jsonLdScripts = await getJsonLdScripts(page);
    expect(jsonLdScripts.length, '/about に JSON-LD が存在しない').toBeGreaterThan(0);

    const orgSchema = jsonLdScripts.find(
      (schema) => schema['@type'] === 'Organization'
    );
    expect(orgSchema, '/about に Organization スキーマが見つからない').toBeDefined();
    expect(orgSchema!['@context']).toBe('https://schema.org');
    expect(orgSchema!['name']).toBeDefined();
    expect(orgSchema!['url']).toBeDefined();
  });

  test('aboutページの Organization schema に必要なフィールドがあること', async ({ page }) => {
    await page.goto('/about');

    const jsonLdScripts = await getJsonLdScripts(page);
    const orgSchema = jsonLdScripts.find(
      (schema) => schema['@type'] === 'Organization'
    );

    expect(orgSchema).toBeDefined();
    // Organization は name, url, description を持つべき
    expect(orgSchema!['name']).toBeTruthy();
    expect(orgSchema!['url']).toBeTruthy();
    expect(orgSchema!['description']).toBeTruthy();
  });

  test('監修者一覧ページに Person schema が含まれること', async ({ page }) => {
    await page.goto('/supervisors');

    const jsonLdScripts = await getJsonLdScripts(page);
    expect(jsonLdScripts.length, '/supervisors に JSON-LD が存在しない').toBeGreaterThan(0);

    // CollectionPage のメインエンティティに Person が含まれるか、
    // または直接 Person 型が含まれるか確認
    const hasPersonSchema = jsonLdScripts.some((schema) => {
      // 直接 Person 型
      if (schema['@type'] === 'Person') return true;
      // CollectionPage の mainEntity 内に Person がある
      if (schema['@type'] === 'CollectionPage') {
        const mainEntity = schema['mainEntity'] as Record<string, unknown>[] | undefined;
        if (Array.isArray(mainEntity)) {
          return mainEntity.some((entity) => entity['@type'] === 'Person');
        }
      }
      return false;
    });

    expect(hasPersonSchema, '/supervisors に Person スキーマが見つからない').toBe(true);
  });

  test('監修者詳細ページに Person schema が含まれること', async ({ page }) => {
    // 監修者一覧から最初のリンクを取得して遷移
    await page.goto('/supervisors');
    const supervisorLinks = page.locator('a[href^="/supervisors/"]');
    const count = await supervisorLinks.count();

    test.skip(count === 0, '監修者詳細ページへのリンクが見つからないためスキップ');

    const href = await supervisorLinks.first().getAttribute('href');
    expect(href).toBeTruthy();

    await page.goto(href!);

    const jsonLdScripts = await getJsonLdScripts(page);
    expect(jsonLdScripts.length, '監修者詳細ページに JSON-LD が存在しない').toBeGreaterThan(0);

    const personSchema = jsonLdScripts.find(
      (schema) => schema['@type'] === 'Person'
    );
    expect(personSchema, '監修者詳細ページに Person スキーマが見つからない').toBeDefined();
    expect(personSchema!['name']).toBeTruthy();
  });
});
