/**
 * アラートマネージャー
 * モニタリングアラートの作成・管理・閾値チェック
 */

import { randomUUID } from 'crypto'
import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  MonitoringAlert,
} from '@/types/admin'

// ============================================================
// インメモリアラートストア (Supabase未設定時のフォールバック)
// ============================================================

const inMemoryAlerts = new Map<string, MonitoringAlert>()

// ============================================================
// AlertManager クラス
// ============================================================

export class AlertManager {
  /**
   * 新しいアラートを作成する
   */
  async createAlert(params: {
    type: AlertType
    severity: AlertSeverity
    title: string
    message: string
    metadata?: Record<string, unknown>
  }): Promise<MonitoringAlert> {
    const alert: MonitoringAlert = {
      id: randomUUID(),
      type: params.type,
      severity: params.severity,
      status: 'active',
      title: params.title,
      message: params.message,
      metadata: params.metadata ?? {},
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.info('[AlertManager] Supabase not configured — storing alert in memory')
      inMemoryAlerts.set(alert.id, alert)
      return alert
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('monitoring_alerts')
        .insert({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata,
        })

      if (error) {
        console.error('[AlertManager] Failed to create alert:', error.message)
        inMemoryAlerts.set(alert.id, alert)
      }
    } catch (err) {
      console.error('[AlertManager] Supabase error:', err)
      inMemoryAlerts.set(alert.id, alert)
    }

    console.log(
      `[AlertManager] Created ${alert.severity} alert: ${alert.title}`
    )
    return alert
  }

  /**
   * アラートを解決する
   */
  async resolveAlert(alertId: string): Promise<void> {
    const now = new Date().toISOString()

    // インメモリから検索
    const memAlert = inMemoryAlerts.get(alertId)
    if (memAlert) {
      memAlert.status = 'resolved'
      memAlert.resolvedAt = now
      return
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('monitoring_alerts')
        .update({ status: 'resolved' as AlertStatus, resolved_at: now })
        .eq('id', alertId)

      if (error) {
        console.error('[AlertManager] Failed to resolve alert:', error.message)
      }
    } catch (err) {
      console.error('[AlertManager] Supabase error:', err)
    }
  }

  /**
   * アラートを承認する
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const now = new Date().toISOString()

    // インメモリから検索
    const memAlert = inMemoryAlerts.get(alertId)
    if (memAlert) {
      memAlert.status = 'acknowledged'
      memAlert.acknowledgedAt = now
      return
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('monitoring_alerts')
        .update({ status: 'acknowledged' as AlertStatus, acknowledged_at: now })
        .eq('id', alertId)

      if (error) {
        console.error('[AlertManager] Failed to acknowledge alert:', error.message)
      }
    } catch (err) {
      console.error('[AlertManager] Supabase error:', err)
    }
  }

  /**
   * アクティブアラート一覧を取得する
   */
  async getActiveAlerts(): Promise<MonitoringAlert[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return Array.from(inMemoryAlerts.values()).filter(
        (a) => a.status === 'active'
      )
    }

    try {
      const { createServerSupabaseClient } = await import('@/lib/supabase/client')
      const supabase = createServerSupabaseClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('monitoring_alerts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('[AlertManager] Failed to query alerts:', error.message)
        return Array.from(inMemoryAlerts.values()).filter(
          (a) => a.status === 'active'
        )
      }

      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: row.id as string,
        type: row.type as AlertType,
        severity: row.severity as AlertSeverity,
        status: row.status as AlertStatus,
        title: row.title as string,
        message: row.message as string,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.created_at as string,
        acknowledgedAt: (row.acknowledged_at as string) ?? null,
        resolvedAt: (row.resolved_at as string) ?? null,
      }))
    } catch (err) {
      console.error('[AlertManager] Supabase query error:', err)
      return Array.from(inMemoryAlerts.values()).filter(
        (a) => a.status === 'active'
      )
    }
  }

  /**
   * 各種閾値をチェックしてアラートを生成する
   */
  async checkThresholds(): Promise<MonitoringAlert[]> {
    const alerts: MonitoringAlert[] = []

    try {
      // コスト閾値チェック
      const { CostTracker } = await import('@/lib/batch/cost-tracker')
      const costTracker = new CostTracker()
      const costCheck = await costTracker.checkThreshold()

      if (costCheck.exceeded) {
        const alert = await this.createAlert({
          type: 'cost_threshold',
          severity: 'warning',
          title: 'コスト閾値超過',
          message: `30日間のコスト ($${costCheck.currentCost.toFixed(2)}) が閾値 ($${costCheck.threshold.toFixed(2)}) を超えました`,
          metadata: {
            currentCost: costCheck.currentCost,
            threshold: costCheck.threshold,
          },
        })
        alerts.push(alert)
      }
    } catch (err) {
      console.error('[AlertManager] Threshold check error:', err)
    }

    return alerts
  }
}
