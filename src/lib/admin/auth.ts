/**
 * 管理者認証ヘルパー
 * Authorization: Bearer <key> ヘッダーをサポート（X-Admin-Api-Key もフォールバック）
 * Pipeline API 認証も統合
 */

import crypto from 'crypto'

// ============================================================
// エラーコード
// ============================================================

export type AuthErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN'

export interface AuthError {
  code: AuthErrorCode
  message: string
}

export interface AuthResult {
  authorized: boolean
  error?: AuthError
}

// ============================================================
// タイミングセーフ比較
// ============================================================

/**
 * タイミングセーフな文字列比較
 * タイミング攻撃を防止するために crypto.timingSafeEqual を使用
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // 長さが異なる場合でもタイミング攻撃を防ぐため
    // ダミー比較を実行してから false を返す
    const bufA = Buffer.from(a)
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// ============================================================
// ヘッダーからAPIキーを抽出
// ============================================================

/**
 * リクエストヘッダーからAPIキーを抽出する
 * 1. Authorization: Bearer <key> を優先
 * 2. X-Admin-Api-Key にフォールバック (admin用)
 * 3. X-Pipeline-Api-Key にフォールバック (pipeline用)
 */
function extractApiKey(request: Request, fallbackHeader: string): string | null {
  // Authorization: Bearer <key> を優先
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match) {
      return match[1]
    }
  }

  // フォールバックヘッダー
  return request.headers.get(fallbackHeader)
}

// ============================================================
// 管理者認証
// ============================================================

/**
 * 管理者APIリクエストを認証する
 *
 * - ADMIN_API_KEY が設定されている場合: ヘッダーと照合 (timing-safe)
 * - 開発環境 + ADMIN_API_KEY 未設定: 認証をバイパス
 * - 本番環境 + ADMIN_API_KEY 未設定: 認証失敗
 */
export function validateAdminAuth(request: Request): AuthResult {
  const adminApiKey = process.env.ADMIN_API_KEY

  // 開発環境でAPIキーが未設定の場合はバイパス
  if (!adminApiKey && process.env.NODE_ENV === 'development') {
    return { authorized: true }
  }

  if (!adminApiKey) {
    console.error('[AdminAuth] ADMIN_API_KEY is not configured')
    return {
      authorized: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Server configuration error: ADMIN_API_KEY not set',
      },
    }
  }

  const providedKey = extractApiKey(request, 'X-Admin-Api-Key')

  if (!providedKey) {
    return {
      authorized: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized: Missing authentication credentials',
      },
    }
  }

  if (!timingSafeCompare(providedKey, adminApiKey)) {
    return {
      authorized: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized: Invalid API key',
      },
    }
  }

  return { authorized: true }
}

// ============================================================
// Pipeline認証
// ============================================================

/**
 * パイプラインAPIリクエストを認証する
 *
 * - PIPELINE_API_KEY が設定されている場合: ヘッダーと照合 (timing-safe)
 * - CRON_SECRET が設定されている場合: CRON_SECRET でも認証を許可
 * - 開発環境 + PIPELINE_API_KEY 未設定: 認証をバイパス
 * - 本番環境 + PIPELINE_API_KEY 未設定: 認証失敗
 */
export function validatePipelineAuth(request: Request): AuthResult {
  const apiKey = process.env.PIPELINE_API_KEY
  const cronSecret = process.env.CRON_SECRET

  if (!apiKey && !cronSecret) {
    if (process.env.NODE_ENV === 'development') {
      return { authorized: true }
    }
    console.error('[PipelineAuth] PIPELINE_API_KEY is not configured')
    return {
      authorized: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Server configuration error: PIPELINE_API_KEY not set',
      },
    }
  }

  const providedKey = extractApiKey(request, 'X-Pipeline-Api-Key')

  if (!providedKey) {
    return {
      authorized: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized: Missing authentication credentials',
      },
    }
  }

  // PIPELINE_API_KEY で照合
  if (apiKey && timingSafeCompare(providedKey, apiKey)) {
    return { authorized: true }
  }

  // CRON_SECRET で照合 (Vercel Cron Jobs 用)
  if (cronSecret && timingSafeCompare(providedKey, cronSecret)) {
    return { authorized: true }
  }

  return {
    authorized: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Unauthorized: Invalid API key',
    },
  }
}

// ============================================================
// Cron認証
// ============================================================

/**
 * Vercel Cron Jobs のリクエストを認証する
 *
 * - CRON_SECRET が設定されている場合: Authorization: Bearer <CRON_SECRET> を照合
 * - 開発環境 + CRON_SECRET 未設定: 認証をバイパス
 * - 本番環境 + CRON_SECRET 未設定: 認証失敗
 */
export function validateCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    if (process.env.NODE_ENV === 'development') {
      return true
    }
    console.error('[CronAuth] CRON_SECRET is not configured')
    return false
  }

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return false
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return false
  }

  return timingSafeCompare(match[1], cronSecret)
}

// ============================================================
// レスポンスヘルパー
// ============================================================

/**
 * 認証失敗レスポンスのHTTPステータスコードを取得する
 */
export function getAuthErrorStatus(error: AuthError): number {
  switch (error.code) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    default:
      return 401
  }
}
