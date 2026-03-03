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
      expect(body.services).toHaveLength(2)
      expect(body.services[0].status).toBe('up')
      expect(body.services[1].status).toBe('up')
    })
  })

  describe('部分障害 (degraded)', () => {
    it('一方のサービスがダウンの場合、statusが "degraded" になること', async () => {
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

      const upServices = body.services.filter(
        (s: { status: string }) => s.status === 'up'
      )
      const downServices = body.services.filter(
        (s: { status: string }) => s.status === 'down'
      )

      expect(upServices).toHaveLength(1)
      expect(downServices).toHaveLength(1)
    })
  })

  describe('全サービスダウン', () => {
    it('全サービスがダウンの場合、statusが "unhealthy" で HTTP 503 を返すこと', async () => {
      // 環境変数を一時的にクリアして両方ダウンにする
      const origDomain = process.env.MICROCMS_SERVICE_DOMAIN
      const origApiKey = process.env.MICROCMS_API_KEY
      const origSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      delete process.env.MICROCMS_SERVICE_DOMAIN
      delete process.env.MICROCMS_API_KEY
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      const { GET } = await import('../route')
      const response = await GET()
      const body = await response.json()

      expect(response.status).toBe(503)
      expect(body.status).toBe('unhealthy')
      expect(body.services.every((s: { status: string }) => s.status === 'down')).toBe(true)

      // 環境変数を復元
      process.env.MICROCMS_SERVICE_DOMAIN = origDomain!
      process.env.MICROCMS_API_KEY = origApiKey!
      process.env.NEXT_PUBLIC_SUPABASE_URL = origSupabaseUrl!
      process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey!
    })
  })

  describe('レスポンスフォーマット', () => {
    it('レスポンスに timestamp, services, version フィールドが含まれること', async () => {
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
      expect(Array.isArray(body.services)).toBe(true)
      expect(body.version).toBeDefined()
    })

    it('各サービスにname, status, latencyMsが含まれること', async () => {
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

      for (const service of body.services) {
        expect(service.name).toBeDefined()
        expect(typeof service.name).toBe('string')
        expect(service.status).toBeDefined()
        expect(['up', 'down']).toContain(service.status)
        expect('latencyMs' in service).toBe(true)
      }
    })

    it('fetch がネットワークエラーを投げた場合、サービスはdownになること', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Connection refused'))

      const { GET } = await import('../route')
      const response = await GET()
      const body = await response.json()

      expect(body.status).toBe('unhealthy')
      for (const service of body.services) {
        expect(service.status).toBe('down')
        expect(service.error).toBeDefined()
      }
    })
  })
})
