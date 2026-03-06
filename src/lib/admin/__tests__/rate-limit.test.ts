/**
 * レート制限 ユニットテスト
 * Phase 3b: スライディングウィンドウ方式、ミドルウェアヘルパー
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { RateLimiter, extractRateLimitKey, checkAdminRateLimit } from '../rate-limit'

// ============================================================
// RateLimiter クラステスト
// ============================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter

  afterEach(() => {
    limiter?.destroy()
  })

  // ----------------------------------------------------------
  // 基本動作
  // ----------------------------------------------------------

  describe('基本動作', () => {
    it('初回リクエストが許可されること', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 })
      const result = limiter.check('test-key')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
      expect(result.limit).toBe(10)
    })

    it('maxRequests以内のリクエストが全て許可されること', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 })

      for (let i = 0; i < 5; i++) {
        const result = limiter.check('test-key')
        expect(result.allowed).toBe(true)
      }
    })

    it('maxRequestsを超えたリクエストが拒否されること', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })

      // 3回は許可
      for (let i = 0; i < 3; i++) {
        expect(limiter.check('test-key').allowed).toBe(true)
      }

      // 4回目は拒否
      const result = limiter.check('test-key')
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterSeconds).toBeGreaterThan(0)
    })
  })

  // ----------------------------------------------------------
  // キー分離
  // ----------------------------------------------------------

  describe('キー分離', () => {
    it('異なるキーが独立してカウントされること', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 2 })

      // key-a: 2回消費
      expect(limiter.check('key-a').allowed).toBe(true)
      expect(limiter.check('key-a').allowed).toBe(true)
      expect(limiter.check('key-a').allowed).toBe(false)

      // key-b: まだ未消費
      expect(limiter.check('key-b').allowed).toBe(true)
    })
  })

  // ----------------------------------------------------------
  // ウィンドウスライド
  // ----------------------------------------------------------

  describe('ウィンドウスライド', () => {
    it('ウィンドウ期間経過後にリクエストが再度許可されること', () => {
      vi.useFakeTimers()
      try {
        limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 })

        // 2回消費
        expect(limiter.check('key').allowed).toBe(true)
        expect(limiter.check('key').allowed).toBe(true)
        expect(limiter.check('key').allowed).toBe(false)

        // 1秒後
        vi.advanceTimersByTime(1001)

        // 再度許可される
        expect(limiter.check('key').allowed).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  // ----------------------------------------------------------
  // reset / clear
  // ----------------------------------------------------------

  describe('リセット', () => {
    it('reset() で特定キーのウィンドウがリセットされること', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })

      expect(limiter.check('key').allowed).toBe(true)
      expect(limiter.check('key').allowed).toBe(false)

      limiter.reset('key')

      expect(limiter.check('key').allowed).toBe(true)
    })

    it('clear() で全エントリがクリアされること', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })

      limiter.check('key-a')
      limiter.check('key-b')

      expect(limiter.size).toBe(2)

      limiter.clear()

      expect(limiter.size).toBe(0)
    })
  })

  // ----------------------------------------------------------
  // remaining の正確性
  // ----------------------------------------------------------

  describe('remaining カウント', () => {
    it('remaining が正しくデクリメントされること', () => {
      limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 })

      expect(limiter.check('key').remaining).toBe(4)
      expect(limiter.check('key').remaining).toBe(3)
      expect(limiter.check('key').remaining).toBe(2)
      expect(limiter.check('key').remaining).toBe(1)
      expect(limiter.check('key').remaining).toBe(0)
    })
  })
})

// ============================================================
// extractRateLimitKey テスト
// ============================================================

describe('extractRateLimitKey', () => {
  it('Authorization Bearer ヘッダーからキーを抽出すること', () => {
    const request = new Request('http://localhost', {
      headers: { Authorization: 'Bearer my-secret-api-key-here' },
    })

    const key = extractRateLimitKey(request)
    expect(key).toBe('apikey:my-secret-api-ke')
  })

  it('X-Admin-Api-Key ヘッダーからキーを抽出すること', () => {
    const request = new Request('http://localhost', {
      headers: { 'X-Admin-Api-Key': 'admin-key-12345678' },
    })

    const key = extractRateLimitKey(request)
    expect(key).toBe('apikey:admin-key-123456')
  })

  it('X-Forwarded-For ヘッダーからIPを抽出すること', () => {
    const request = new Request('http://localhost', {
      headers: { 'X-Forwarded-For': '192.168.1.100, 10.0.0.1' },
    })

    const key = extractRateLimitKey(request)
    expect(key).toBe('ip:192.168.1.100')
  })

  it('X-Real-IP ヘッダーからIPを抽出すること', () => {
    const request = new Request('http://localhost', {
      headers: { 'X-Real-IP': '203.0.113.50' },
    })

    const key = extractRateLimitKey(request)
    expect(key).toBe('ip:203.0.113.50')
  })

  it('ヘッダーがない場合は unknown を返すこと', () => {
    const request = new Request('http://localhost')
    const key = extractRateLimitKey(request)
    expect(key).toBe('unknown')
  })
})

// ============================================================
// checkAdminRateLimit テスト
// ============================================================

describe('checkAdminRateLimit', () => {
  it('制限内のリクエストでは null を返すこと', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 10 })
    const request = new Request('http://localhost', {
      headers: { Authorization: 'Bearer test-key-123' },
    })

    const result = checkAdminRateLimit(request, limiter)
    expect(result).toBeNull()

    limiter.destroy()
  })

  it('制限超過時に 429 レスポンスを返すこと', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })
    const request = new Request('http://localhost', {
      headers: { Authorization: 'Bearer test-key-123' },
    })

    // 1回消費
    checkAdminRateLimit(request, limiter)

    // 2回目は 429
    const response = checkAdminRateLimit(request, limiter)
    expect(response).not.toBeNull()
    expect(response!.status).toBe(429)

    limiter.destroy()
  })

  it('429 レスポンスに Retry-After ヘッダーが含まれること', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })
    const request = new Request('http://localhost', {
      headers: { Authorization: 'Bearer test-key-123' },
    })

    checkAdminRateLimit(request, limiter)
    const response = checkAdminRateLimit(request, limiter)

    expect(response).not.toBeNull()
    expect(response!.headers.get('Retry-After')).toBeTruthy()
    expect(response!.headers.get('X-RateLimit-Limit')).toBe('1')
    expect(response!.headers.get('X-RateLimit-Remaining')).toBe('0')

    limiter.destroy()
  })

  it('429 レスポンスの JSON body が正しいフォーマットであること', async () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })
    const request = new Request('http://localhost', {
      headers: { Authorization: 'Bearer test-key-123' },
    })

    checkAdminRateLimit(request, limiter)
    const response = checkAdminRateLimit(request, limiter)

    expect(response).not.toBeNull()
    const body = await response!.json()
    expect(body.error).toBe('Too Many Requests')
    expect(body.retryAfterSeconds).toBeGreaterThan(0)

    limiter.destroy()
  })
})
