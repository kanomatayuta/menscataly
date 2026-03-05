/**
 * 管理者認証監査ログ
 * admin_audit_log テーブルへの書き込み・IP抽出ヘルパー
 */

import { createServerSupabaseClient } from '@/lib/supabase/client'

// ============================================================
// 型定義
// ============================================================

export type AdminAuditEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'session_expired'
  | 'unauthorized_access'

export interface AdminAuditEntry {
  event_type: AdminAuditEventType
  actor?: string
  ip_address?: string
  user_agent?: string
  request_path?: string
  request_method?: string
  success: boolean
  failure_reason?: string
  http_status?: number
  metadata?: Record<string, unknown>
}

// ============================================================
// 書き込み
// ============================================================

/**
 * 監査ログエントリを admin_audit_log テーブルに書き込む
 * Supabase が未設定の場合はサイレントに何もしない
 */
export async function writeAdminAuditLog(entry: AdminAuditEntry): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return

  try {
    const supabase = createServerSupabaseClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('admin_audit_log').insert({
      event_type: entry.event_type,
      actor: entry.actor ?? 'anonymous',
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
      request_path: entry.request_path ?? null,
      request_method: entry.request_method ?? null,
      success: entry.success,
      failure_reason: entry.failure_reason ?? null,
      http_status: entry.http_status ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch (err) {
    console.error('[AdminAuditLog] Failed to write entry:', err)
  }
}

// ============================================================
// IP抽出ヘルパー
// ============================================================

/**
 * リクエストヘッダーからクライアントIPアドレスを抽出する
 * x-forwarded-for > x-real-ip > 'unknown' の優先順位
 */
export function extractIpFromRequest(request: Request): string {
  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) return xForwardedFor.split(',')[0].trim()

  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp.trim()

  return 'unknown'
}
