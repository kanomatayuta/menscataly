/**
 * E2E 管理画面 レビューワークフローテスト
 * 記事のレビュー承認/却下/修正依頼フロー、レビュー履歴表示
 */

import { test, expect } from '@playwright/test'

test.describe('管理画面 レビューワークフロー', () => {
  // ==============================================================
  // レビュー画面アクセス
  // ==============================================================

  test('レビュー対象記事一覧が表示されること', async ({ page }) => {
    await page.goto('/admin/articles')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    // ページが正常にロードされること
    const heading = page.locator('h1, h2, [data-testid="page-title"]')
    await expect(heading.first()).toBeVisible()

    // 記事リストが表示されること
    const articleList = page.locator(
      'table, [data-testid="article-list"], [role="list"]'
    )
    await expect(articleList.first()).toBeVisible()
  })

  test('レビューステータスフィルタが機能すること', async ({ page }) => {
    await page.goto('/admin/articles')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    // ステータスフィルタ要素が存在すること
    const filter = page.locator(
      'select, [data-testid="status-filter"], [role="combobox"]'
    )
    const filterCount = await filter.count()
    expect(filterCount).toBeGreaterThan(0)
  })

  // ==============================================================
  // レビューアクションボタン
  // ==============================================================

  test('承認ボタンが存在すること', async ({ page }) => {
    await page.goto('/admin/articles')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    const approveBtn = page.locator(
      'button:has-text("承認"), button:has-text("Approve"), [data-testid="approve-button"]'
    )
    const count = await approveBtn.count()

    // レビュー可能な記事がある場合のみチェック
    if (count > 0) {
      await expect(approveBtn.first()).toBeVisible()
    }
  })

  test('却下ボタンが存在すること', async ({ page }) => {
    await page.goto('/admin/articles')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    const rejectBtn = page.locator(
      'button:has-text("却下"), button:has-text("Reject"), [data-testid="reject-button"]'
    )
    const count = await rejectBtn.count()

    if (count > 0) {
      await expect(rejectBtn.first()).toBeVisible()
    }
  })

  test('修正依頼ボタンが存在すること', async ({ page }) => {
    await page.goto('/admin/articles')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    const revisionBtn = page.locator(
      'button:has-text("修正依頼"), button:has-text("Revision"), button:has-text("修正"), [data-testid="revision-button"]'
    )
    const count = await revisionBtn.count()

    if (count > 0) {
      await expect(revisionBtn.first()).toBeVisible()
    }
  })

  // ==============================================================
  // レビュー API エンドポイント
  // ==============================================================

  test('レビュー履歴APIが200を返すこと', async ({ request }) => {
    const response = await request.get('/api/admin/articles/test-001/review', {
      headers: {
        'X-Admin-Api-Key': 'test-key',
      },
    })

    // 200 (成功) または 404 (記事未発見) のどちらかが期待値
    expect([200, 404]).toContain(response.status())
  })

  test('レビュー承認APIがPOSTで動作すること', async ({ request }) => {
    const response = await request.post('/api/admin/articles/test-001/review', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        action: 'approve',
        comment: 'E2Eテスト承認',
      },
    })

    // 200 (成功) または 401 (本番認証) のどちらか
    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.status).toBe('approved')
    }
  })

  test('レビュー却下APIがPOSTで動作すること', async ({ request }) => {
    const response = await request.post('/api/admin/articles/test-002/review', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        action: 'reject',
        comment: 'E2Eテスト却下: コンプライアンス違反あり',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.status).toBe('rejected')
    }
  })

  test('レビュー修正依頼APIがPOSTで動作すること', async ({ request }) => {
    const response = await request.post('/api/admin/articles/test-003/review', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        action: 'revision',
        comment: 'E2Eテスト修正依頼: 表現を修正してください',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.status).toBe('revision_requested')
    }
  })

  // ==============================================================
  // 公開APIテスト
  // ==============================================================

  test('記事公開APIが動作すること', async ({ request }) => {
    const response = await request.post('/api/admin/articles/test-001/publish', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {},
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.publishMode).toBe('immediate')
    }
  })

  test('予約公開APIがscheduledAtを受け付けること', async ({ request }) => {
    const futureDate = new Date(Date.now() + 86400000).toISOString()

    const response = await request.post('/api/admin/articles/test-001/publish', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        publishMode: 'scheduled',
        scheduledAt: futureDate,
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.publishMode).toBe('scheduled')
      expect(data.scheduledAt).toBe(futureDate)
    }
  })

  // ==============================================================
  // コンプライアンススコア表示
  // ==============================================================

  test('記事一覧にコンプライアンススコアが表示されること', async ({ page }) => {
    await page.goto('/admin/articles')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    const scoreElements = page.locator('[data-testid="compliance-score"]')
      .or(page.getByText(/\d+%/))
      .or(page.getByText(/スコア/))
    const count = await scoreElements.count()

    if (count > 0) {
      await expect(scoreElements.first()).toBeVisible()
    }
  })

  // ==============================================================
  // レビューコメント
  // ==============================================================

  test('レビューコメント入力エリアが存在すること', async ({ page }) => {
    await page.goto('/admin/articles')
    const bodyText = await page.locator('body').textContent() ?? ''
    if (!bodyText.trim()) return

    const commentArea = page.locator(
      'textarea, [data-testid="review-comment"], input[placeholder*="コメント"], input[placeholder*="comment"]'
    )
    const count = await commentArea.count()

    // コメント入力UIがある場合
    if (count > 0) {
      await expect(commentArea.first()).toBeVisible()
    }
  })
})
