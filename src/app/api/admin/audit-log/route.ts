/**
 * /api/admin/audit-log
 * GET: 管理者認証監査ログ一覧取得 (フィルタ・ページネーション付き)
 *
 * テーブル: admin_audit_log (Migration 005)
 * カラム: id, event_type, actor, ip_address, user_agent, request_path,
 *         request_method, success, failure_reason, http_status, metadata, created_at
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'

// ============================================================
// GET: 監査ログ一覧取得
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  const limitNum = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const offsetNum = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)
  const eventType = searchParams.get('event_type') ?? undefined
  const fromDate = searchParams.get('from') ?? undefined
  const toDate = searchParams.get('to') ?? undefined
  const successParam = searchParams.get('success') ?? undefined

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      data: [],
      total: 0,
      limit: limitNum,
      offset: offsetNum,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // Supabase クエリ構築: admin_audit_log テーブル
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('admin_audit_log')
      .select('*', { count: 'exact' })

    // フィルタ適用
    if (eventType) {
      query = query.eq('event_type', eventType)
    }
    if (fromDate) {
      query = query.gte('created_at', `${fromDate}T00:00:00+09:00`)
    }
    if (toDate) {
      query = query.lte('created_at', `${toDate}T23:59:59+09:00`)
    }
    if (successParam === 'false') {
      query = query.eq('success', false)
    }

    // ソート (新しい順)
    query = query.order('created_at', { ascending: false })

    // ページネーション
    query = query.range(offsetNum, offsetNum + limitNum - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[admin/audit-log] Query error:', error.message)
      return NextResponse.json(
        { error: 'Failed to query audit log' },
        { status: 500 }
      )
    }

    // DB カラム名 → フロントエンド用にマッピング
    const entries = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      created_at: row.created_at,
      event_type: row.event_type,
      actor: row.actor,
      ip_address: row.ip_address ? String(row.ip_address) : null,
      user_agent: row.user_agent,
      path: row.request_path,
      status_code: row.http_status,
      failure_reason: row.failure_reason,
      success: row.success,
    }))

    return NextResponse.json({
      data: entries,
      total: count ?? 0,
      limit: limitNum,
      offset: offsetNum,
    })
  } catch (err) {
    console.error('[admin/audit-log] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
