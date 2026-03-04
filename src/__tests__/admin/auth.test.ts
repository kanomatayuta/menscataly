/**
 * Admin Auth Helper Unit Tests
 * 認証ヘルパー validateAdminAuth のテスト
 * 正常認証 / 不正キー / キーなし / 環境変数なし
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateAdminAuth } from '@/lib/admin/auth'

// ============================================================
// ヘルパー: テスト用リクエスト生成
// ============================================================

function createMockRequest(headers: Record<string, string> = {}): Request {
  const reqHeaders = new Headers()
  for (const [key, value] of Object.entries(headers)) {
    reqHeaders.set(key, value)
  }
  return new Request('http://localhost:3000/api/admin/test', {
    method: 'GET',
    headers: reqHeaders,
  })
}

// ============================================================
// テスト
// ============================================================

describe('validateAdminAuth', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // ============================================================
  // 正常認証
  // ============================================================

  describe('正常認証', () => {
    it('正しいAPIキーで認証が成功すること', () => {
      process.env.ADMIN_API_KEY = 'valid-secret-key-123'

      const request = createMockRequest({
        'X-Admin-Api-Key': 'valid-secret-key-123',
      })

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  // ============================================================
  // 不正キー
  // ============================================================

  describe('不正キー', () => {
    it('不正なAPIキーで認証が失敗すること', () => {
      process.env.ADMIN_API_KEY = 'valid-secret-key-123'

      const request = createMockRequest({
        'X-Admin-Api-Key': 'wrong-key',
      })

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(false)
      expect(result.error).toBe('Unauthorized: Invalid API key')
    })

    it('空文字のAPIキーで認証が失敗すること', () => {
      process.env.ADMIN_API_KEY = 'valid-secret-key-123'

      const request = createMockRequest({
        'X-Admin-Api-Key': '',
      })

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(false)
      // 空文字はHeaders.getで空文字を返すため、不一致として処理される
      expect(result.error).toBeDefined()
    })
  })

  // ============================================================
  // キーなし（ヘッダー欠如）
  // ============================================================

  describe('キーなし', () => {
    it('X-Admin-Api-Key ヘッダーがない場合に認証が失敗すること', () => {
      process.env.ADMIN_API_KEY = 'valid-secret-key-123'

      const request = createMockRequest({})

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(false)
      expect(result.error).toBe('Unauthorized: Missing X-Admin-Api-Key header')
    })
  })

  // ============================================================
  // 環境変数なし
  // ============================================================

  describe('環境変数なし', () => {
    it('本番環境でADMIN_API_KEY未設定の場合に認証が失敗すること', () => {
      delete process.env.ADMIN_API_KEY
      process.env.NODE_ENV = 'production'

      const request = createMockRequest({
        'X-Admin-Api-Key': 'any-key',
      })

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(false)
      expect(result.error).toBe('Server configuration error: ADMIN_API_KEY not set')
    })

    it('開発環境でADMIN_API_KEY未設定の場合に認証がバイパスされること', () => {
      delete process.env.ADMIN_API_KEY
      process.env.NODE_ENV = 'development'

      const request = createMockRequest({})

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('test環境でADMIN_API_KEY未設定の場合に認証が失敗すること', () => {
      delete process.env.ADMIN_API_KEY
      process.env.NODE_ENV = 'test'

      const request = createMockRequest({
        'X-Admin-Api-Key': 'any-key',
      })

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(false)
      expect(result.error).toContain('ADMIN_API_KEY not set')
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('エッジケース', () => {
    it('APIキーの大文字小文字が異なる場合に不一致として処理されること', () => {
      process.env.ADMIN_API_KEY = 'Valid-Key-123'

      const request = createMockRequest({
        'X-Admin-Api-Key': 'valid-key-123',
      })

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(false)
    })

    it('非常に長いAPIキーでも正常に比較できること', () => {
      const longKey = 'a'.repeat(1024)
      process.env.ADMIN_API_KEY = longKey

      const request = createMockRequest({
        'X-Admin-Api-Key': longKey,
      })

      const result = validateAdminAuth(request)

      expect(result.authorized).toBe(true)
    })
  })
})
