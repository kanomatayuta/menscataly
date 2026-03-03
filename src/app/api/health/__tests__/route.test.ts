/**
 * Health Check API Unit Tests
 * 全サービス正常、部分障害、レスポンスフォーマットをテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

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
// テスト本体
// ============================================================

describe('GET /api/health', () => {
  describe('全サービス正常', () => {
    it('statusが "healthy" で HTTP 200 を返すこと', async () => {
      // microCMS と Supabase の両方が正常応答
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [], totalCount: 0 }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )

      const { GET } = await import('../route')
      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.status).toBe('healthy')
      expect(body.services.microcms.status).toBe('ok')
      expect(body.services.supabase.status).toBe('ok')
    })
  })

  describe('部分障害 (degraded)', () => {
    it('一方のサービスがエラーの場合、statusが "degraded" になること', async () => {
      // microCMS は正常、Supabase はエラー
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [] }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response('Internal Server Error', { status: 500 })
        )

      const { GET } = await import('../route')
      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.status).toBe('degraded')
      expect(body.services.microcms.status).toBe('ok')
      expect(body.services.supabase.status).toBe('error')
    })
  })

  describe('全サービスダウン', () => {
    it('全サービスが未設定の場合、statusが "healthy" を返す (not_configured は許容)', async () => {
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
      const response = await GET()
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
    })
  })

  describe('レスポンスフォーマット', () => {
    it('レスポンスに timestamp, services, version, environment フィールドが含まれること', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [] }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )

      const { GET } = await import('../route')
      const response = await GET()
      const body = await response.json()

      expect(body.timestamp).toBeDefined()
      expect(body.services).toBeDefined()
      expect(body.services.microcms).toBeDefined()
      expect(body.services.supabase).toBeDefined()
      expect(body.version).toBeDefined()
      expect(body.environment).toBeDefined()
    })

    it('各サービスに status, message が含まれること', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ contents: [] }), { status: 200 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({}), { status: 200 })
        )

      const { GET } = await import('../route')
      const response = await GET()
      const body = await response.json()

      for (const service of Object.values(body.services) as Array<{ status: string; message: string }>) {
        expect(service.status).toBeDefined()
        expect(['ok', 'error', 'not_configured']).toContain(service.status)
        expect(service.message).toBeDefined()
        expect(typeof service.message).toBe('string')
      }
    })

    it('fetch がネットワークエラーを投げた場合、サービスは error になること', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Connection refused'))

      const { GET } = await import('../route')
      const response = await GET()
      const body = await response.json()

      expect(body.status).toBe('unhealthy')
      expect(body.services.microcms.status).toBe('error')
      expect(body.services.supabase.status).toBe('error')
      expect(body.services.microcms.message).toContain('Network error')
      expect(body.services.supabase.message).toContain('Connection refused')
    })
  })
})
