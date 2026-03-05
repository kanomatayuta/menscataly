/**
 * Admin Auth API Route Tests
 * POST /api/admin/auth — ログイン (Cookie 発行)
 * DELETE /api/admin/auth — ログアウト (Cookie 削除)
 *
 * テスト対象の振る舞い:
 * - POST: 有効な API Key → 200 + admin-token Cookie (httpOnly, secure, sameSite: strict)
 * - POST: 無効な API Key → 401
 * - POST: API Key 未送信 → 400
 * - DELETE: admin-token Cookie を削除して 200 を返す
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ==============================================================
// 環境変数スタブ
// ==============================================================

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

// ==============================================================
// テスト
// ==============================================================

describe('POST /api/admin/auth', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    process.env.ADMIN_API_KEY = 'test-admin-secret-key-123'
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  /**
   * API ルートを動的にインポートする
   */
  async function importRoute() {
    const mod = await import('@/app/api/admin/auth/route')
    return mod
  }

  // ============================================================
  // 有効な API Key で認証成功
  // ============================================================

  it('有効な API Key で POST すると 200 を返すこと', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-admin-secret-key-123' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
  })

  it('有効な API Key で POST すると admin-token Cookie が設定されること', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-admin-secret-key-123' }),
    })

    const response = await POST(req)
    const setCookieHeader = response.headers.get('set-cookie') ?? ''

    // admin-token Cookie が設定されていること
    expect(setCookieHeader).toContain('admin-token')
  })

  it('admin-token Cookie が httpOnly であること', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-admin-secret-key-123' }),
    })

    const response = await POST(req)
    const setCookieHeader = (response.headers.get('set-cookie') ?? '').toLowerCase()

    expect(setCookieHeader).toContain('httponly')
  })

  it('admin-token Cookie の sameSite が strict であること', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-admin-secret-key-123' }),
    })

    const response = await POST(req)
    const setCookieHeader = (response.headers.get('set-cookie') ?? '').toLowerCase()

    expect(setCookieHeader).toContain('samesite=strict')
  })

  it('admin-token Cookie が Secure フラグを持つこと (本番環境想定)', async () => {
    process.env.NODE_ENV = 'production'

    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'test-admin-secret-key-123' }),
    })

    const response = await POST(req)
    const setCookieHeader = (response.headers.get('set-cookie') ?? '').toLowerCase()

    // 本番環境では Secure フラグが設定される
    expect(setCookieHeader).toContain('secure')
  })

  // ============================================================
  // 無効な API Key で 401
  // ============================================================

  it('無効な API Key で POST すると 401 を返すこと', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'wrong-key' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('空文字列の API Key で POST すると 400 を返すこと', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: '' }),
    })

    const response = await POST(req)
    // 空文字列は missing として扱われるため 400
    expect(response.status).toBe(400)
  })

  // ============================================================
  // API Key 未送信で 400
  // ============================================================

  it('API Key 未送信で POST すると 400 を返すこと', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(req)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('不正な JSON ボディで POST すると 400 を返すこと', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    })

    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  // ============================================================
  // ADMIN_API_KEY 未設定
  // ============================================================

  it('ADMIN_API_KEY が未設定の場合 POST すると 500 を返すこと', async () => {
    delete process.env.ADMIN_API_KEY

    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'any-key' }),
    })

    const response = await POST(req)
    // ADMIN_API_KEY 未設定はサーバー設定エラー (500) または 403
    expect([403, 500]).toContain(response.status)
  })

  // ============================================================
  // タイミング攻撃耐性
  // ============================================================

  it('長さの異なるキーでも安全に拒否すること', async () => {
    const { POST } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'x' }),
    })

    const response = await POST(req)
    expect(response.status).toBe(401)
  })
})

// ==============================================================
// DELETE /api/admin/auth — ログアウト
// ==============================================================

describe('DELETE /api/admin/auth', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    process.env.ADMIN_API_KEY = 'test-admin-secret-key-123'
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  async function importRoute() {
    const mod = await import('@/app/api/admin/auth/route')
    return mod
  }

  it('DELETE で 200 を返すこと', async () => {
    const { DELETE } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'DELETE',
    })

    const response = await DELETE(req)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
  })

  it('DELETE で admin-token Cookie がクリアされること', async () => {
    const { DELETE } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'DELETE',
    })

    const response = await DELETE(req)
    const setCookieHeader = response.headers.get('set-cookie') ?? ''

    // Cookie 削除は Max-Age=0 または expires 過去日付で行われる
    expect(setCookieHeader).toContain('admin-token')
    // Cookie を削除するために Max-Age=0 が設定されること
    const isCleared =
      setCookieHeader.includes('Max-Age=0') ||
      setCookieHeader.includes('max-age=0') ||
      setCookieHeader.includes('expires=Thu, 01 Jan 1970')
    expect(isCleared).toBe(true)
  })

  it('DELETE のレスポンスが正しい JSON 形式であること', async () => {
    const { DELETE } = await importRoute()
    const req = new Request('http://localhost/api/admin/auth', {
      method: 'DELETE',
    })

    const response = await DELETE(req)
    const data = await response.json()

    expect(data).toHaveProperty('success')
    expect(data.success).toBe(true)
  })
})
