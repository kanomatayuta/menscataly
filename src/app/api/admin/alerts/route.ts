/**
 * /api/admin/alerts
 * GET: アクティブアラート一覧取得
 * PATCH: アラートの承認/解決
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { AlertManager } from '@/lib/monitoring/alert-manager'

// ============================================================
// GET: アラート一覧
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  try {
    const manager = new AlertManager()
    const alerts = await manager.getActiveAlerts()

    return NextResponse.json({ alerts })
  } catch (err) {
    console.error('[admin/alerts] Error:', err)
    return NextResponse.json(
      { error: 'Failed to retrieve alerts' },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH: アラートの承認/解決
// ============================================================

interface AlertActionRequest {
  alertId: string
  action: 'acknowledge' | 'resolve'
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  let body: AlertActionRequest
  try {
    body = (await request.json()) as AlertActionRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.alertId) {
    return NextResponse.json(
      { error: 'alertId is required' },
      { status: 400 }
    )
  }

  if (!body.action || !['acknowledge', 'resolve'].includes(body.action)) {
    return NextResponse.json(
      { error: 'action must be "acknowledge" or "resolve"' },
      { status: 400 }
    )
  }

  try {
    const manager = new AlertManager()

    if (body.action === 'acknowledge') {
      await manager.acknowledgeAlert(body.alertId)
    } else {
      await manager.resolveAlert(body.alertId)
    }

    return NextResponse.json({
      success: true,
      alertId: body.alertId,
      action: body.action,
      message: `Alert ${body.alertId} ${body.action}d successfully`,
    })
  } catch (err) {
    console.error('[admin/alerts] Action error:', err)
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}
