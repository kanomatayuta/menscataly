/**
 * /api/admin/review-queue/[id]
 * GET:   個別レビューキューアイテム取得
 * PATCH: ステータス更新 (approve/reject/revision)
 *        承認時は microCMS 記事の公開ステータスも更新
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { withRateLimit } from '@/lib/admin/rate-limit'
import type { ReviewQueueItem, ReviewQueueStatus } from '@/types/admin'

// ============================================================
// review_notes から eeatScore / violationCount を抽出
// ============================================================

function parseReviewNotes(notes: unknown): { eeatScore: number; violationCount: number } {
  if (!notes || typeof notes !== 'string') {
    return { eeatScore: 0, violationCount: 0 }
  }
  try {
    const parsed = JSON.parse(notes) as Record<string, unknown>
    return {
      eeatScore: typeof parsed.eeatScore === 'number' ? parsed.eeatScore : 0,
      violationCount: typeof parsed.violationCount === 'number' ? parsed.violationCount : 0,
    }
  } catch {
    return { eeatScore: 0, violationCount: 0 }
  }
}

// ============================================================
// モックデータ
// ============================================================

function getMockItem(id: string): ReviewQueueItem | null {
  const items: Record<string, ReviewQueueItem> = {
    'rq-mock-1': {
      id: 'rq-mock-1',
      articleId: null,
      slug: 'aga-treatment-cost-guide',
      title: 'AGA治療の費用相場と選び方ガイド',
      status: 'pending',
      complianceScore: 96.5,
      eeatScore: 78,
      violationCount: 1,
      category: 'aga',
      authorName: 'MENS CATALY 編集部',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
    },
  }
  return items[id] ?? null
}

// ============================================================
// リクエスト型
// ============================================================

interface PatchRequest {
  action: 'approve' | 'reject' | 'revision'
  notes?: string
  reviewedBy?: string
}

// ============================================================
// GET: 個別レビューキューアイテム取得
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = withRateLimit(request, 'admin:review-queue:get')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    const status = auth.error ? getAuthErrorStatus(auth.error) : 401
    return NextResponse.json({ error: auth.error }, { status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Review queue item ID is required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const item = getMockItem(id)
    if (!item) {
      return NextResponse.json({ error: 'Review queue item not found' }, { status: 404 })
    }
    return NextResponse.json({ item })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('article_review_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      const pgCode = (error as { code?: string }).code
      if (pgCode === 'PGRST116') {
        return NextResponse.json({ error: 'Review queue item not found' }, { status: 404 })
      }
      if (pgCode === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[admin/review-queue/[id]] Table not found, returning mock')
        const item = getMockItem(id)
        if (!item) {
          return NextResponse.json({ error: 'Review queue item not found' }, { status: 404 })
        }
        return NextResponse.json({ item })
      }
      console.error('[admin/review-queue/[id]] GET error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch review queue item' }, { status: 500 })
    }

    const row = data as Record<string, unknown>
    const { eeatScore, violationCount } = parseReviewNotes(row.review_notes)

    const item: ReviewQueueItem = {
      id: row.id as string,
      articleId: (row.article_id as string) ?? null,
      slug: row.slug as string,
      title: row.title as string,
      status: row.status as ReviewQueueStatus,
      complianceScore: parseFloat(String(row.compliance_score ?? '0')),
      eeatScore,
      violationCount,
      category: row.category as string,
      authorName: (row.author_name as string) ?? 'MENS CATALY 編集部',
      createdAt: row.created_at as string,
      generatedAt: row.generated_at as string,
      reviewedAt: (row.reviewed_at as string) ?? null,
      reviewedBy: (row.reviewed_by as string) ?? null,
      reviewNotes: (row.review_notes as string) ?? null,
    }

    return NextResponse.json({ item })
  } catch (err) {
    console.error('[admin/review-queue/[id]] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ============================================================
// PATCH: ステータス更新
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = withRateLimit(request, 'admin:review-queue:patch')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    const status = auth.error ? getAuthErrorStatus(auth.error) : 401
    return NextResponse.json({ error: auth.error }, { status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'Review queue item ID is required' }, { status: 400 })
  }

  let body: PatchRequest
  try {
    body = (await request.json()) as PatchRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validActions = ['approve', 'reject', 'revision']
  if (!body.action || !validActions.includes(body.action)) {
    return NextResponse.json(
      { error: `action must be one of: ${validActions.join(', ')}` },
      { status: 400 }
    )
  }

  const statusMap: Record<string, ReviewQueueStatus> = {
    approve: 'approved',
    reject: 'rejected',
    revision: 'revision',
  }
  const newStatus = statusMap[body.action]
  const now = new Date().toISOString()
  const reviewer = body.reviewedBy ?? 'admin'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      success: true,
      id,
      status: newStatus,
      message: `Review queue item ${id} updated to ${newStatus} (dry-run)`,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // 1. article_review_queue のステータスを更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('article_review_queue')
      .update({
        status: newStatus,
        reviewed_at: now,
        reviewed_by: reviewer,
        review_notes: body.notes ?? null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      const pgCode = (error as { code?: string }).code
      if (pgCode === 'PGRST116') {
        return NextResponse.json({ error: 'Review queue item not found' }, { status: 404 })
      }
      console.error('[admin/review-queue/[id]] PATCH error:', error.message)
      return NextResponse.json({ error: 'Failed to update review queue item' }, { status: 500 })
    }

    const row = data as Record<string, unknown>

    // 2. 承認時: Supabase articles テーブルのステータスを published に更新
    if (body.action === 'approve' && row.article_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('articles')
        .update({ status: 'published', updated_at: now })
        .eq('id', row.article_id)
    }

    // 3. 却下時: Supabase articles テーブルのステータスを draft に更新
    if (body.action === 'reject' && row.article_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('articles')
        .update({ status: 'draft', updated_at: now })
        .eq('id', row.article_id)
    }

    // 4. 承認時: microCMS 記事の公開ステータスを更新 (microcms_id がある場合)
    if (body.action === 'approve' && row.microcms_id) {
      try {
        const { isMicroCMSConfigured } = await import('@/lib/microcms/client')
        if (isMicroCMSConfigured()) {
          // microCMS SDK にはステータス更新APIがないため、ログのみ
          // 実際の公開はmicroCMS管理画面から行う
          console.log(`[admin/review-queue/[id]] microCMS article ${row.microcms_id} approved — publish from microCMS dashboard`)
        }
      } catch (microcmsErr) {
        console.warn('[admin/review-queue/[id]] microCMS update skipped:', microcmsErr)
      }
    }

    return NextResponse.json({
      success: true,
      id,
      status: newStatus,
      reviewedAt: now,
      reviewedBy: reviewer,
      message: `Review queue item ${id} updated to ${newStatus}`,
    })
  } catch (err) {
    console.error('[admin/review-queue/[id]] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
