// 記事一覧 API
// GET /api/articles
//
// クエリパラメータ:
//   category  — カテゴリスラッグでフィルタ (e.g. '?category=aga')
//   limit     — 取得件数 (デフォルト: 10, 最大: 100)
//   offset    — スキップ件数 (デフォルト: 0)

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/client'
import { withRateLimit } from '@/lib/admin/rate-limit'

export async function GET(req: NextRequest) {
  const rl = await withRateLimit(req, 'public:articles')
  if (rl) return rl

  const { searchParams } = req.nextUrl

  // ── クエリパラメータ解析 ─────────────────────────────────────
  const category = searchParams.get('category') ?? undefined

  const rawLimit = Number(searchParams.get('limit') ?? '10')
  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, 100)   // 最大100件
    : 10

  const rawOffset = Number(searchParams.get('offset') ?? '0')
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  // ── Supabase クエリ ──────────────────────────────────────────
  const supabase = createServerSupabaseClient()

  let query = supabase
    .from('articles')
    .select(
      'id, slug, title, excerpt, category, category_id, status, seo_title, seo_description, author_name, quality_score, pv_count, published_at, created_at, updated_at',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('[api/articles] Supabase error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    articles: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  })
}
