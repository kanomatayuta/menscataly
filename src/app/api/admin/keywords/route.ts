/**
 * /api/admin/keywords
 * GET:  キーワード一覧取得 (フィルタ付き)
 * POST: キーワード新規追加
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import {
  type KeywordEntry,
  type KeywordFilter,
  createKeywordEntry,
  filterKeywords,
  validateKeywordEntry,
  getDifficultyLevel,
  estimateSearchIntent,
} from '@/lib/content/keyword-research'
import type { ContentCategory } from '@/types/content'

// ============================================================
// ilike エスケープ (SQL インジェクション防止)
// ============================================================

function escapeIlike(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&')
}

// ============================================================
// インメモリストア (Supabase未設定時のフォールバック)
// ============================================================

const inMemoryKeywords: KeywordEntry[] = []

// ============================================================
// GET: キーワード一覧取得
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  const filter: KeywordFilter = {
    category: (searchParams.get('category') as ContentCategory) ?? undefined,
    difficultyLevel: searchParams.get('difficulty') as KeywordFilter['difficultyLevel'] ?? undefined,
    searchIntent: searchParams.get('intent') as KeywordFilter['searchIntent'] ?? undefined,
    minVolume: searchParams.has('minVolume') ? parseInt(searchParams.get('minVolume')!, 10) : undefined,
    maxVolume: searchParams.has('maxVolume') ? parseInt(searchParams.get('maxVolume')!, 10) : undefined,
    minDifficulty: searchParams.has('minDifficulty') ? parseInt(searchParams.get('minDifficulty')!, 10) : undefined,
    maxDifficulty: searchParams.has('maxDifficulty') ? parseInt(searchParams.get('maxDifficulty')!, 10) : undefined,
    minTrendScore: searchParams.has('minTrendScore') ? parseInt(searchParams.get('minTrendScore')!, 10) : undefined,
    query: searchParams.get('q') ?? undefined,
    sortBy: (searchParams.get('sortBy') as KeywordFilter['sortBy']) ?? 'volume',
    sortOrder: (searchParams.get('sortOrder') as KeywordFilter['sortOrder']) ?? 'desc',
    limit: parseInt(searchParams.get('limit') ?? '50', 10),
    offset: parseInt(searchParams.get('offset') ?? '0', 10),
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // フォールバック: インメモリデータ
    const result = filterKeywords(inMemoryKeywords, filter)
    return NextResponse.json(result)
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // Supabase クエリ構築
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('keywords')
      .select('*', { count: 'exact' })

    // フィルタ適用
    if (filter.category) {
      query = query.eq('category', filter.category)
    }
    if (filter.minVolume !== undefined) {
      query = query.gte('search_volume', filter.minVolume)
    }
    if (filter.maxVolume !== undefined) {
      query = query.lte('search_volume', filter.maxVolume)
    }
    if (filter.minDifficulty !== undefined) {
      query = query.gte('difficulty', filter.minDifficulty)
    }
    if (filter.maxDifficulty !== undefined) {
      query = query.lte('difficulty', filter.maxDifficulty)
    }
    if (filter.minTrendScore !== undefined) {
      query = query.gte('trend_score', filter.minTrendScore)
    }
    if (filter.query) {
      query = query.ilike('keyword', `%${escapeIlike(filter.query)}%`)
    }

    // ソート
    const sortColumnMap: Record<string, string> = {
      volume: 'search_volume',
      difficulty: 'difficulty',
      trend: 'trend_score',
      created: 'created_at',
    }
    const sortColumn = sortColumnMap[filter.sortBy ?? 'volume'] ?? 'search_volume'
    query = query.order(sortColumn, { ascending: filter.sortOrder === 'asc' })

    // ページネーション
    const offset = filter.offset ?? 0
    const limit = filter.limit ?? 50
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[admin/keywords] Query error:', error.message)
      return NextResponse.json(
        { error: 'Failed to query keywords' },
        { status: 500 }
      )
    }

    const keywords: KeywordEntry[] = (data ?? []).map(mapRowToKeyword)

    return NextResponse.json({
      keywords,
      total: count ?? 0,
      filters: filter,
    })
  } catch (err) {
    console.error('[admin/keywords] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: キーワード新規追加
// ============================================================

interface AddKeywordRequest {
  keyword: string
  category: ContentCategory
  searchVolume?: number
  difficulty?: number
  trendScore?: number
  relatedKeywords?: string[]
  longTailVariations?: string[]
  notes?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  let body: AddKeywordRequest
  try {
    body = (await request.json()) as AddKeywordRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // バリデーション
  const validation = validateKeywordEntry(body)
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.errors.join('; ') },
      { status: 400 }
    )
  }

  const newKeyword = createKeywordEntry(body)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // フォールバック: インメモリ
    inMemoryKeywords.push(newKeyword)
    return NextResponse.json(
      { success: true, keyword: newKeyword },
      { status: 201 }
    )
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    const now = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('keywords')
      .insert({
        id: newKeyword.id,
        keyword: newKeyword.keyword,
        search_volume: newKeyword.searchVolume,
        difficulty: newKeyword.difficulty,
        trend_score: newKeyword.trendScore,
        category: newKeyword.category,
        tracked_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) {
      console.error('[admin/keywords] Insert error:', error.message)
      return NextResponse.json(
        { error: 'Failed to add keyword' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, keyword: mapRowToKeyword(data) },
      { status: 201 }
    )
  } catch (err) {
    console.error('[admin/keywords] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToKeyword(row: any): KeywordEntry {
  const difficulty = parseFloat(String(row.difficulty ?? '50'))
  const keyword = row.keyword ?? ''

  return {
    id: row.id,
    keyword,
    category: row.category,
    searchVolume: parseInt(String(row.search_volume ?? row.searchVolume ?? '0'), 10),
    difficulty,
    difficultyLevel: getDifficultyLevel(difficulty),
    trendScore: parseFloat(String(row.trend_score ?? row.trendScore ?? '50')),
    searchIntent: estimateSearchIntent(keyword),
    cpc: row.cpc ? parseFloat(String(row.cpc)) : undefined,
    competition: row.competition ? parseFloat(String(row.competition)) : undefined,
    relatedKeywords: row.related_keywords ?? row.relatedKeywords ?? [],
    longTailVariations: row.long_tail_variations ?? row.longTailVariations ?? [],
    seasonality: row.seasonality ?? 'evergreen',
    notes: row.notes ?? undefined,
    trackedAt: row.tracked_at ?? row.trackedAt ?? row.created_at ?? '',
    createdAt: row.created_at ?? row.createdAt ?? '',
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  }
}
