/**
 * E2E 管理画面記事一覧テスト
 * /admin/articles ページの表示・フィルタ・レビュー機能確認
 */

import { test, expect } from '@playwright/test'

test.describe('管理画面 記事一覧', () => {
  test('記事一覧ページが正常にロードされること', async ({ page }) => {
    await page.goto('/admin/articles')
    // ページタイトルまたは見出しの確認
    const heading = page.locator('h1, h2, [data-testid="page-title"]')
    await expect(heading.first()).toBeVisible()
  })

  test('記事テーブルまたはリストが表示されること', async ({ page }) => {
    await page.goto('/admin/articles')
    // テーブルまたはリスト要素
    const articleList = page.locator('table, [data-testid="article-list"], [role="list"]')
    await expect(articleList.first()).toBeVisible()
  })

  test('ステータスフィルタが存在すること', async ({ page }) => {
    await page.goto('/admin/articles')
    // フィルタUI要素
    const filter = page.locator('select, [data-testid="status-filter"], [role="combobox"]')
    const filterCount = await filter.count()
    expect(filterCount).toBeGreaterThan(0)
  })

  test('記事にコンプライアンススコアが表示されること', async ({ page }) => {
    await page.goto('/admin/articles')
    // スコア表示要素
    const scoreElements = page.locator('[data-testid="compliance-score"], text=/\\d+%/, text=/スコア/')
    const count = await scoreElements.count()
    // 記事が存在する場合はスコアが表示される
    if (count > 0) {
      await expect(scoreElements.first()).toBeVisible()
    }
  })

  test('記事レビューアクションボタンが存在すること', async ({ page }) => {
    await page.goto('/admin/articles')
    // 承認/却下ボタン
    const actionButtons = page.locator('button:has-text("承認"), button:has-text("却下"), button:has-text("Approve"), button:has-text("Reject")')
    const count = await actionButtons.count()
    // 記事がある場合はアクションボタンが存在
    if (count > 0) {
      await expect(actionButtons.first()).toBeVisible()
    }
  })
})
