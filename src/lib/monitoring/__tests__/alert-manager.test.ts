/**
 * アラートマネージャー Unit Tests
 * CRUD操作・閾値チェックの契約テスト
 *
 * Backend エージェントが @/lib/monitoring/alert-manager を実装する前に、
 * インターフェース契約をテストする。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockMonitoringAlert,
} from '@/test/helpers'
import type { MonitoringAlert, AlertLevel, AlertStatus, AlertType } from '@/types/admin'

// 契約模倣関数
const createAlert = vi.fn()
const getAlerts = vi.fn()
const updateAlert = vi.fn()
const resolveAlert = vi.fn()
const checkThresholds = vi.fn()

describe('アラートマネージャー', () => {
  const sampleAlerts: MonitoringAlert[] = [
    createMockMonitoringAlert({ id: 'alert-001', type: 'pipeline_failure', level: 'critical', status: 'active' }),
    createMockMonitoringAlert({ id: 'alert-002', type: 'cost_threshold', level: 'warning', status: 'active' }),
    createMockMonitoringAlert({ id: 'alert-003', type: 'compliance_violation', level: 'critical', status: 'acknowledged', acknowledgedAt: '2026-03-01T12:00:00Z' }),
    createMockMonitoringAlert({ id: 'alert-004', type: 'api_error', level: 'info', status: 'resolved', resolvedAt: '2026-03-02T00:00:00Z' }),
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    createAlert.mockImplementation(async (input: Partial<MonitoringAlert>) => {
      return createMockMonitoringAlert({
        id: `alert-${Date.now()}`,
        ...input,
        status: 'active' as AlertStatus,
        createdAt: new Date().toISOString(),
      })
    })

    getAlerts.mockResolvedValue(sampleAlerts)

    updateAlert.mockImplementation(async (id: string, update: Partial<MonitoringAlert>) => {
      const existing = sampleAlerts.find(a => a.id === id)
      if (!existing) return null
      return { ...existing, ...update }
    })

    resolveAlert.mockImplementation(async (id: string) => {
      const existing = sampleAlerts.find(a => a.id === id)
      if (!existing) return null
      return { ...existing, status: 'resolved' as AlertStatus, resolvedAt: new Date().toISOString() }
    })

    checkThresholds.mockResolvedValue({
      triggered: [
        { type: 'cost_threshold' as AlertType, level: 'warning' as AlertLevel, message: 'Monthly cost exceeded $10' },
      ],
      checked: ['cost_threshold', 'performance_degradation', 'pipeline_failure'],
    })
  })

  describe('create() -- アラート作成', () => {
    it('新規アラートを作成できること', async () => {
      const alert: MonitoringAlert = await createAlert({
        type: 'pipeline_failure',
        level: 'critical',
        title: 'Pipeline failed',
        message: 'Step fetch-trends failed',
        metadata: { step: 'fetch-trends', retryCount: 3 },
      })

      expect(alert).toBeDefined()
      expect(alert.id).toBeDefined()
      expect(alert.type).toBe('pipeline_failure')
      expect(alert.level).toBe('critical')
      expect(alert.status).toBe('active')
      expect(alert.createdAt).toBeDefined()
    })

    it('作成されたアラートにtitle, messageが含まれること', async () => {
      const alert: MonitoringAlert = await createAlert({
        type: 'api_error',
        level: 'warning',
        title: 'Claude API rate limit',
        message: 'Rate limit exceeded for claude-sonnet-4-6',
        metadata: {},
      })

      expect(alert.title).toBe('Claude API rate limit')
      expect(alert.message).toContain('Rate limit')
    })

    it('全てのAlertTypeでアラートを作成できること', async () => {
      const types: AlertType[] = ['pipeline_failure', 'compliance_violation', 'cost_threshold', 'performance_degradation', 'api_error']

      for (const type of types) {
        const alert: MonitoringAlert = await createAlert({
          type,
          level: 'warning',
          title: `Test ${type}`,
          message: `Test message for ${type}`,
          metadata: {},
        })
        expect(alert.type).toBe(type)
      }
    })
  })

  describe('getAll() -- アラート取得', () => {
    it('全アラートを取得できること', async () => {
      const alerts: MonitoringAlert[] = await getAlerts()

      expect(Array.isArray(alerts)).toBe(true)
      expect(alerts.length).toBe(4)
    })

    it('各アラートにMonitoringAlertの必須フィールドが含まれること', async () => {
      const alerts: MonitoringAlert[] = await getAlerts()
      alerts.forEach(alert => {
        expect(alert.id).toBeDefined()
        expect(alert.type).toBeDefined()
        expect(alert.level).toBeDefined()
        expect(alert.status).toBeDefined()
        expect(alert.title).toBeDefined()
        expect(alert.message).toBeDefined()
        expect(alert.createdAt).toBeDefined()
      })
    })

    it('ステータスフィルタが正しく動作すること', async () => {
      const activeAlerts = sampleAlerts.filter(a => a.status === 'active')
      getAlerts.mockResolvedValueOnce(activeAlerts)

      const alerts: MonitoringAlert[] = await getAlerts()
      alerts.forEach(alert => {
        expect(alert.status).toBe('active')
      })
    })
  })

  describe('update() -- アラート更新', () => {
    it('アラートステータスをacknowledgedに更新できること', async () => {
      const updated: MonitoringAlert = await updateAlert('alert-001', {
        status: 'acknowledged',
        acknowledgedAt: new Date().toISOString(),
      })

      expect(updated).toBeDefined()
      expect(updated.status).toBe('acknowledged')
      expect(updated.acknowledgedAt).toBeDefined()
    })

    it('存在しないアラートの更新はnullを返すこと', async () => {
      const updated = await updateAlert('nonexistent', { status: 'acknowledged' as AlertStatus })
      expect(updated).toBeNull()
    })
  })

  describe('resolve() -- アラート解決', () => {
    it('アラートをresolvedに変更できること', async () => {
      const resolved: MonitoringAlert = await resolveAlert('alert-001')

      expect(resolved).toBeDefined()
      expect(resolved.status).toBe('resolved')
      expect(resolved.resolvedAt).toBeDefined()
    })

    it('存在しないアラートの解決はnullを返すこと', async () => {
      const resolved = await resolveAlert('nonexistent')
      expect(resolved).toBeNull()
    })
  })

  describe('checkThresholds() -- 閾値チェック', () => {
    it('閾値チェック結果にtriggered配列が含まれること', async () => {
      const result = await checkThresholds()

      expect(result.triggered).toBeDefined()
      expect(Array.isArray(result.triggered)).toBe(true)
    })

    it('チェック済み項目リストが含まれること', async () => {
      const result = await checkThresholds()

      expect(result.checked).toBeDefined()
      expect(Array.isArray(result.checked)).toBe(true)
      expect(result.checked.length).toBeGreaterThan(0)
    })

    it('トリガーされた閾値にtype, level, messageが含まれること', async () => {
      const result = await checkThresholds()

      result.triggered.forEach((trigger: { type: string; level: string; message: string }) => {
        expect(trigger.type).toBeDefined()
        expect(trigger.level).toBeDefined()
        expect(trigger.message).toBeDefined()
      })
    })
  })
})
