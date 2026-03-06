/**
 * レート制限 基盤
 * インメモリのスライディングウィンドウ方式
 *
 * Phase 3b:
 * - IP or APIキー単位でのレート制限
 * - デフォルト: 60リクエスト/分
 * - Admin APIルートで使用可能なミドルウェアヘルパー
 */

import { NextResponse } from 'next/server'

// ============================================================
// 型定義
// ============================================================

export interface RateLimitConfig {
  /** ウィンドウサイズ (ミリ秒) — デフォルト: 60000 (1分) */
  windowMs: number
  /** ウィンドウ内の最大リクエスト数 — デフォルト: 60 */
  maxRequests: number
}

export interface RateLimitResult {
  /** リクエストが許可されたか */
  allowed: boolean
  /** 残りのリクエスト数 */
  remaining: number
  /** ウィンドウのリセットまでの時間 (ミリ秒) */
  resetMs: number
  /** 最大リクエスト数 */
  limit: number
  /** リトライまでの推奨待機時間 (秒) — 拒否時のみ */
  retryAfterSeconds?: number
}

// ============================================================
// スライディングウィンドウ エントリ
// ============================================================

interface WindowEntry {
  /** リクエストのタイムスタンプ配列 */
  timestamps: number[]
}

// ============================================================
// RateLimiter クラス
// ============================================================

export class RateLimiter {
  private config: RateLimitConfig
  private windows: Map<string, WindowEntry>
  private cleanupInterval: ReturnType<typeof setInterval> | null = null

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs ?? 60_000,
      maxRequests: config.maxRequests ?? 60,
    }
    this.windows = new Map()

    // 5分ごとに古いエントリをクリーンアップ
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60_000)
      // Node.js 環境でプロセス終了を妨げない
      if (this.cleanupInterval && 'unref' in this.cleanupInterval) {
        this.cleanupInterval.unref()
      }
    }
  }

  /**
   * リクエストをチェックし、レート制限結果を返す
   * @param key 識別キー (IP / APIキー / ユーザーID など)
   */
  check(key: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    // エントリを取得、なければ作成
    let entry = this.windows.get(key)
    if (!entry) {
      entry = { timestamps: [] }
      this.windows.set(key, entry)
    }

    // ウィンドウ外のタイムスタンプを削除
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart)

    const currentCount = entry.timestamps.length
    const remaining = Math.max(0, this.config.maxRequests - currentCount)

    // 最も古いタイムスタンプに基づいてリセット時間を計算
    const oldestInWindow = entry.timestamps[0]
    const resetMs = oldestInWindow
      ? Math.max(0, oldestInWindow + this.config.windowMs - now)
      : this.config.windowMs

    if (currentCount >= this.config.maxRequests) {
      // レート制限超過
      const retryAfterSeconds = Math.ceil(resetMs / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetMs,
        limit: this.config.maxRequests,
        retryAfterSeconds,
      }
    }

    // リクエストを許可、タイムスタンプを記録
    entry.timestamps.push(now)

    return {
      allowed: true,
      remaining: remaining - 1,
      resetMs,
      limit: this.config.maxRequests,
    }
  }

  /**
   * 古いエントリをクリーンアップする
   */
  private cleanup(): void {
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    for (const [key, entry] of this.windows.entries()) {
      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart)
      if (entry.timestamps.length === 0) {
        this.windows.delete(key)
      }
    }
  }

  /**
   * カウンタをインクリメントせずにレート制限状態を取得する
   * レスポンスヘッダー付与など、副作用なしで状態確認したい場合に使用
   * @param key 識別キー (IP / APIキー / ユーザーID など)
   */
  peek(key: string): RateLimitResult {
    const now = Date.now()
    const windowStart = now - this.config.windowMs

    const entry = this.windows.get(key)
    if (!entry) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetMs: this.config.windowMs,
        limit: this.config.maxRequests,
      }
    }

    // ウィンドウ内のタイムスタンプだけをカウント (配列自体は変更しない)
    const activeTimestamps = entry.timestamps.filter(ts => ts > windowStart)
    const currentCount = activeTimestamps.length
    const remaining = Math.max(0, this.config.maxRequests - currentCount)

    const oldestInWindow = activeTimestamps[0]
    const resetMs = oldestInWindow
      ? Math.max(0, oldestInWindow + this.config.windowMs - now)
      : this.config.windowMs

    if (currentCount >= this.config.maxRequests) {
      const retryAfterSeconds = Math.ceil(resetMs / 1000)
      return {
        allowed: false,
        remaining: 0,
        resetMs,
        limit: this.config.maxRequests,
        retryAfterSeconds,
      }
    }

    return {
      allowed: true,
      remaining,
      resetMs,
      limit: this.config.maxRequests,
    }
  }

  /**
   * 指定キーのウィンドウをリセットする
   */
  reset(key: string): void {
    this.windows.delete(key)
  }

  /**
   * 全エントリをクリアする
   */
  clear(): void {
    this.windows.clear()
  }

  /**
   * クリーンアップインターバルを停止する
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.windows.clear()
  }

  /**
   * 現在の追跡中キー数を返す (テスト/モニタリング用)
   */
  get size(): number {
    return this.windows.size
  }
}

// ============================================================
// シングルトンインスタンス
// ============================================================

/** Admin API 用のデフォルトレート制限 (60リクエスト/分) */
const defaultAdminLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
})

// ============================================================
// リクエストからキーを抽出するヘルパー
// ============================================================

/**
 * リクエストからレート制限キーを抽出する
 * 1. Authorization ヘッダーの API キーを優先
 * 2. X-Forwarded-For ヘッダー（リバースプロキシ経由）
 * 3. 不明な場合は 'unknown' にフォールバック
 */
export function extractRateLimitKey(request: Request): string {
  // API キーがあればそれをキーにする
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match) {
      // API キーのハッシュは不要（インメモリなので安全）
      return `apikey:${match[1].slice(0, 16)}`
    }
  }

  const adminKey = request.headers.get('X-Admin-Api-Key')
  if (adminKey) {
    return `apikey:${adminKey.slice(0, 16)}`
  }

  // IP アドレスを使用
  const forwarded = request.headers.get('X-Forwarded-For')
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim()
    return `ip:${ip}`
  }

  const realIp = request.headers.get('X-Real-IP')
  if (realIp) {
    return `ip:${realIp}`
  }

  return 'unknown'
}

// ============================================================
// ミドルウェアヘルパー
// ============================================================

/**
 * Admin API ルート用のレート制限チェック
 * NextResponse を返す場合はレート制限超過（429を返す）
 * null を返す場合はリクエスト許可
 *
 * 使用例:
 * ```ts
 * import { checkAdminRateLimit } from '@/lib/admin/rate-limit'
 *
 * export async function GET(request: NextRequest) {
 *   const rateLimitResponse = checkAdminRateLimit(request)
 *   if (rateLimitResponse) return rateLimitResponse
 *   // ... 通常の処理
 * }
 * ```
 */
export function checkAdminRateLimit(
  request: Request,
  limiter: RateLimiter = defaultAdminLimiter
): Response | null {
  const key = extractRateLimitKey(request)
  const result = limiter.check(key)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `レート制限超過: ${result.limit}リクエスト/${defaultAdminLimiter === limiter ? '分' : 'ウィンドウ'}`,
        retryAfterSeconds: result.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(result.retryAfterSeconds ?? 60),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000 + (result.resetMs / 1000))),
        },
      }
    )
  }

  return null
}

/**
 * レート制限ヘッダーをレスポンスに追加するヘルパー
 * 許可されたリクエストのレスポンスに X-RateLimit-* ヘッダーを付与する
 */
export function addRateLimitHeaders(
  headers: Headers,
  request: Request,
  limiter: RateLimiter = defaultAdminLimiter
): void {
  const key = extractRateLimitKey(request)
  const result = limiter.peek(key)

  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000 + (result.resetMs / 1000))))
}

// ============================================================
// withRateLimit ヘルパー
// ============================================================

/**
 * Admin API ルートに簡易にレート制限を適用するヘルパー関数
 *
 * レート制限を超過した場合は 429 NextResponse を返す。
 * 超過していない場合は null を返すため、呼び出し元で early return として使用する。
 *
 * @param request リクエストオブジェクト
 * @param identifier オプションの識別子。指定した場合、extractRateLimitKey の結果にプレフィックスとして追加される。
 *                   ルートごとに独立したレート制限を実現したい場合に使用する。
 * @param limiter カスタム RateLimiter インスタンス (省略時はデフォルトの 60req/min)
 * @returns レート制限超過時は 429 NextResponse、許可時は null
 *
 * 使用例:
 * ```ts
 * import { withRateLimit } from '@/lib/admin/rate-limit'
 *
 * export async function POST(request: NextRequest) {
 *   const rateLimited = withRateLimit(request, 'admin:asp:post')
 *   if (rateLimited) return rateLimited
 *   // ... 通常の処理
 * }
 * ```
 */
export function withRateLimit(
  request: Request,
  identifier?: string,
  limiter: RateLimiter = defaultAdminLimiter
): NextResponse | null {
  const baseKey = extractRateLimitKey(request)
  const key = identifier ? `${identifier}:${baseKey}` : baseKey
  const result = limiter.check(key)

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `レート制限超過: ${result.limit}リクエスト/${defaultAdminLimiter === limiter ? '分' : 'ウィンドウ'}`,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds ?? 60),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000 + (result.resetMs / 1000))),
        },
      }
    )
  }

  return null
}
