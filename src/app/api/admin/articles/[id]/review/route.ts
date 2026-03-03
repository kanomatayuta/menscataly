/**
 * PATCH /api/admin/articles/[id]/review
 * 記事のレビュー (承認/却下)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'

// ============================================================
// リクエスト型
// ============================================================

interface ReviewRequest {
  action: 'approve' | 'reject'
  notes?: string
}

// ============================================================
// Route Handler
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Article review ID is required' },
      { status: 400 }
    )
  }

  let body: ReviewRequest
  try {
    body = (await request.json()) as ReviewRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.action || !['approve', 'reject'].includes(body.action)) {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 }
    )
  }

  const reviewStatus = body.action === 'approve' ? 'approved' : 'rejected'
  const now = new Date().toISOString()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      success: true,
      reviewId: id,
      status: reviewStatus,
      message: `Article review ${id} ${reviewStatus} (dry-run)`,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('article_review_queue')
      .update({
        status: reviewStatus,
        reviewed_at: now,
        reviewed_by: 'admin',
        review_notes: body.notes ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[admin/articles/review] Update error:', error.message)
      return NextResponse.json(
        { error: 'Failed to update review status' },
        { status: 500 }
      )
    }

    // 承認時: 記事のステータスも published に更新
    if (body.action === 'approve' && data?.article_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('articles')
        .update({ status: 'published', updated_at: now })
        .eq('id', data.article_id)
    }

    return NextResponse.json({
      success: true,
      reviewId: id,
      status: reviewStatus,
      message: `Article review ${id} ${reviewStatus}`,
    })
  } catch (err) {
    console.error('[admin/articles/review] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
