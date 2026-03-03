/**
 * GET /api/health
 * ヘルスチェックエンドポイント
 * 各外部サービス（microCMS, Supabase）の接続状態と環境変数の設定状態を返す
 */

import { NextResponse } from 'next/server'

// ============================================================
// サービスステータス型
// ============================================================

type ServiceStatus = 'ok' | 'error' | 'not_configured'

interface ServiceHealth {
  status: ServiceStatus
  message: string
  latencyMs?: number
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: {
    microcms: ServiceHealth
    supabase: ServiceHealth
  }
  environment: {
    ANTHROPIC_API_KEY: boolean
    MICROCMS_API_KEY: boolean
    MICROCMS_SERVICE_DOMAIN: boolean
    NEXT_PUBLIC_SUPABASE_URL: boolean
    NEXT_PUBLIC_SUPABASE_ANON_KEY: boolean
    SUPABASE_SERVICE_ROLE_KEY: boolean
    SLACK_WEBHOOK_URL: boolean
  }
  version: string
}

// ============================================================
// microCMS 接続チェック
// ============================================================

async function checkMicroCMS(): Promise<ServiceHealth> {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN
  const apiKey = process.env.MICROCMS_API_KEY

  if (!serviceDomain || !apiKey) {
    return {
      status: 'not_configured',
      message: 'MICROCMS_SERVICE_DOMAIN または MICROCMS_API_KEY が未設定',
    }
  }

  const startMs = Date.now()
  try {
    // microCMS API にリスト取得（limit=0）でヘルスチェック
    const response = await fetch(
      `https://${serviceDomain}.microcms.io/api/v1/articles?limit=0`,
      {
        headers: { 'X-MICROCMS-API-KEY': apiKey },
        signal: AbortSignal.timeout(5000),
      }
    )

    const latencyMs = Date.now() - startMs

    if (response.ok) {
      return {
        status: 'ok',
        message: 'microCMS API に正常に接続できます',
        latencyMs,
      }
    }

    return {
      status: 'error',
      message: `microCMS API エラー: ${response.status} ${response.statusText}`,
      latencyMs,
    }
  } catch (err) {
    const latencyMs = Date.now() - startMs
    return {
      status: 'error',
      message: `microCMS 接続失敗: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs,
    }
  }
}

// ============================================================
// Supabase 接続チェック
// ============================================================

async function checkSupabase(): Promise<ServiceHealth> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return {
      status: 'not_configured',
      message: 'NEXT_PUBLIC_SUPABASE_URL または Supabase キーが未設定',
    }
  }

  const startMs = Date.now()
  try {
    // Supabase REST API のヘルスチェック（systemテーブルへの簡易クエリ）
    const response = await fetch(
      `${supabaseUrl}/rest/v1/`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    )

    const latencyMs = Date.now() - startMs

    if (response.ok) {
      return {
        status: 'ok',
        message: 'Supabase に正常に接続できます',
        latencyMs,
      }
    }

    return {
      status: 'error',
      message: `Supabase API エラー: ${response.status} ${response.statusText}`,
      latencyMs,
    }
  } catch (err) {
    const latencyMs = Date.now() - startMs
    return {
      status: 'error',
      message: `Supabase 接続失敗: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs,
    }
  }
}

// ============================================================
// Route Handler
// ============================================================

export async function GET(): Promise<NextResponse> {
  const timestamp = new Date().toISOString()

  // 各サービスのチェックを並列実行（1つの失敗が他に影響しない）
  const [microcms, supabase] = await Promise.all([
    checkMicroCMS(),
    checkSupabase(),
  ])

  // 環境変数の設定チェック
  const environment = {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    MICROCMS_API_KEY: !!process.env.MICROCMS_API_KEY,
    MICROCMS_SERVICE_DOMAIN: !!process.env.MICROCMS_SERVICE_DOMAIN,
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SLACK_WEBHOOK_URL: !!process.env.SLACK_WEBHOOK_URL,
  }

  // 全体ステータスの判定
  const services = { microcms, supabase }
  const statuses = Object.values(services).map((s) => s.status)

  let overallStatus: HealthResponse['status']
  if (statuses.every((s) => s === 'ok' || s === 'not_configured')) {
    overallStatus = 'healthy'
  } else if (statuses.some((s) => s === 'ok')) {
    overallStatus = 'degraded'
  } else {
    overallStatus = 'unhealthy'
  }

  const response: HealthResponse = {
    status: overallStatus,
    timestamp,
    services,
    environment,
    version: process.env.npm_package_version ?? '0.1.0',
  }

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200

  return NextResponse.json(response, { status: httpStatus })
}
