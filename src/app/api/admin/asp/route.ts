/**
 * /api/admin/asp
 * GET:  ASPプログラム一覧取得 (フィルタ付き)
 * POST: ASPプログラム新規作成
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { ASP_SEED_DATA, type AspProgramSeed } from '@/lib/asp/seed'
import { mapRowToProgram } from '@/lib/asp/helpers'
import type { AspProgramRow } from '@/types/database'

// ============================================================
// インメモリストア (Supabase未設定時のフォールバック)
// ============================================================

let inMemoryPrograms: AspProgramSeed[] = [...ASP_SEED_DATA]

/** インメモリストアを取得する (テスト用にexport) */
export function getInMemoryPrograms(): AspProgramSeed[] {
  return inMemoryPrograms
}

/** インメモリストアをリセットする (テスト用) */
export function resetInMemoryPrograms(): void {
  inMemoryPrograms = [...ASP_SEED_DATA]
}

// ============================================================
// GET: ASPプログラム一覧
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    )
  }

  const { searchParams } = new URL(request.url)
  const aspName = searchParams.get('asp')
  const category = searchParams.get('category')
  const activeOnly = searchParams.get('active') !== 'false'
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // フォールバック: インメモリデータ
    let programs = inMemoryPrograms
    if (aspName) programs = programs.filter((p) => p.aspName === aspName)
    if (category) programs = programs.filter((p) => p.category === category)
    if (activeOnly) programs = programs.filter((p) => p.isActive)

    return NextResponse.json({
      programs: programs.slice(offset, offset + limit),
      total: programs.length,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // Note: supabase-js 型推論の制約により、asp_programs クエリには型アサーションを使用
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('asp_programs')
      .select('*', { count: 'exact' })
      .order('priority', { ascending: true })
      .range(offset, offset + limit - 1)

    if (aspName) query = query.eq('asp_name', aspName)
    if (category) query = query.eq('category', category)
    if (activeOnly) query = query.eq('is_active', true)

    const { data, error, count } = await query as {
      data: AspProgramRow[] | null
      error: { message: string } | null
      count: number | null
    }

    if (error) {
      console.error('[admin/asp] Query error:', error.message)
      return NextResponse.json(
        { error: 'Failed to query ASP programs' },
        { status: 500 }
      )
    }

    const programs = (data ?? []).map(mapRowToProgram)

    return NextResponse.json({ programs, total: count ?? 0 })
  } catch (err) {
    console.error('[admin/asp] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// POST: ASPプログラム新規作成
// ============================================================

interface CreateAspProgramRequest {
  aspName: string
  programName: string
  programId: string
  category: string
  affiliateUrl: string
  rewardAmount: number
  rewardType: 'fixed' | 'percentage'
  conversionCondition: string
  approvalRate?: number
  epc?: number
  itpSupport?: boolean
  cookieDuration?: number
  isActive?: boolean
  priority?: number
  recommendedAnchors?: string[]
  landingPageUrl: string
  notes?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    )
  }

  let body: CreateAspProgramRequest
  try {
    body = (await request.json()) as CreateAspProgramRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // バリデーション
  const validationError = validateCreateRequest(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const now = new Date().toISOString()
  const newId = `${body.aspName}-${body.category}-${Date.now()}`

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // フォールバック: インメモリ
    const newProgram: AspProgramSeed = {
      id: newId,
      aspName: body.aspName as AspProgramSeed['aspName'],
      programName: body.programName,
      programId: body.programId,
      category: body.category as AspProgramSeed['category'],
      affiliateUrl: body.affiliateUrl,
      rewardAmount: body.rewardAmount,
      rewardType: body.rewardType,
      conversionCondition: body.conversionCondition,
      approvalRate: body.approvalRate ?? 0,
      epc: body.epc ?? 0,
      itpSupport: body.itpSupport ?? false,
      cookieDuration: body.cookieDuration ?? 30,
      isActive: body.isActive ?? true,
      priority: body.priority ?? 3,
      recommendedAnchors: body.recommendedAnchors ?? [body.programName],
      landingPageUrl: body.landingPageUrl,
      notes: body.notes,
    }

    inMemoryPrograms.push(newProgram)

    return NextResponse.json(
      { success: true, program: newProgram },
      { status: 201 }
    )
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('asp_programs')
      .insert({
        id: newId,
        asp_name: body.aspName,
        program_name: body.programName,
        program_id: body.programId,
        category: body.category,
        affiliate_url: body.affiliateUrl,
        reward_amount: body.rewardAmount,
        reward_type: body.rewardType,
        conversion_condition: body.conversionCondition,
        approval_rate: body.approvalRate ?? 0,
        epc: body.epc ?? 0,
        itp_support: body.itpSupport ?? false,
        cookie_duration: body.cookieDuration ?? 30,
        is_active: body.isActive ?? true,
        priority: body.priority ?? 3,
        recommended_anchors: body.recommendedAnchors ?? [body.programName],
        landing_page_url: body.landingPageUrl,
        notes: body.notes ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single() as { data: AspProgramRow | null; error: { message: string } | null }

    if (error) {
      console.error('[admin/asp] Insert error:', error.message)
      return NextResponse.json(
        { error: 'Failed to create ASP program' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, program: mapRowToProgram(data!) },
      { status: 201 }
    )
  } catch (err) {
    console.error('[admin/asp] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

function validateCreateRequest(body: CreateAspProgramRequest): string | null {
  if (!body.aspName) return 'aspName is required'
  if (!body.programName) return 'programName is required'
  if (!body.programId) return 'programId is required'
  if (!body.category) return 'category is required'
  if (!body.affiliateUrl) return 'affiliateUrl is required'
  if (body.rewardAmount === undefined || body.rewardAmount === null) return 'rewardAmount is required'
  if (!body.rewardType || !['fixed', 'percentage'].includes(body.rewardType)) {
    return 'rewardType must be "fixed" or "percentage"'
  }
  if (!body.conversionCondition) return 'conversionCondition is required'
  if (!body.landingPageUrl) return 'landingPageUrl is required'

  const validAsps = ['afb', 'a8', 'accesstrade', 'valuecommerce', 'felmat', 'moshimo']
  if (!validAsps.includes(body.aspName)) {
    return `aspName must be one of: ${validAsps.join(', ')}`
  }

  const validCategories = ['aga', 'hair-removal', 'skincare', 'ed', 'column']
  if (!validCategories.includes(body.category)) {
    return `category must be one of: ${validCategories.join(', ')}`
  }

  return null
}
