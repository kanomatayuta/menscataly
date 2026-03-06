/**
 * /api/admin/asp/[id]
 * GET:    ASPプログラム詳細取得
 * PUT:    ASPプログラム更新
 * DELETE: ASPプログラム削除
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { withRateLimit } from '@/lib/admin/rate-limit'
import { type AspProgramSeed } from '@/lib/asp/seed'
import { mapRowToProgram } from '@/lib/asp/helpers'
import type { AspProgramRow } from '@/types/database'
import type { RewardTier, AdCreative } from '@/types/asp-config'
import { enrichCreativeWithParsedSize } from '@/lib/asp/banner-parser'
import { getInMemoryPrograms } from '../route'

// ============================================================
// GET: ASPプログラム詳細取得
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    )
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Program ID is required' },
      { status: 400 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const programs = getInMemoryPrograms()
    const program = programs.find((p) => p.id === id)
    if (!program) {
      return NextResponse.json(
        { error: 'ASP program not found' },
        { status: 404 }
      )
    }
    return NextResponse.json({ program })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('asp_programs')
      .select('*')
      .eq('id', id)
      .single() as { data: AspProgramRow | null; error: { code: string; message: string } | null }

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'ASP program not found' },
          { status: 404 }
        )
      }
      console.error('[admin/asp/[id]] Query error:', error.message)
      return NextResponse.json(
        { error: 'Failed to query ASP program' },
        { status: 500 }
      )
    }

    return NextResponse.json({ program: mapRowToProgram(data!) })
  } catch (err) {
    console.error('[admin/asp/[id]] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// PUT: ASPプログラム更新
// ============================================================

interface UpdateAspProgramRequest {
  aspName?: string
  programId?: string
  category?: string
  programName?: string
  rewardTiers?: RewardTier[]
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = withRateLimit(request, 'admin:asp:put')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    )
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Program ID is required' },
      { status: 400 }
    )
  }

  let body: UpdateAspProgramRequest
  try {
    body = (await request.json()) as UpdateAspProgramRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // rewardTiers バリデーション
  if (body.rewardTiers !== undefined) {
    if (!Array.isArray(body.rewardTiers) || body.rewardTiers.length === 0) {
      return NextResponse.json(
        { error: 'rewardTiers must be a non-empty array' },
        { status: 400 }
      )
    }
    for (let i = 0; i < body.rewardTiers.length; i++) {
      const tier = body.rewardTiers[i]
      if (!tier.condition) {
        return NextResponse.json({ error: `rewardTiers[${i}].condition is required` }, { status: 400 })
      }
      if (!['fixed', 'percentage'].includes(tier.type)) {
        return NextResponse.json({ error: `rewardTiers[${i}].type must be "fixed" or "percentage"` }, { status: 400 })
      }
    }
  }

  // aspName バリデーション
  if (body.aspName !== undefined) {
    const validAsps = ['afb', 'a8', 'accesstrade', 'valuecommerce', 'felmat', 'moshimo']
    if (!validAsps.includes(body.aspName)) {
      return NextResponse.json(
        { error: `aspName must be one of: ${validAsps.join(', ')}` },
        { status: 400 }
      )
    }
  }

  // category バリデーション（microCMSから動的取得）
  if (body.category !== undefined) {
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

  // partnershipStatus バリデーション
  if (body.partnershipStatus !== undefined) {
    const validStatuses = ['active', 'pending', 'ended']
    if (!validStatuses.includes(body.partnershipStatus)) {
      return NextResponse.json(
        { error: `partnershipStatus must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }
  }

  // adCreatives バリデーション
  if (body.adCreatives !== undefined) {
    const creativesError = validateAdCreatives(body.adCreatives)
    if (creativesError) {
      return NextResponse.json({ error: creativesError }, { status: 400 })
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const programs = getInMemoryPrograms()
    const index = programs.findIndex((p) => p.id === id)
    if (index === -1) {
      return NextResponse.json(
        { error: 'ASP program not found' },
        { status: 404 }
      )
    }

    // インメモリ更新
    const existing = programs[index]
    const updated: AspProgramSeed = {
      ...existing,
      ...(body.aspName !== undefined && { aspName: body.aspName as AspProgramSeed['aspName'] }),
      ...(body.programId !== undefined && { programId: body.programId }),
      ...(body.category !== undefined && { category: body.category as AspProgramSeed['category'] }),
      ...(body.programName !== undefined && { programName: body.programName }),
      ...(body.rewardTiers !== undefined && { rewardTiers: body.rewardTiers }),
      ...(body.approvalRate !== undefined && { approvalRate: body.approvalRate }),
      ...(body.epc !== undefined && { epc: body.epc }),
      ...(body.itpSupport !== undefined && { itpSupport: body.itpSupport }),
      ...(body.cookieDuration !== undefined && { cookieDuration: body.cookieDuration }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.recommendedAnchors !== undefined && { recommendedAnchors: body.recommendedAnchors }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.adCreatives !== undefined && { adCreatives: body.adCreatives as AspProgramSeed['adCreatives'] }),
      ...(body.advertiserName !== undefined && { advertiserName: body.advertiserName }),
      ...(body.aspCategory !== undefined && { aspCategory: body.aspCategory }),
      ...(body.confirmationPeriodDays !== undefined && { confirmationPeriodDays: body.confirmationPeriodDays }),
      ...(body.partnershipStatus !== undefined && { partnershipStatus: body.partnershipStatus }),
      ...(body.lastApprovalDate !== undefined && { lastApprovalDate: body.lastApprovalDate }),
    }
    programs[index] = updated

    return NextResponse.json({ success: true, program: updated })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.aspName !== undefined) updatePayload.asp_name = body.aspName
    if (body.programId !== undefined) updatePayload.program_id = body.programId
    if (body.category !== undefined) updatePayload.category = body.category
    if (body.programName !== undefined) updatePayload.program_name = body.programName
    if (body.rewardTiers !== undefined) updatePayload.reward_tiers = body.rewardTiers
    if (body.approvalRate !== undefined) updatePayload.approval_rate = body.approvalRate
    if (body.epc !== undefined) updatePayload.epc = body.epc
    if (body.itpSupport !== undefined) updatePayload.itp_support = body.itpSupport
    if (body.cookieDuration !== undefined) updatePayload.cookie_duration = body.cookieDuration
    if (body.isActive !== undefined) updatePayload.is_active = body.isActive
    if (body.priority !== undefined) updatePayload.priority = body.priority
    if (body.recommendedAnchors !== undefined) updatePayload.recommended_anchors = body.recommendedAnchors
    if (body.notes !== undefined) updatePayload.notes = body.notes
    if (body.adCreatives !== undefined) updatePayload.ad_creatives = body.adCreatives.map((c) => enrichCreativeWithParsedSize(c as AdCreative))
    if (body.advertiserName !== undefined) updatePayload.advertiser_name = body.advertiserName
    if (body.aspCategory !== undefined) updatePayload.asp_category = body.aspCategory
    if (body.confirmationPeriodDays !== undefined) updatePayload.confirmation_period_days = body.confirmationPeriodDays
    if (body.partnershipStatus !== undefined) updatePayload.partnership_status = body.partnershipStatus
    if (body.lastApprovalDate !== undefined) updatePayload.last_approval_date = body.lastApprovalDate || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('asp_programs')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single() as { data: AspProgramRow | null; error: { code: string; message: string } | null }

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'ASP program not found' },
          { status: 404 }
        )
      }
      console.error('[admin/asp/[id]] Update error:', error.message)
      return NextResponse.json(
        { error: 'Failed to update ASP program' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, program: mapRowToProgram(data!) })
  } catch (err) {
    console.error('[admin/asp/[id]] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE: ASPプログラム削除
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = withRateLimit(request, 'admin:asp:delete')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: getAuthErrorStatus(auth.error!) }
    )
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Program ID is required' },
      { status: 400 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const programs = getInMemoryPrograms()
    const index = programs.findIndex((p) => p.id === id)
    if (index === -1) {
      return NextResponse.json(
        { error: 'ASP program not found' },
        { status: 404 }
      )
    }

    programs.splice(index, 1)

    return NextResponse.json({
      success: true,
      message: `ASP program ${id} deleted`,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('asp_programs')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[admin/asp/[id]] Delete error:', error.message)
      return NextResponse.json(
        { error: 'Failed to delete ASP program' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `ASP program ${id} deleted`,
    })
  } catch (err) {
    console.error('[admin/asp/[id]] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

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
