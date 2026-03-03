/**
 * 管理者認証ヘルパー
 * X-Admin-Api-Key ヘッダーによるAPI認証
 */

/**
 * 管理者APIリクエストを認証する
 *
 * - ADMIN_API_KEY が設定されている場合: X-Admin-Api-Key ヘッダーと照合
 * - 開発環境 + ADMIN_API_KEY 未設定: 認証をバイパス
 * - 本番環境 + ADMIN_API_KEY 未設定: 認証失敗
 */
export function validateAdminAuth(request: Request): {
  authorized: boolean
  error?: string
} {
  const adminApiKey = process.env.ADMIN_API_KEY

  // 開発環境でAPIキーが未設定の場合はバイパス
  if (!adminApiKey && process.env.NODE_ENV === 'development') {
    return { authorized: true }
  }

  if (!adminApiKey) {
    console.error('[AdminAuth] ADMIN_API_KEY is not configured')
    return {
      authorized: false,
      error: 'Server configuration error: ADMIN_API_KEY not set',
    }
  }

  const providedKey = request.headers.get('X-Admin-Api-Key')

  if (!providedKey) {
    return {
      authorized: false,
      error: 'Unauthorized: Missing X-Admin-Api-Key header',
    }
  }

  if (providedKey !== adminApiKey) {
    return {
      authorized: false,
      error: 'Unauthorized: Invalid API key',
    }
  }

  return { authorized: true }
}
