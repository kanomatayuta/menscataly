/**
 * 管理者認証 API Route
 * Supabase Auth を使用したメール/パスワード認証
 *
 * POST: ログイン (signInWithPassword)
 * DELETE: ログアウト (signOut)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient as createSSRServerClient } from '@supabase/ssr'
import { writeAdminAuditLog, extractIpFromRequest } from '@/lib/admin/audit-log'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    let response = NextResponse.json({ success: true })
    const supabase = createSSRServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      writeAdminAuditLog({
        event_type: 'login_failure',
        actor: email,
        ip_address: extractIpFromRequest(request),
        user_agent: request.headers.get('user-agent') ?? undefined,
        request_path: '/api/admin/auth',
        request_method: 'POST',
        success: false,
        failure_reason: error.message,
        http_status: 401,
      })
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    writeAdminAuditLog({
      event_type: 'login_success',
      actor: email,
      ip_address: extractIpFromRequest(request),
      user_agent: request.headers.get('user-agent') ?? undefined,
      request_path: '/api/admin/auth',
      request_method: 'POST',
      success: true,
      http_status: 200,
    })

    return response
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    )
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.json({ success: true })
  const supabase = createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )
  await supabase.auth.signOut()

  writeAdminAuditLog({
    event_type: 'logout',
    ip_address: extractIpFromRequest(request),
    user_agent: request.headers.get('user-agent') ?? undefined,
    request_path: '/api/admin/auth',
    request_method: 'DELETE',
    success: true,
    http_status: 200,
  })

  return response
}
