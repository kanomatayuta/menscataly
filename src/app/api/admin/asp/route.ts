/**
 * /api/admin/asp
 * GET:  ASPプログラム一覧取得 (フィルタ付き)
 * POST: ASPプログラム新規作成
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { safeParseInt } from '@/lib/utils/safe-parse'
import { type AspProgramSeed } from '@/lib/asp/seed'
import { mapRowToProgram } from '@/lib/asp/helpers'
import type { AspProgramRow } from '@/types/database'
import type { RewardTier } from '@/types/asp-config'

// ============================================================
// インメモリストア (Supabase未設定時のフォールバック)
// ============================================================

let inMemoryPrograms: AspProgramSeed[] = []

/** インメモリストアを取得する (テスト用にexport) */
export function getInMemoryPrograms(): AspProgramSeed[] {
  return inMemoryPrograms
}

/** インメモリストアをリセットする (テスト用) */
export function resetInMemoryPrograms(): void {
  inMemoryPrograms = []
}

// ============================================================
// GET: ASPプログラム一覧
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
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
  const limit = safeParseInt(searchParams.get('limit'), 50, 1, 100)
  const offset = safeParseInt(searchParams.get('offset'), 0, 0)

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
      // テーブル未作成等の場合はインメモリにフォールバック
      let programs = inMemoryPrograms as AspProgramSeed[]
      if (aspName) programs = programs.filter((p) => p.aspName === aspName)
      if (category) programs = programs.filter((p) => p.category === category)
      if (activeOnly) programs = programs.filter((p) => p.isActive)
      return NextResponse.json({
        programs: programs.slice(offset, offset + limit),
        total: programs.length,
      })
    }

    const programs = (data ?? []).map(mapRowToProgram)

    return NextResponse.json({ programs, total: count ?? 0 })
  } catch (err) {
    console.error('[admin/asp] Error:', err)
    // Supabase接続失敗時もインメモリにフォールバック
    let programs = inMemoryPrograms as AspProgramSeed[]
    if (aspName) programs = programs.filter((p) => p.aspName === aspName)
    if (category) programs = programs.filter((p) => p.category === category)
    if (activeOnly) programs = programs.filter((p) => p.isActive)
    return NextResponse.json({
      programs: programs.slice(offset, offset + limit),
      total: programs.length,
    })
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
  rewardTiers: RewardTier[]
  approvalRate?: number
  epc?: number
  itpSupport?: boolean
  cookieDuration?: number
  isActive?: boolean
  priority?: number
  recommendedAnchors?: string[]
  notes?: string
  adCreatives?: unknown[]
  advertiserName?: string
  aspCategory?: string
  confirmationPeriodDays?: number
  partnershipStatus?: string
  lastApprovalDate?: string | null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
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

  // カテゴリバリデーション（microCMSから動的取得）
  {
    let validCategories: string[]
    try {
      const { getCategories } = await import('@/lib/microcms/client')
      const cats = await getCategories({ limit: 100 })
      validCategories = cats.contents.map((c) => c.slug ?? c.id)
    } catch {
      validCategories = ['aga', 'hair-removal', 'skincare', 'ed', 'column']
    }
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `category must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }
  }

  const now = new Date().toISOString()
  const newId = crypto.randomUUID()

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
      rewardTiers: body.rewardTiers,
      approvalRate: body.approvalRate ?? 0,
      epc: body.epc ?? 0,
      itpSupport: body.itpSupport ?? false,
      cookieDuration: body.cookieDuration ?? 30,
      isActive: body.isActive ?? true,
      priority: body.priority ?? 3,
      recommendedAnchors: body.recommendedAnchors ?? [body.programName],
      notes: body.notes,
      adCreatives: body.adCreatives as AspProgramSeed['adCreatives'],
      advertiserName: body.advertiserName ?? '',
      aspCategory: body.aspCategory ?? '',
      confirmationPeriodDays: body.confirmationPeriodDays ?? 30,
      partnershipStatus: body.partnershipStatus ?? 'active',
      lastApprovalDate: body.lastApprovalDate || null,
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
        reward_tiers: body.rewardTiers,
        approval_rate: body.approvalRate ?? 0,
        epc: body.epc ?? 0,
        itp_support: body.itpSupport ?? false,
        cookie_duration: body.cookieDuration ?? 30,
        is_active: body.isActive ?? true,
        priority: body.priority ?? 3,
        recommended_anchors: body.recommendedAnchors ?? [body.programName],
        notes: body.notes ?? null,
        ad_creatives: body.adCreatives ?? [],
        advertiser_name: body.advertiserName ?? '',
        asp_category: body.aspCategory ?? '',
        confirmation_period_days: body.confirmationPeriodDays ?? 30,
        partnership_status: body.partnershipStatus ?? 'active',
        last_approval_date: body.lastApprovalDate || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single() as { data: AspProgramRow | null; error: { message: string } | null }

    if (error) {
      console.error('[admin/asp] Insert error:', error.message)
      return NextResponse.json(
        { error: `Failed to create ASP program: ${error.message}` },
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

  // rewardTiers バリデーション
  if (!Array.isArray(body.rewardTiers) || body.rewardTiers.length === 0) {
    return 'rewardTiers must be a non-empty array'
  }
  for (let i = 0; i < body.rewardTiers.length; i++) {
    const tier = body.rewardTiers[i]
    if (!tier.condition) return `rewardTiers[${i}].condition is required`
    if (tier.amount === undefined || tier.amount === null) return `rewardTiers[${i}].amount is required`
    if (!['fixed', 'percentage'].includes(tier.type)) {
      return `rewardTiers[${i}].type must be "fixed" or "percentage"`
    }
  }

  const validAsps = ['afb', 'a8', 'accesstrade', 'valuecommerce', 'felmat', 'moshimo']
  if (!validAsps.includes(body.aspName)) {
    return `aspName must be one of: ${validAsps.join(', ')}`
  }

  // カテゴリバリデーションはPOSTハンドラ側で実施（async必要のため）

  // adCreatives バリデーション
  if (body.adCreatives !== undefined) {
    const creativesError = validateAdCreatives(body.adCreatives)
    if (creativesError) return creativesError
  }

  // partnershipStatus バリデーション
  if (body.partnershipStatus !== undefined) {
    const validStatuses = ['active', 'pending', 'ended']
    if (!validStatuses.includes(body.partnershipStatus)) {
      return `partnershipStatus must be one of: ${validStatuses.join(', ')}`
    }
  }

  return null
}

function validateAdCreatives(creatives: unknown[]): string | null {
  if (!Array.isArray(creatives)) return 'adCreatives must be an array'

  for (let i = 0; i < creatives.length; i++) {
    const item = creatives[i]
    if (typeof item !== 'object' || item === null) {
      return `adCreatives[${i}]: must be an object`
    }
    const c = item as Record<string, unknown>
    if (typeof c.id !== 'string' || !c.id) {
      return `adCreatives[${i}].id: must be a non-empty string`
    }
    if (!['text', 'banner'].includes(c.type as string)) {
      return `adCreatives[${i}].type: must be 'text' or 'banner'`
    }
    // rawHtml が設定されている場合、affiliateUrl は不要（rawHtml内に含まれる）
    const hasRawHtml = typeof c.rawHtml === 'string' && c.rawHtml.length > 0
    if (!hasRawHtml && (typeof c.affiliateUrl !== 'string' || !c.affiliateUrl)) {
      return `adCreatives[${i}].affiliateUrl: must be a non-empty string (or provide rawHtml)`
    }
    if (typeof c.isActive !== 'boolean') {
      return `adCreatives[${i}].isActive: must be a boolean`
    }
  }
  return null
}
