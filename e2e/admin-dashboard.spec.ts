/**
 * E2E 管理画面ダッシュボードテスト
 * /admin ページの表示・レイアウト確認
 */

import { test, expect } from '@playwright/test'

test.describe('管理画面ダッシュボード', () => {
  test('admin ダッシュボードが正常にロードされること', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('ダッシュボードにパイプラインステータスが表示されること', async ({ page }) => {
    await page.goto('/admin')
    // パイプラインステータスセクション
    const pipelineSection = page.locator('[data-testid="pipeline-status"], text=パイプライン, text=Pipeline')
    await expect(pipelineSection.first()).toBeVisible()
  })

  test('ダッシュボードに記事統計が表示されること', async ({ page }) => {
    await page.goto('/admin')
    // 記事統計セクション
    const articleStats = page.locator('[data-testid="article-stats"], text=記事, text=Articles')
    await expect(articleStats.first()).toBeVisible()
  })

  test('ダッシュボードに収益サマリが表示されること', async ({ page }) => {
    await page.goto('/admin')
    // 収益セクション
    const revenue = page.locator('[data-testid="revenue-summary"], text=収益, text=Revenue')
    await expect(revenue.first()).toBeVisible()
  })

  test('ダッシュボードにアクティブアラートが表示されること', async ({ page }) => {
    await page.goto('/admin')
    // アラートセクション
    const alerts = page.locator('[data-testid="active-alerts"], text=アラート, text=Alerts')
    await expect(alerts.first()).toBeVisible()
  })

  test('ダッシュボードにコストサマリが表示されること', async ({ page }) => {
    await page.goto('/admin')
    // コストセクション
    const costs = page.locator('[data-testid="cost-summary"], text=コスト, text=Cost')
    await expect(costs.first()).toBeVisible()
  })

  test('ナビゲーションリンクが存在すること', async ({ page }) => {
    await page.goto('/admin')

    // 主要ナビゲーションリンク
    const navLinks = page.locator('nav a, [role="navigation"] a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)
  })
})
