/**
 * Admin Audit Log Module Tests
 * - writeAdminAuditLog: 有効なエントリの書き込み
 * - writeAdminAuditLog: Supabase 未設定時のサイレント失敗
 * - extractIpFromRequest: x-forwarded-for ヘッダー
 * - extractIpFromRequest: x-real-ip ヘッダー
 * - extractIpFromRequest: フォールバック 'unknown'
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Supabase モック
const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null })
const mockFrom = vi.fn(() => ({ insert: mockInsert }))

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import {
  writeAdminAuditLog,
  extractIpFromRequest,
  type AdminAuditEntry,
} from '@/lib/admin/audit-log'

describe('Admin Audit Log Module', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // ==============================================================
  // writeAdminAuditLog
  // ==============================================================
  describe('writeAdminAuditLog', () => {
    it('有効なエントリをSupabaseに書き込むこと', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

      const entry: AdminAuditEntry = {
        event_type: 'login_success',
        actor: 'admin@example.com',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        request_path: '/api/admin/login',
        request_method: 'POST',
        success: true,
        http_status: 200,
        metadata: { source: 'web' },
      }

      await writeAdminAuditLog(entry)

      expect(mockFrom).toHaveBeenCalledWith('admin_audit_log')
      expect(mockInsert).toHaveBeenCalledWith({
        event_type: 'login_success',
        actor: 'admin@example.com',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        request_path: '/api/admin/login',
        request_method: 'POST',
        success: true,
        failure_reason: null,
        http_status: 200,
        metadata: { source: 'web' },
      })
    })

    it('省略フィールドにデフォルト値を適用すること', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

      const entry: AdminAuditEntry = {
        event_type: 'login_failure',
        success: false,
      }

      await writeAdminAuditLog(entry)

      expect(mockInsert).toHaveBeenCalledWith({
        event_type: 'login_failure',
        actor: 'anonymous',
        ip_address: null,
        user_agent: null,
        request_path: null,
        request_method: null,
        success: false,
        failure_reason: null,
        http_status: null,
        metadata: {},
      })
    })

    it('Supabase URL が未設定の場合、サイレントに何もしないこと', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

      const entry: AdminAuditEntry = {
        event_type: 'login_success',
        success: true,
      }

      await writeAdminAuditLog(entry)

      expect(mockFrom).not.toHaveBeenCalled()
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('SUPABASE_SERVICE_ROLE_KEY が未設定の場合、サイレントに何もしないこと', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      const entry: AdminAuditEntry = {
        event_type: 'login_success',
        success: true,
      }

      await writeAdminAuditLog(entry)

      expect(mockFrom).not.toHaveBeenCalled()
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('Supabase エラー時にconsole.errorを出力してスローしないこと', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
      mockInsert.mockRejectedValueOnce(new Error('DB connection failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const entry: AdminAuditEntry = {
        event_type: 'unauthorized_access',
        success: false,
        failure_reason: 'Invalid token',
      }

      // エラーがスローされないことを確認
      await expect(writeAdminAuditLog(entry)).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AdminAuditLog] Failed to write entry:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  // ==============================================================
  // extractIpFromRequest
  // ==============================================================
  describe('extractIpFromRequest', () => {
    it('x-forwarded-for ヘッダーから最初のIPを抽出すること', () => {
      const request = new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178' },
      })

      expect(extractIpFromRequest(request)).toBe('203.0.113.50')
    })

    it('x-forwarded-for が単一IPの場合そのまま返すこと', () => {
      const request = new Request('http://localhost/api/test', {
        headers: { 'x-forwarded-for': '10.0.0.1' },
      })

      expect(extractIpFromRequest(request)).toBe('10.0.0.1')
    })

    it('x-real-ip ヘッダーからIPを抽出すること', () => {
      const request = new Request('http://localhost/api/test', {
        headers: { 'x-real-ip': '192.168.1.100' },
      })

      expect(extractIpFromRequest(request)).toBe('192.168.1.100')
    })

    it('x-forwarded-for を x-real-ip より優先すること', () => {
      const request = new Request('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '203.0.113.50',
          'x-real-ip': '192.168.1.100',
        },
      })

      expect(extractIpFromRequest(request)).toBe('203.0.113.50')
    })

    it('ヘッダーが無い場合 "unknown" を返すこと', () => {
      const request = new Request('http://localhost/api/test')

      expect(extractIpFromRequest(request)).toBe('unknown')
    })
  })
})
