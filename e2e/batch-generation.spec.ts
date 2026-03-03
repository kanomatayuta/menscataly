/**
 * E2E バッチ生成ページテスト
 * /admin/batch ページの表示・操作確認
 */

import { test, expect } from '@playwright/test'

test.describe('バッチ記事生成ページ', () => {
  test('バッチ生成ページが正常にロードされること', async ({ page }) => {
    await page.goto('/admin/batch')
    // ページタイトルまたは見出し
    const heading = page.locator('h1, h2, [data-testid="page-title"]')
    await expect(heading.first()).toBeVisible()
  })

  test('キーワード入力フォームが表示されること', async ({ page }) => {
    await page.goto('/admin/batch')
    // キーワード入力エリア
    const input = page.locator('textarea, input[type="text"], [data-testid="keyword-input"]')
    const count = await input.count()
    expect(count).toBeGreaterThan(0)
  })

  test('生成開始ボタンが存在すること', async ({ page }) => {
    await page.goto('/admin/batch')
    const startButton = page.locator('button:has-text("生成"), button:has-text("Generate"), button:has-text("開始"), button:has-text("Start")')
    await expect(startButton.first()).toBeVisible()
  })

  test('ドライランオプションが存在すること', async ({ page }) => {
    await page.goto('/admin/batch')
    // ドライランのチェックボックスまたはトグル
    const dryRunOption = page.locator('[data-testid="dry-run-toggle"], input[type="checkbox"], label:has-text("ドライラン"), label:has-text("Dry Run")')
    const count = await dryRunOption.count()
    expect(count).toBeGreaterThan(0)
  })

  test('ジョブ履歴リストが表示されること', async ({ page }) => {
    await page.goto('/admin/batch')
    // ジョブ履歴テーブルまたはリスト
    const jobHistory = page.locator('[data-testid="job-history"], table, text=履歴, text=History')
    const count = await jobHistory.count()
    expect(count).toBeGreaterThan(0)
  })

  test('コスト表示エリアが存在すること', async ({ page }) => {
    await page.goto('/admin/batch')
    // コスト情報の表示
    const costArea = page.locator('[data-testid="cost-display"], text=コスト, text=Cost, text=$')
    const count = await costArea.count()
    expect(count).toBeGreaterThan(0)
  })
})
