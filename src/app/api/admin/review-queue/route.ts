/**
 * /api/admin/review-queue
 * GET: レビューキュー一覧取得
 *
 * クエリパラメータ:
 *   status  — pending | approved | rejected | revision (フィルタ)
 *   page    — ページ番号 (1-based, default: 1)
 *   limit   — 1ページあたりの件数 (default: 20, max: 100)
 *   sort    — generated_at | compliance_score | title (default: generated_at)
 *   order   — asc | desc (default: desc)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { withRateLimit } from '@/lib/admin/rate-limit'
import { safeParseInt } from '@/lib/utils/safe-parse'
import type { ReviewQueueItem, ReviewQueueStatus } from '@/types/admin'

// ============================================================
// モックデータ (Supabase未設定時のフォールバック)
// ============================================================

function getMockReviewQueue(): ReviewQueueItem[] {
  return [
    {
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
    {
      id: 'rq-mock-2',
      articleId: 'article-2',
      slug: 'mens-hair-removal-comparison',
      title: 'メンズ医療脱毛おすすめクリニック比較',
      status: 'approved',
      complianceScore: 98.0,
      eeatScore: 85,
      violationCount: 0,
      category: 'hair-removal',
      authorName: 'MENS CATALY 編集部',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      reviewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      reviewedBy: 'admin',
      reviewNotes: null,
    },
    {
      id: 'rq-mock-3',
      articleId: null,
      slug: 'ed-treatment-options',
      title: 'ED治療薬の種類と選び方',
      status: 'rejected',
      complianceScore: 62.0,
      eeatScore: 45,
      violationCount: 5,
      category: 'ed',
      authorName: 'MENS CATALY 編集部',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      generatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      reviewedAt: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
      reviewedBy: 'admin',
      reviewNotes: '薬機法違反表現が複数検出されました',
    },
  ]
}

// ============================================================
// バリデーション
// ============================================================

const VALID_STATUSES: ReviewQueueStatus[] = ['pending', 'approved', 'rejected', 'revision']
const VALID_SORT_FIELDS = ['generated_at', 'compliance_score', 'title', 'created_at']
const VALID_ORDERS = ['asc', 'desc']

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
// GET: レビューキュー一覧
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // レート制限
  const rateLimited = withRateLimit(request, 'admin:review-queue:list')
  if (rateLimited) return rateLimited

  // 認証
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    const status = auth.error ? getAuthErrorStatus(auth.error) : 401
    return NextResponse.json({ error: auth.error }, { status })
  }

  // クエリパラメータ
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const page = safeParseInt(searchParams.get('page'), 1, 1, 1000)
  const limit = safeParseInt(searchParams.get('limit'), 20, 1, 100)
  const sort = searchParams.get('sort') ?? 'generated_at'
  const order = searchParams.get('order') ?? 'desc'

  // バリデーション
  if (statusFilter && !VALID_STATUSES.includes(statusFilter as ReviewQueueStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }
  if (!VALID_SORT_FIELDS.includes(sort)) {
    return NextResponse.json(
      { error: `sort must be one of: ${VALID_SORT_FIELDS.join(', ')}` },
      { status: 400 }
    )
  }
  if (!VALID_ORDERS.includes(order)) {
    return NextResponse.json(
      { error: `order must be one of: ${VALID_ORDERS.join(', ')}` },
      { status: 400 }
    )
  }

  const offset = (page - 1) * limit

  // Supabase未設定時のフォールバック
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    let items = getMockReviewQueue()
    if (statusFilter) {
      items = items.filter((item) => item.status === statusFilter)
    }
    const total = items.length
    const paged = items.slice(offset, offset + limit)
    return NextResponse.json({ items: paged, total, page, limit })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('article_review_queue')
      .select('*', { count: 'exact' })
      .order(sort, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1)

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error, count } = await query

    if (error) {
      // テーブルが存在しない場合はモックにフォールバック
      const pgCode = (error as { code?: string }).code
      if (pgCode === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[admin/review-queue] article_review_queue table not found, returning mock data')
        const items = getMockReviewQueue()
        return NextResponse.json({ items, total: items.length, page, limit })
      }
      console.error('[admin/review-queue] Query error:', error.message)
      return NextResponse.json(
        { error: 'Failed to query review queue' },
        { status: 500 }
      )
    }

    const items: ReviewQueueItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const { eeatScore, violationCount } = parseReviewNotes(row.review_notes)
      return {
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
    })

    return NextResponse.json({
      items,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    console.error('[admin/review-queue] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
