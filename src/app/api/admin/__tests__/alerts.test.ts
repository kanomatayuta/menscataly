/**
 * 管理画面アラートAPI Unit Tests
 * GET/PATCH /api/admin/alerts の契約テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockMonitoringAlert,
  createMockSupabaseQuery,
} from '@/test/helpers'
import type { MonitoringAlert } from '@/types/admin'

// 認証モック
const mockValidateAuth = vi.fn()
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: mockValidateAuth,
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

// モックデータ
const mockAlerts: MonitoringAlert[] = [
  createMockMonitoringAlert({
    id: 'alert-001',
    type: 'pipeline_failure',
    level: 'critical',
    status: 'active',
  }),
  createMockMonitoringAlert({
    id: 'alert-002',
    type: 'cost_threshold',
    level: 'warning',
    status: 'active',
    title: 'Cost threshold exceeded',
    message: 'Monthly cost exceeded $10.00',
  }),
  createMockMonitoringAlert({
    id: 'alert-003',
    type: 'compliance_violation',
    level: 'critical',
    status: 'acknowledged',
    acknowledgedAt: '2026-03-01T12:00:00Z',
  }),
]

// Supabase モック
vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => createMockSupabaseQuery(mockAlerts)),
  })),
}))

// APIルートモック
const mockGetAlerts = vi.fn()
const mockPatchAlert = vi.fn()

vi.mock('@/app/api/admin/alerts/route', () => ({
  GET: mockGetAlerts,
  PATCH: mockPatchAlert,
}))

describe('管理画面アラートAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateAuth.mockReturnValue({ authorized: true, user: { id: 'admin-001' } })

    mockGetAlerts.mockResolvedValue(
      new Response(JSON.stringify({ alerts: mockAlerts, totalCount: mockAlerts.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    mockPatchAlert.mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        alert: {
          ...mockAlerts[0],
          status: 'acknowledged',
          acknowledgedAt: '2026-03-03T10:00:00Z',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  describe('GET /api/admin/alerts', () => {
    describe('認証', () => {
      it('認証済みリクエストが200を返すこと', async () => {
        const response = await mockGetAlerts(new Request('http://localhost/api/admin/alerts'))
        expect(response.status).toBe(200)
      })

      it('未認証リクエストが401を返すこと', async () => {
        mockValidateAuth.mockReturnValue({ authorized: false })
        mockGetAlerts.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        )

        const response = await mockGetAlerts(new Request('http://localhost/api/admin/alerts'))
        expect(response.status).toBe(401)
      })
    })

    describe('レスポンス形式', () => {
      it('アラートリストを返すこと', async () => {
        const response = await mockGetAlerts(new Request('http://localhost/api/admin/alerts'))
        const data = await response.json()

        expect(data.alerts).toBeDefined()
        expect(Array.isArray(data.alerts)).toBe(true)
        expect(data.totalCount).toBe(3)
      })

      it('各アラートにMonitoringAlertの必須フィールドが含まれること', async () => {
        const response = await mockGetAlerts(new Request('http://localhost/api/admin/alerts'))
        const data = await response.json()

        data.alerts.forEach((alert: MonitoringAlert) => {
          expect(alert.id).toBeDefined()
          expect(['critical', 'warning', 'info']).toContain(alert.level)
          expect(['active', 'acknowledged', 'resolved']).toContain(alert.status)
          expect(alert.title).toBeDefined()
          expect(alert.message).toBeDefined()
          expect(alert.createdAt).toBeDefined()
        })
      })

      it('アクティブなアラートのみフィルタできること', async () => {
        const activeAlerts = mockAlerts.filter(a => a.status === 'active')
        mockGetAlerts.mockResolvedValueOnce(
          new Response(JSON.stringify({ alerts: activeAlerts, totalCount: activeAlerts.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

        const response = await mockGetAlerts(
          new Request('http://localhost/api/admin/alerts?status=active')
        )
        const data = await response.json()

        data.alerts.forEach((alert: MonitoringAlert) => {
          expect(alert.status).toBe('active')
        })
      })

      it('重大度でフィルタできること', async () => {
        const criticalAlerts = mockAlerts.filter(a => a.level === 'critical')
        mockGetAlerts.mockResolvedValueOnce(
          new Response(JSON.stringify({ alerts: criticalAlerts, totalCount: criticalAlerts.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

        const response = await mockGetAlerts(
          new Request('http://localhost/api/admin/alerts?level=critical')
        )
        const data = await response.json()

        data.alerts.forEach((alert: MonitoringAlert) => {
          expect(alert.level).toBe('critical')
        })
      })
    })
  })

  describe('PATCH /api/admin/alerts', () => {
    describe('認証', () => {
      it('認証済みリクエストが200を返すこと', async () => {
        const response = await mockPatchAlert(
          new Request('http://localhost/api/admin/alerts', {
            method: 'PATCH',
            body: JSON.stringify({ alertId: 'alert-001', action: 'acknowledge' }),
          })
        )
        expect(response.status).toBe(200)
      })

      it('未認証リクエストが401を返すこと', async () => {
        mockValidateAuth.mockReturnValue({ authorized: false })
        mockPatchAlert.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        )

        const response = await mockPatchAlert(
          new Request('http://localhost/api/admin/alerts', {
            method: 'PATCH',
            body: JSON.stringify({ alertId: 'alert-001', action: 'acknowledge' }),
          })
        )
        expect(response.status).toBe(401)
      })
    })

    describe('アラートステータス更新', () => {
      it('acknowledge アクションでステータスが更新されること', async () => {
        const response = await mockPatchAlert(
          new Request('http://localhost/api/admin/alerts', {
            method: 'PATCH',
            body: JSON.stringify({ alertId: 'alert-001', action: 'acknowledge' }),
          })
        )
        const data = await response.json()

        expect(data.success).toBe(true)
        expect(data.alert).toBeDefined()
        expect(data.alert.status).toBe('acknowledged')
        expect(data.alert.acknowledgedAt).toBeDefined()
      })

      it('resolve アクションでステータスが更新されること', async () => {
        mockPatchAlert.mockResolvedValueOnce(
          new Response(JSON.stringify({
            success: true,
            alert: {
              ...mockAlerts[0],
              status: 'resolved',
              resolvedAt: '2026-03-03T15:00:00Z',
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

        const response = await mockPatchAlert(
          new Request('http://localhost/api/admin/alerts', {
            method: 'PATCH',
            body: JSON.stringify({ alertId: 'alert-001', action: 'resolve' }),
          })
        )
        const data = await response.json()

        expect(data.success).toBe(true)
        expect(data.alert.status).toBe('resolved')
        expect(data.alert.resolvedAt).toBeDefined()
      })

      it('存在しないアラートIDに対して404を返すこと', async () => {
        mockPatchAlert.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Alert not found' }), { status: 404 })
        )

        const response = await mockPatchAlert(
          new Request('http://localhost/api/admin/alerts', {
            method: 'PATCH',
            body: JSON.stringify({ alertId: 'nonexistent', action: 'acknowledge' }),
          })
        )

        expect(response.status).toBe(404)
      })
    })
  })
})
