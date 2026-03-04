/**
 * /api/admin/asp/[id]
 * GET:    ASPプログラム詳細取得
 * PUT:    ASPプログラム更新
 * DELETE: ASPプログラム削除
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth, getAuthErrorStatus } from '@/lib/admin/auth'
import { type AspProgramSeed } from '@/lib/asp/seed'
import { mapRowToProgram } from '@/lib/asp/helpers'
import type { AspProgramRow } from '@/types/database'
import { getInMemoryPrograms } from '../route'

// ============================================================
// GET: ASPプログラム詳細取得
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
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
  programName?: string
  affiliateUrl?: string
  rewardAmount?: number
  rewardType?: 'fixed' | 'percentage'
  conversionCondition?: string
  approvalRate?: number
  epc?: number
  itpSupport?: boolean
  cookieDuration?: number
  isActive?: boolean
  priority?: number
  recommendedAnchors?: string[]
  landingPageUrl?: string
  notes?: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
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

  if (body.rewardType && !['fixed', 'percentage'].includes(body.rewardType)) {
    return NextResponse.json(
      { error: 'rewardType must be "fixed" or "percentage"' },
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

    // インメモリ更新
    const existing = programs[index]
    const updated: AspProgramSeed = {
      ...existing,
      ...(body.programName !== undefined && { programName: body.programName }),
      ...(body.affiliateUrl !== undefined && { affiliateUrl: body.affiliateUrl }),
      ...(body.rewardAmount !== undefined && { rewardAmount: body.rewardAmount }),
      ...(body.rewardType !== undefined && { rewardType: body.rewardType }),
      ...(body.conversionCondition !== undefined && { conversionCondition: body.conversionCondition }),
      ...(body.approvalRate !== undefined && { approvalRate: body.approvalRate }),
      ...(body.epc !== undefined && { epc: body.epc }),
      ...(body.itpSupport !== undefined && { itpSupport: body.itpSupport }),
      ...(body.cookieDuration !== undefined && { cookieDuration: body.cookieDuration }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.recommendedAnchors !== undefined && { recommendedAnchors: body.recommendedAnchors }),
      ...(body.landingPageUrl !== undefined && { landingPageUrl: body.landingPageUrl }),
      ...(body.notes !== undefined && { notes: body.notes }),
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

    if (body.programName !== undefined) updatePayload.program_name = body.programName
    if (body.affiliateUrl !== undefined) updatePayload.affiliate_url = body.affiliateUrl
    if (body.rewardAmount !== undefined) updatePayload.reward_amount = body.rewardAmount
    if (body.rewardType !== undefined) updatePayload.reward_type = body.rewardType
    if (body.conversionCondition !== undefined) updatePayload.conversion_condition = body.conversionCondition
    if (body.approvalRate !== undefined) updatePayload.approval_rate = body.approvalRate
    if (body.epc !== undefined) updatePayload.epc = body.epc
    if (body.itpSupport !== undefined) updatePayload.itp_support = body.itpSupport
    if (body.cookieDuration !== undefined) updatePayload.cookie_duration = body.cookieDuration
    if (body.isActive !== undefined) updatePayload.is_active = body.isActive
    if (body.priority !== undefined) updatePayload.priority = body.priority
    if (body.recommendedAnchors !== undefined) updatePayload.recommended_anchors = body.recommendedAnchors
    if (body.landingPageUrl !== undefined) updatePayload.landing_page_url = body.landingPageUrl
    if (body.notes !== undefined) updatePayload.notes = body.notes

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
  const auth = validateAdminAuth(request)
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
