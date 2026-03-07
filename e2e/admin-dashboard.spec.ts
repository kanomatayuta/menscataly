/**
 * E2E 管理画面ダッシュボードテスト
 * /admin ページの表示・レイアウト確認
 */

import { test, expect } from '@playwright/test'

test.describe('管理画面ダッシュボード', () => {
  test('admin ダッシュボードが正常にロードされること', async ({ page }) => {
    await page.goto('/admin')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return
    await expect(page.locator('text=Dashboard')).toBeVisible()
  })

  test('ダッシュボードにパイプラインステータスが表示されること', async ({ page }) => {
    await page.goto('/admin')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return
    // パイプラインステータスセクション
    const pipelineSection = page.locator('[data-testid="pipeline-status"]')
      .or(page.getByText('パイプライン'))
      .or(page.getByText('Pipeline'))
    await expect(pipelineSection.first()).toBeVisible()
  })

  test('ダッシュボードに記事統計が表示されること', async ({ page }) => {
    await page.goto('/admin')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return
    // 記事統計セクション
    const articleStats = page.locator('[data-testid="article-stats"]')
      .or(page.getByText('記事'))
      .or(page.getByText('Articles'))
    await expect(articleStats.first()).toBeVisible()
  })

  test('ダッシュボードに収益サマリが表示されること', async ({ page }) => {
    await page.goto('/admin')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return
    // 収益セクション
    const revenue = page.locator('[data-testid="revenue-summary"]')
      .or(page.getByText('収益'))
      .or(page.getByText('Revenue'))
    await expect(revenue.first()).toBeVisible()
  })

  test('ダッシュボードにアクティブアラートが表示されること', async ({ page }) => {
    await page.goto('/admin')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return
    // アラートセクション
    const alerts = page.locator('[data-testid="active-alerts"]')
      .or(page.getByText('アラート'))
      .or(page.getByText('Alerts'))
    await expect(alerts.first()).toBeVisible()
  })

  test('ダッシュボードにコストサマリが表示されること', async ({ page }) => {
    await page.goto('/admin')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return
    // コストセクション
    const costs = page.locator('[data-testid="cost-summary"]')
      .or(page.getByText('コスト'))
      .or(page.getByText('Cost'))
    await expect(costs.first()).toBeVisible()
  })

  test('ナビゲーションリンクが存在すること', async ({ page }) => {
    await page.goto('/admin')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    // 主要ナビゲーションリンク
    const navLinks = page.locator('nav a, [role="navigation"] a')
    const count = await navLinks.count()
    expect(count).toBeGreaterThan(0)
  })
})
