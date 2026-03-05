/**
 * 管理者認証API
 * POST: ログイン（APIキー検証 → admin-token Cookie設定）
 * DELETE: ログアウト（admin-token Cookie削除）
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/** Cookie名 */
const ADMIN_TOKEN_COOKIE = 'admin-token'

/**
 * タイミングセーフな文字列比較
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    const bufA = Buffer.from(a)
    crypto.timingSafeEqual(bufA, bufA)
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * POST /api/admin/auth — ログイン
 * Body: { apiKey: string }
 * 成功時: admin-token Cookie を設定し 200 を返す
 * 失敗時: 401 を返す
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { apiKey } = body as { apiKey?: string }

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    const adminApiKey = process.env.ADMIN_API_KEY

    if (!adminApiKey) {
      console.error('[AdminAuth] ADMIN_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!timingSafeCompare(apiKey, adminApiKey)) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }

    // 認証成功 → Cookie設定
    const response = NextResponse.json({ success: true })
    response.cookies.set(ADMIN_TOKEN_COOKIE, apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/admin',
      maxAge: 60 * 60 * 24, // 24時間
    })

    return response
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

/**
 * DELETE /api/admin/auth — ログアウト
 * admin-token Cookie を削除する
 */
export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ success: true })
  response.cookies.set(ADMIN_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: 0, // 即座に期限切れ
  })
  return response
}
