/**
 * GET /api/admin/audit-log
 * 管理者認証監査ログビューアー
 *
 * Query params:
 *   event_type  — フィルタ: login_success | login_failure | logout | session_expired | unauthorized_access
 *   success     — フィルタ: true | false
 *   ip_address  — フィルタ: IPアドレス (部分一致)
 *   from        — 開始日時 (ISO 8601)
 *   to          — 終了日時 (ISO 8601)
 *   limit       — 取得件数 (default: 50, max: 200)
 *   offset      — オフセット (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { createServerSupabaseClient } from '@/lib/supabase/client'
import type { AdminAuditEventType } from '@/lib/admin/audit-log'

// ============================================================
// 定数
// ============================================================

const VALID_EVENT_TYPES: AdminAuditEventType[] = [
  'login_success',
  'login_failure',
  'logout',
  'session_expired',
  'unauthorized_access',
]

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

// ============================================================
// Route Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 認証チェック
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    const status = auth.error ? getAuthErrorStatus(auth.error) : 401
    return NextResponse.json({ error: auth.error }, { status })
  }

  try {
    const { searchParams } = new URL(request.url)

    // パラメータ解析
    const eventType = searchParams.get('event_type') as AdminAuditEventType | null
    const successParam = searchParams.get('success')
    const ipAddress = searchParams.get('ip_address')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')
    const limitParam = Math.min(
      Math.max(parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    )
    const offsetParam = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

    // event_type バリデーション
    if (eventType && !VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid event_type. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // クエリ構築
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offsetParam, offsetParam + limitParam - 1)

    // フィルタ適用
    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    if (successParam !== null) {
      query = query.eq('success', successParam === 'true')
    }

    if (ipAddress) {
      // INET型のテキスト表現での部分一致
      query = query.ilike('ip_address::text', `%${ipAddress}%`)
    }

    if (fromDate) {
      query = query.gte('created_at', fromDate)
    }

    if (toDate) {
      query = query.lte('created_at', toDate)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[admin/audit-log] Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to retrieve audit logs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
    })
  } catch (err) {
    console.error('[admin/audit-log] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
