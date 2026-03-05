/**
 * /api/admin/audit-log
 * GET: 監査ログ一覧取得 (フィルタ・ページネーション付き)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'

// ============================================================
// ilike エスケープ (SQL インジェクション防止)
// ============================================================

function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&')
}

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
  const tableName = searchParams.get('table') ?? undefined
  const operation = searchParams.get('operation') ?? undefined
  const search = searchParams.get('q') ?? undefined

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

    // Supabase クエリ構築
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('audit_log')
      .select('*', { count: 'exact' })

    // フィルタ適用
    if (tableName) {
      query = query.eq('table_name', tableName)
    }
    if (operation) {
      query = query.eq('operation', operation.toUpperCase())
    }
    if (search) {
      query = query.ilike('changed_by', `%${escapeIlike(search)}%`)
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

    return NextResponse.json({
      data: data ?? [],
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
