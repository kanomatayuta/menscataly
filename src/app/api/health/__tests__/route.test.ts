/**
 * Health Check API Unit Tests
 * 未認証: シンプルステータス, 認証済み: 詳細サービス状態をテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ============================================================
// モック: global fetch
// ============================================================

const mockFetch = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
})

// ============================================================
// ヘルパー: リクエスト生成
// ============================================================

function createRequest(options?: { authToken?: string }): NextRequest {
  const headers: Record<string, string> = {}
  if (options?.authToken) {
    headers['Authorization'] = `Bearer ${options.authToken}`
  }
  return new NextRequest('http://localhost:3000/api/health', { headers })
}

// ============================================================
// テスト本体
// ============================================================

describe('GET /api/health', () => {
  describe('未認証リクエスト', () => {
    it('シンプルなステータスのみ返すこと (機密情報なし)', async () => {
      const { GET } = await import('../route')
      const response = await GET(createRequest())
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.status).toBe('ok')
      expect(body.timestamp).toBeDefined()
      // 機密情報が含まれないことを確認
      expect(body.services).toBeUndefined()
      expect(body.environment).toBeUndefined()
      expect(body.version).toBeUndefined()
    })
  })

  describe('認証済み — 全サービス正常', () => {
    it('statusが "healthy" で HTTP 200 を返すこと', async () => {
      process.env.ADMIN_API_KEY = 'test-admin-key'

      // microCMS と Supabase の両方が正常応答
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [], totalCount: 0 }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )

      const { GET } = await import('../route')
      const response = await GET(createRequest({ authToken: 'test-admin-key' }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.status).toBe('healthy')
      expect(body.services.microcms.status).toBe('ok')
      expect(body.services.supabase.status).toBe('ok')

      delete process.env.ADMIN_API_KEY
    })
  })

  describe('認証済み — 部分障害 (degraded)', () => {
    it('一方のサービスがエラーの場合、statusが "degraded" になること', async () => {
      process.env.ADMIN_API_KEY = 'test-admin-key'

      // microCMS は正常、Supabase はエラー
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [] }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response('Internal Server Error', { status: 500 })
        )

      const { GET } = await import('../route')
      const response = await GET(createRequest({ authToken: 'test-admin-key' }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.status).toBe('degraded')
      expect(body.services.microcms.status).toBe('ok')
      expect(body.services.supabase.status).toBe('error')

      delete process.env.ADMIN_API_KEY
    })
  })

  describe('認証済み — 全サービスダウン', () => {
    it('全サービスが未設定の場合、statusが "healthy" を返す (not_configured は許容)', async () => {
      process.env.ADMIN_API_KEY = 'test-admin-key'

      // 環境変数を一時的にクリア
      const origDomain = process.env.MICROCMS_SERVICE_DOMAIN
      const origApiKey = process.env.MICROCMS_API_KEY
      const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      const origAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      const { GET } = await import('../route')
      const response = await GET(createRequest({ authToken: 'test-admin-key' }))
      const body = await response.json()

      // not_configured は ok 扱いで healthy になる
      expect(response.status).toBe(200)
      expect(body.status).toBe('healthy')
      expect(body.services.microcms.status).toBe('not_configured')
      expect(body.services.supabase.status).toBe('not_configured')

      // 環境変数を復元
      process.env.MICROCMS_SERVICE_DOMAIN = origDomain!
      process.env.MICROCMS_API_KEY = origApiKey!
      process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl!
      process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey!
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = origAnonKey!
      delete process.env.ADMIN_API_KEY
    })
  })

  describe('認証済み — レスポンスフォーマット', () => {
    it('レスポンスに timestamp, services, version, environment フィールドが含まれること', async () => {
      process.env.ADMIN_API_KEY = 'test-admin-key'

      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [] }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )

      const { GET } = await import('../route')
      const response = await GET(createRequest({ authToken: 'test-admin-key' }))
      const body = await response.json()

      expect(body.timestamp).toBeDefined()
      expect(body.services).toBeDefined()
      expect(body.services.microcms).toBeDefined()
      expect(body.services.supabase).toBeDefined()
      expect(body.version).toBeDefined()
      expect(body.environment).toBeDefined()

      delete process.env.ADMIN_API_KEY
    })

    it('各サービスに status, message が含まれること', async () => {
      process.env.ADMIN_API_KEY = 'test-admin-key'

      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [] }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )

      const { GET } = await import('../route')
      const response = await GET(createRequest({ authToken: 'test-admin-key' }))
      const body = await response.json()

      for (const service of Object.values(body.services) as Array<{ status: string; message: string }>) {
        expect(service.status).toBeDefined()
        expect(['ok', 'error', 'not_configured']).toContain(service.status)
        expect(service.message).toBeDefined()
        expect(typeof service.message).toBe('string')
      }

      delete process.env.ADMIN_API_KEY
    })

    it('fetch がネットワークエラーを投げた場合、サービスは error になること', async () => {
      process.env.ADMIN_API_KEY = 'test-admin-key'

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Connection refused'))

      const { GET } = await import('../route')
      const response = await GET(createRequest({ authToken: 'test-admin-key' }))
      const body = await response.json()

      expect(body.status).toBe('unhealthy')
      expect(body.services.microcms.status).toBe('error')
      expect(body.services.supabase.status).toBe('error')
      expect(body.services.microcms.message).toContain('Network error')
      expect(body.services.supabase.message).toContain('Connection refused')

      delete process.env.ADMIN_API_KEY
    })
  })
})
