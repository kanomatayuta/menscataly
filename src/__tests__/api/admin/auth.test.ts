/**
 * Admin Auth API Route Tests
 * Supabase Auth によるメール/パスワード認証テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ==============================================================
// Supabase SSR モック
// ==============================================================

const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  })),
}))

import { POST, DELETE } from '@/app/api/admin/auth/route'

// ==============================================================
// ヘルパー
// ==============================================================

function createJsonRequest(
  body: Record<string, unknown>,
  method = 'POST'
): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/auth', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function createDeleteRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/auth', {
    method: 'DELETE',
  })
}

// ==============================================================
// POST (ログイン) テスト
// ==============================================================

describe('POST /api/admin/auth (ログイン)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('正しいメール/パスワードでログインできること', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'admin@example.com' },
        session: { access_token: 'token-123' },
      },
      error: null,
    })

    const req = createJsonRequest({
      email: 'admin@example.com',
      password: 'secure-password',
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'secure-password',
    })
  })

  it('不正な認証情報で 401 を返すこと', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })

    const req = createJsonRequest({
      email: 'admin@example.com',
      password: 'wrong-password',
    })
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Invalid login credentials')
  })

  it('メールアドレスが未提供の場合 400 を返すこと', async () => {
    const req = createJsonRequest({
      password: 'some-password',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Email and password are required')
  })

  it('パスワードが未提供の場合 400 を返すこと', async () => {
    const req = createJsonRequest({
      email: 'admin@example.com',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Email and password are required')
  })

  it('メールとパスワードが両方未提供の場合 400 を返すこと', async () => {
    const req = createJsonRequest({})
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Email and password are required')
  })

  it('不正なリクエストボディで 400 を返すこと', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/auth', {
      method: 'POST',
      body: 'invalid-json',
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid request body')
  })
})

// ==============================================================
// DELETE (ログアウト) テスト
// ==============================================================

describe('DELETE /api/admin/auth (ログアウト)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    mockSignOut.mockResolvedValue({ error: null })
  })

  it('ログアウトが成功すること', async () => {
    const req = createDeleteRequest()
    const res = await DELETE(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockSignOut).toHaveBeenCalled()
  })
})
