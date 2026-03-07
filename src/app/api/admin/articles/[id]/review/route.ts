/**
 * /api/admin/articles/[id]/review
 * PATCH: 記事のレビュー (承認/却下) — 既存
 * POST:  レビュー送信 (approve/reject/revision) with コメント
 * GET:   レビュー履歴取得
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { withRateLimit } from '@/lib/admin/rate-limit'
import type { ReviewComment } from '@/types/admin'

// ============================================================
// インメモリストア (Supabase未設定時のフォールバック)
// ============================================================

const inMemoryReviewHistory = new Map<string, ReviewComment[]>()

// デフォルトのモック履歴を初期化する
function getReviewHistory(articleId: string): ReviewComment[] {
  if (!inMemoryReviewHistory.has(articleId)) {
    inMemoryReviewHistory.set(articleId, [])
  }
  return inMemoryReviewHistory.get(articleId)!
}

// ============================================================
// リクエスト型
// ============================================================

interface ReviewPatchRequest {
  action: 'approve' | 'reject'
  notes?: string
}

interface ReviewPostRequest {
  action: 'approve' | 'reject' | 'revision'
  comment: string
  author?: string
}

// ============================================================
// GET: レビュー履歴取得
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Article ID is required' },
      { status: 400 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const history = getReviewHistory(id)
    return NextResponse.json({
      articleId: id,
      reviews: history,
      total: history.length,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('article_review_comments')
      .select('*')
      .eq('article_id', id)
      .order('created_at', { ascending: false })

    if (error) {
      // テーブルが存在しない場合 (42P01: undefined_table) は空配列にフォールバック
      const pgCode = (error as { code?: string }).code
      if (pgCode === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[admin/articles/review] article_review_comments table not found, returning empty array')
        return NextResponse.json({
          articleId: id,
          reviews: [],
          total: 0,
        })
      }
      console.error('[admin/articles/review] GET error:', error.message)
      return NextResponse.json(
        { error: 'Failed to query review history' },
        { status: 500 }
      )
    }

    const reviews: ReviewComment[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      author: (row.author as string) ?? 'admin',
      content: (row.content as string) ?? '',
      action: row.action as ReviewComment['action'],
      createdAt: row.created_at as string,
    }))

    return NextResponse.json({
      articleId: id,
      reviews,
      total: reviews.length,
    })
  } catch (err) {
    console.error('[admin/articles/review] GET error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: レビュー送信 (approve/reject/revision) with コメント
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = withRateLimit(request, 'admin:articles:review:post')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Article ID is required' },
      { status: 400 }
    )
  }

  let body: ReviewPostRequest
  try {
    body = (await request.json()) as ReviewPostRequest
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

  if (!body.comment || body.comment.trim().length === 0) {
    return NextResponse.json(
      { error: 'comment is required' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()
  const reviewComment: ReviewComment = {
    id: crypto.randomUUID(),
    author: body.author ?? 'admin',
    content: body.comment.trim(),
    action: body.action,
    createdAt: now,
  }

  // マップ: action → article status
  const statusMap: Record<string, string> = {
    approve: 'approved',
    reject: 'rejected',
    revision: 'revision',
  }
  const newStatus = statusMap[body.action]

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // フォールバック: インメモリ
    const history = getReviewHistory(id)
    history.unshift(reviewComment)

    return NextResponse.json({
      success: true,
      articleId: id,
      review: reviewComment,
      newStatus,
      message: `Review submitted: ${body.action} (dry-run)`,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // 1. レビューコメントを保存
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: commentError } = await (supabase as any)
      .from('article_review_comments')
      .insert({
        id: reviewComment.id,
        article_id: id,
        author: reviewComment.author,
        content: reviewComment.content,
        action: reviewComment.action,
        created_at: now,
      })

    if (commentError) {
      console.error('[admin/articles/review] Comment insert error:', commentError.message)
      return NextResponse.json(
        { error: 'Failed to save review comment' },
        { status: 500 }
      )
    }

    // 2. article_review_queue のステータスを更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: queueError } = await (supabase as any)
      .from('article_review_queue')
      .update({
        status: newStatus,
        reviewed_at: now,
        reviewed_by: reviewComment.author,
        review_notes: reviewComment.content,
      })
      .eq('article_id', id)

    if (queueError) {
      console.error('[admin/articles/review] Queue update error:', queueError.message)
      // コメントは保存済みなのでエラーログのみ
    }

    // 3. 承認時は記事ステータスも更新
    if (body.action === 'approve') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('articles')
        .update({ status: 'published', updated_at: now })
        .eq('id', id)
    } else if (body.action === 'reject') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('articles')
        .update({ status: 'draft', updated_at: now })
        .eq('id', id)
    }

    return NextResponse.json({
      success: true,
      articleId: id,
      review: reviewComment,
      newStatus,
      message: `Review submitted: ${body.action}`,
    })
  } catch (err) {
    console.error('[admin/articles/review] POST error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH: 記事のレビュー (承認/却下) — 既存互換
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = withRateLimit(request, 'admin:articles:review:patch')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
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

  let body: ReviewPatchRequest
  try {
    body = (await request.json()) as ReviewPatchRequest
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
