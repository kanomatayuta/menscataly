/**
 * Admin Auth Module Tests
 * - timing-safe comparison
 * - Authorization: Bearer support
 * - X-Admin-Api-Key / X-Pipeline-Api-Key fallback
 * - Supabase Auth session support
 * - Unified error response format
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  validateAdminAuth,
  validatePipelineAuth,
  getAuthErrorStatus,
  type AuthResult,
} from '@/lib/admin/auth'

describe('Admin Auth Module', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // ==============================================================
  // validateAdminAuth
  // ==============================================================
  describe('validateAdminAuth', () => {
    it('開発環境でAPIキー未設定の場合、認証をバイパスすること', async () => {
      process.env.NODE_ENV = 'development'
      delete process.env.ADMIN_API_KEY

      const req = new Request('http://localhost/api/test')
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('本番環境でAPIキー未設定の場合、FORBIDDEN エラーを返すこと', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.ADMIN_API_KEY

      const req = new Request('http://localhost/api/test')
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.error?.code).toBe('FORBIDDEN')
    })

    it('Authorization: Bearer ヘッダーで認証できること', async () => {
      process.env.ADMIN_API_KEY = 'test-secret-key-123'

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer test-secret-key-123' },
      })
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(true)
    })

    it('X-Admin-Api-Key ヘッダーでフォールバック認証できること', async () => {
      process.env.ADMIN_API_KEY = 'test-secret-key-123'

      const req = new Request('http://localhost/api/test', {
        headers: { 'X-Admin-Api-Key': 'test-secret-key-123' },
      })
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(true)
    })

    it('ヘッダーなしの場合、UNAUTHORIZED エラーを返すこと', async () => {
      process.env.ADMIN_API_KEY = 'test-secret-key-123'

      const req = new Request('http://localhost/api/test')
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.error?.code).toBe('UNAUTHORIZED')
      expect(result.error?.message).toContain('Missing authentication credentials')
    })

    it('不正なAPIキーの場合、UNAUTHORIZED エラーを返すこと', async () => {
      process.env.ADMIN_API_KEY = 'correct-key'

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer wrong-key' },
      })
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.error?.code).toBe('UNAUTHORIZED')
      expect(result.error?.message).toContain('Invalid API key')
    })

    it('長さの異なるキーでも安全に拒否すること (timing-safe)', async () => {
      process.env.ADMIN_API_KEY = 'short'

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'Bearer very-long-incorrect-key-that-differs-in-length' },
      })
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.error?.code).toBe('UNAUTHORIZED')
    })

    it('Bearer prefix が大文字小文字を区別しないこと', async () => {
      process.env.ADMIN_API_KEY = 'test-key'

      const req = new Request('http://localhost/api/test', {
        headers: { Authorization: 'bearer test-key' },
      })
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(true)
    })

    it('Authorization ヘッダーが Bearer でない場合、フォールバックを試みること', async () => {
      process.env.ADMIN_API_KEY = 'test-key'

      const req = new Request('http://localhost/api/test', {
        headers: {
          Authorization: 'Basic dXNlcjpwYXNz',
          'X-Admin-Api-Key': 'test-key',
        },
      })
      const result = await validateAdminAuth(req)

      expect(result.authorized).toBe(true)
    })
  })

  // ==============================================================
  // validatePipelineAuth
  // ==============================================================
  describe('validatePipelineAuth', () => {
    it('Authorization: Bearer ヘッダーで認証できること', () => {
      process.env.PIPELINE_API_KEY = 'pipeline-secret-123'

      const req = new Request('http://localhost/api/pipeline/run', {
        headers: { Authorization: 'Bearer pipeline-secret-123' },
      })
      const result = validatePipelineAuth(req)

      expect(result.authorized).toBe(true)
    })

    it('X-Pipeline-Api-Key ヘッダーでフォールバック認証できること', () => {
      process.env.PIPELINE_API_KEY = 'pipeline-secret-123'

      const req = new Request('http://localhost/api/pipeline/run', {
        headers: { 'X-Pipeline-Api-Key': 'pipeline-secret-123' },
      })
      const result = validatePipelineAuth(req)

      expect(result.authorized).toBe(true)
    })

    it('開発環境でAPIキー未設定の場合、認証をバイパスすること', () => {
      process.env.NODE_ENV = 'development'
      delete process.env.PIPELINE_API_KEY

      const req = new Request('http://localhost/api/pipeline/run')
      const result = validatePipelineAuth(req)

      expect(result.authorized).toBe(true)
    })

    it('不正なキーで UNAUTHORIZED を返すこと', () => {
      process.env.PIPELINE_API_KEY = 'correct-key'

      const req = new Request('http://localhost/api/pipeline/run', {
        headers: { Authorization: 'Bearer wrong-key' },
      })
      const result = validatePipelineAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.error?.code).toBe('UNAUTHORIZED')
    })
  })

  // ==============================================================
  // getAuthErrorStatus
  // ==============================================================
  describe('getAuthErrorStatus', () => {
    it('UNAUTHORIZED エラーの場合、401 を返すこと', () => {
      expect(getAuthErrorStatus({ code: 'UNAUTHORIZED', message: 'test' })).toBe(401)
    })

    it('FORBIDDEN エラーの場合、403 を返すこと', () => {
      expect(getAuthErrorStatus({ code: 'FORBIDDEN', message: 'test' })).toBe(403)
    })
  })

  // ==============================================================
  // Error response format
  // ==============================================================
  describe('エラーレスポンス形式', () => {
    it('エラーレスポンスが統一形式であること', async () => {
      process.env.ADMIN_API_KEY = 'test-key'

      const req = new Request('http://localhost/api/test')
      const result: AuthResult = await validateAdminAuth(req)

      expect(result.authorized).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toHaveProperty('code')
      expect(result.error).toHaveProperty('message')
      expect(['UNAUTHORIZED', 'FORBIDDEN']).toContain(result.error!.code)
      expect(typeof result.error!.message).toBe('string')
    })
  })
})
