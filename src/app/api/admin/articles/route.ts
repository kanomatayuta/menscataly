/**
 * /api/admin/articles
 * GET: 記事一覧取得 (フィルタ付き)
 * POST: 記事ステータス更新
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { ArticleReviewItem } from '@/types/admin'

// ============================================================
// モックデータ
// ============================================================

function getMockArticles(): ArticleReviewItem[] {
  return [
    {
      id: 'review-1',
      articleId: 'article-1',
      microcmsId: null,
      title: 'AGA治療の費用相場と選び方ガイド',
      slug: 'aga-treatment-cost-guide',
      category: 'aga',
      complianceScore: 96.5,
      status: 'pending',
      authorName: 'MENS CATALY 編集部',
      generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
    },
    {
      id: 'review-2',
      articleId: 'article-2',
      microcmsId: 'mc-article-2',
      title: 'メンズ医療脱毛おすすめクリニック比較',
      slug: 'mens-hair-removal-comparison',
      category: 'hair-removal',
      complianceScore: 98.0,
      status: 'approved',
      authorName: 'MENS CATALY 編集部',
      generatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      reviewedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      reviewedBy: 'admin',
      reviewNotes: null,
    },
  ]
}

// ============================================================
// GET: 記事一覧
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    let articles = getMockArticles()
    if (status) articles = articles.filter((a) => a.status === status)
    if (category) articles = articles.filter((a) => a.category === category)
    return NextResponse.json({
      articles: articles.slice(offset, offset + limit),
      total: articles.length,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('article_review_queue')
      .select('*', { count: 'exact' })
      .order('generated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq('status', status)
    if (category) query = query.eq('category', category)

    const { data, error, count } = await query

    if (error) {
      console.error('[admin/articles] Query error:', error.message)
      return NextResponse.json(
        { error: 'Failed to query articles' },
        { status: 500 }
      )
    }

    const articles: ArticleReviewItem[] = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      articleId: row.article_id,
      microcmsId: row.microcms_id ?? null,
      title: row.title,
      slug: row.slug,
      category: row.category,
      complianceScore: parseFloat(String(row.compliance_score ?? '0')),
      status: row.status,
      authorName: row.author_name ?? 'MENS CATALY 編集部',
      generatedAt: row.generated_at,
      reviewedAt: row.reviewed_at ?? null,
      reviewedBy: row.reviewed_by ?? null,
      reviewNotes: row.review_notes ?? null,
    }))

    return NextResponse.json({ articles, total: count ?? 0 })
  } catch (err) {
    console.error('[admin/articles] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: 記事ステータス更新
// ============================================================

interface UpdateStatusRequest {
  articleId: string
  status: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  let body: UpdateStatusRequest
  try {
    body = (await request.json()) as UpdateStatusRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.articleId || !body.status) {
    return NextResponse.json(
      { error: 'articleId and status are required' },
      { status: 400 }
    )
  }

  const validStatuses = ['draft', 'published', 'review', 'archived']
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      success: true,
      message: `Article ${body.articleId} status updated to ${body.status} (dry-run)`,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('articles')
      .update({
        status: body.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.articleId)

    if (error) {
      console.error('[admin/articles] Update error:', error.message)
      return NextResponse.json(
        { error: 'Failed to update article status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Article ${body.articleId} status updated to ${body.status}`,
    })
  } catch (err) {
    console.error('[admin/articles] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
