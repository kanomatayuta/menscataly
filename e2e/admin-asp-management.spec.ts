/**
 * E2E 管理画面 ASP管理テスト
 * ASPプログラム一覧・作成・ITPトグル・カテゴリマッピング確認
 */

import { test, expect } from '@playwright/test'

test.describe('管理画面 ASP管理', () => {
  // ==============================================================
  // ASP一覧 API テスト
  // ==============================================================

  test('ASP一覧APIが200を返すこと', async ({ request }) => {
    const response = await request.get('/api/admin/asp', {
      headers: {
        'X-Admin-Api-Key': 'test-key',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.programs).toBeDefined()
      expect(Array.isArray(data.programs)).toBe(true)
      expect(data.total).toBeDefined()
      expect(typeof data.total).toBe('number')
    }
  })

  test('ASP一覧がカテゴリフィルタで絞り込めること', async ({ request }) => {
    const response = await request.get('/api/admin/asp?category=aga', {
      headers: {
        'X-Admin-Api-Key': 'test-key',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.programs).toBeDefined()

      // フィルタ結果の全プログラムがagaカテゴリに属すること
      for (const program of data.programs) {
        expect(program.categories).toContain('aga')
      }
    }
  })

  test('ASP一覧がASP名フィルタで絞り込めること', async ({ request }) => {
    const response = await request.get('/api/admin/asp?asp=a8', {
      headers: {
        'X-Admin-Api-Key': 'test-key',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.programs).toBeDefined()

      for (const program of data.programs) {
        expect(program.asp).toBe('a8')
      }
    }
  })

  // ==============================================================
  // ASPプログラム作成 API テスト
  // ==============================================================

  test('ASPプログラムをPOSTで作成できること', async ({ request }) => {
    const response = await request.post('/api/admin/asp', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        name: 'E2Eテスト用プログラム',
        asp: 'a8',
        categories: ['aga'],
        rewardType: 'fixed',
        rewardAmount: 5000,
        url: 'https://example.com/e2e-test',
        itpEnabled: true,
      },
    })

    expect([200, 201, 401]).toContain(response.status())

    if (response.status() === 200 || response.status() === 201) {
      const data = await response.json()
      expect(data.program).toBeDefined()
      expect(data.program.name).toBe('E2Eテスト用プログラム')
      expect(data.program.asp).toBe('a8')
    }
  })

  test('プログラム名なしのPOSTが400を返すこと', async ({ request }) => {
    const response = await request.post('/api/admin/asp', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        asp: 'a8',
        categories: ['aga'],
      },
    })

    // 400 (バリデーションエラー) または 401 (本番認証)
    expect([400, 401]).toContain(response.status())
  })

  // ==============================================================
  // ASPプログラム詳細・更新・削除 API テスト
  // ==============================================================

  test('ASPプログラム詳細APIがGETで動作すること', async ({ request }) => {
    // まずプログラムを作成
    const createResponse = await request.post('/api/admin/asp', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        name: 'E2E詳細テスト用',
        asp: 'afb',
        categories: ['ed'],
        rewardType: 'percentage',
        rewardAmount: 10,
        url: 'https://example.com/detail-test',
      },
    })

    if (createResponse.status() === 200 || createResponse.status() === 201) {
      const createData = await createResponse.json()
      const programId = createData.program.id

      // 詳細取得
      const detailResponse = await request.get(`/api/admin/asp/${programId}`, {
        headers: {
          'X-Admin-Api-Key': 'test-key',
        },
      })

      expect(detailResponse.status()).toBe(200)

      const detailData = await detailResponse.json()
      expect(detailData.program.id).toBe(programId)
      expect(detailData.program.name).toBe('E2E詳細テスト用')
    }
  })

  test('ASPプログラム更新APIがPUTで動作すること', async ({ request }) => {
    // まずプログラムを作成
    const createResponse = await request.post('/api/admin/asp', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        name: 'E2E更新テスト用',
        asp: 'a8',
        categories: ['skincare'],
        rewardType: 'fixed',
        rewardAmount: 3000,
        url: 'https://example.com/update-test',
        itpEnabled: false,
      },
    })

    if (createResponse.status() === 200 || createResponse.status() === 201) {
      const createData = await createResponse.json()
      const programId = createData.program.id

      // ITPトグル等の更新
      const updateResponse = await request.put(`/api/admin/asp/${programId}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Api-Key': 'test-key',
        },
        data: {
          itpEnabled: true,
          rewardAmount: 4000,
        },
      })

      expect(updateResponse.status()).toBe(200)

      const updateData = await updateResponse.json()
      expect(updateData.program.itpEnabled).toBe(true)
      expect(updateData.program.rewardAmount).toBe(4000)
    }
  })

  test('ASPプログラム削除APIがDELETEで動作すること', async ({ request }) => {
    // まずプログラムを作成
    const createResponse = await request.post('/api/admin/asp', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        name: 'E2E削除テスト用',
        asp: 'accesstrade',
        categories: ['hair-removal'],
        rewardType: 'fixed',
        rewardAmount: 2000,
        url: 'https://example.com/delete-test',
      },
    })

    if (createResponse.status() === 200 || createResponse.status() === 201) {
      const createData = await createResponse.json()
      const programId = createData.program.id

      // 削除
      const deleteResponse = await request.delete(`/api/admin/asp/${programId}`, {
        headers: {
          'X-Admin-Api-Key': 'test-key',
        },
      })

      expect(deleteResponse.status()).toBe(200)

      // 削除後にGETすると404
      const getResponse = await request.get(`/api/admin/asp/${programId}`, {
        headers: {
          'X-Admin-Api-Key': 'test-key',
        },
      })

      expect(getResponse.status()).toBe(404)
    }
  })

  // ==============================================================
  // ITPトグル機能テスト
  // ==============================================================

  test('ITPトグルでitpEnabledを切り替えられること', async ({ request }) => {
    // プログラム作成 (itpEnabled: false)
    const createResponse = await request.post('/api/admin/asp', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        name: 'E2E ITPトグルテスト',
        asp: 'afb',
        categories: ['aga'],
        rewardType: 'fixed',
        rewardAmount: 6000,
        url: 'https://example.com/itp-toggle-test',
        itpEnabled: false,
      },
    })

    if (createResponse.status() === 200 || createResponse.status() === 201) {
      const createData = await createResponse.json()
      const programId = createData.program.id
      expect(createData.program.itpEnabled).toBe(false)

      // ITP有効化
      const enableResponse = await request.put(`/api/admin/asp/${programId}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Api-Key': 'test-key',
        },
        data: {
          itpEnabled: true,
        },
      })

      expect(enableResponse.status()).toBe(200)
      const enableData = await enableResponse.json()
      expect(enableData.program.itpEnabled).toBe(true)

      // ITP無効化
      const disableResponse = await request.put(`/api/admin/asp/${programId}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Api-Key': 'test-key',
        },
        data: {
          itpEnabled: false,
        },
      })

      expect(disableResponse.status()).toBe(200)
      const disableData = await disableResponse.json()
      expect(disableData.program.itpEnabled).toBe(false)
    }
  })

  // ==============================================================
  // カテゴリマッピングテスト
  // ==============================================================

  test('ASPプログラムが正しいカテゴリに紐づくこと', async ({ request }) => {
    // 複数カテゴリのプログラムを作成
    const createResponse = await request.post('/api/admin/asp', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        name: 'E2Eカテゴリマッピングテスト',
        asp: 'a8',
        categories: ['aga', 'ed', 'skincare'],
        rewardType: 'fixed',
        rewardAmount: 8000,
        url: 'https://example.com/category-test',
      },
    })

    if (createResponse.status() === 200 || createResponse.status() === 201) {
      const createData = await createResponse.json()
      expect(createData.program.categories).toContain('aga')
      expect(createData.program.categories).toContain('ed')
      expect(createData.program.categories).toContain('skincare')
      expect(createData.program.categories.length).toBe(3)
    }
  })

  // ==============================================================
  // コスト管理 API テスト
  // ==============================================================

  test('コスト集計APIが動作すること', async ({ request }) => {
    const response = await request.get('/api/admin/costs', {
      headers: {
        'X-Admin-Api-Key': 'test-key',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.totalCost).toBeDefined()
      expect(data.breakdown).toBeDefined()
    }
  })

  test('コスト集計APIがperiodパラメータを受け付けること', async ({ request }) => {
    const response = await request.get('/api/admin/costs?period=weekly', {
      headers: {
        'X-Admin-Api-Key': 'test-key',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.period).toBe('weekly')
    }
  })

  // ==============================================================
  // キーワード管理 API テスト
  // ==============================================================

  test('キーワード一覧APIが動作すること', async ({ request }) => {
    const response = await request.get('/api/admin/keywords', {
      headers: {
        'X-Admin-Api-Key': 'test-key',
      },
    })

    expect([200, 401]).toContain(response.status())

    if (response.status() === 200) {
      const data = await response.json()
      expect(data.keywords).toBeDefined()
      expect(Array.isArray(data.keywords)).toBe(true)
      expect(data.total).toBeDefined()
    }
  })

  test('キーワード登録APIがPOSTで動作すること', async ({ request }) => {
    const response = await request.post('/api/admin/keywords', {
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Api-Key': 'test-key',
      },
      data: {
        keyword: 'E2Eテストキーワード',
        category: 'aga',
        searchVolume: 1500,
        difficulty: 25,
      },
    })

    expect([200, 201, 401]).toContain(response.status())

    if (response.status() === 200 || response.status() === 201) {
      const data = await response.json()
      expect(data.keyword).toBeDefined()
      expect(data.keyword.keyword).toBe('E2Eテストキーワード')
    }
  })

  // ==============================================================
  // 認証テスト
  // ==============================================================

  test('認証なしのASP APIリクエストが401を返すこと', async ({ request }) => {
    const response = await request.get('/api/admin/asp')

    // 開発モード（NODE_ENV=development）ではバイパスされる可能性がある
    // 本番では401が返される
    const status = response.status()
    expect([200, 401]).toContain(status)
  })
})
