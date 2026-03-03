/**
 * ヘルスチェック API エンドポイント
 * 各外部サービス (microCMS, Supabase) の疎通確認を行い、
 * 全体のステータスを返す
 */

import { NextResponse } from 'next/server'

interface ServiceStatus {
  name: string
  status: 'up' | 'down'
  latencyMs: number | null
  error?: string
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  services: ServiceStatus[]
  version: string
}

/**
 * microCMS の疎通確認
 */
async function checkMicroCMS(): Promise<ServiceStatus> {
  const start = Date.now()

  try {
    const domain = process.env.MICROCMS_SERVICE_DOMAIN
    const apiKey = process.env.MICROCMS_API_KEY

    if (!domain || !apiKey) {
      return {
        name: 'microCMS',
        status: 'down',
        latencyMs: null,
        error: 'Environment variables not configured',
      }
    }

    const response = await fetch(
      `https://${domain}.microcms.io/api/v1/articles?limit=1`,
      {
        headers: { 'X-MICROCMS-API-KEY': apiKey },
        signal: AbortSignal.timeout(5000),
      }
    )

    const latencyMs = Date.now() - start

    if (!response.ok) {
      return {
        name: 'microCMS',
        status: 'down',
        latencyMs,
        error: `HTTP ${response.status}`,
      }
    }

    return { name: 'microCMS', status: 'up', latencyMs }
  } catch (err) {
    return {
      name: 'microCMS',
      status: 'down',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Supabase の疎通確認
 */
async function checkSupabase(): Promise<ServiceStatus> {
  const start = Date.now()

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return {
        name: 'Supabase',
        status: 'down',
        latencyMs: null,
        error: 'Environment variables not configured',
      }
    }

    // REST API の health check (GET /rest/v1/ はメタデータを返す)
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      signal: AbortSignal.timeout(5000),
    })

    const latencyMs = Date.now() - start

    if (!response.ok) {
      return {
        name: 'Supabase',
        status: 'down',
        latencyMs,
        error: `HTTP ${response.status}`,
      }
    }

    return { name: 'Supabase', status: 'up', latencyMs }
  } catch (err) {
    return {
      name: 'Supabase',
      status: 'down',
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * GET /api/health
 */
export async function GET(): Promise<NextResponse<HealthResponse>> {
  const services = await Promise.all([checkMicroCMS(), checkSupabase()])

  const allUp = services.every((s) => s.status === 'up')
  const allDown = services.every((s) => s.status === 'down')

  let status: HealthResponse['status']
  if (allUp) {
    status = 'healthy'
  } else if (allDown) {
    status = 'unhealthy'
  } else {
    status = 'degraded'
  }

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    services,
    version: process.env.npm_package_version ?? '0.1.0',
  }

  const httpStatus = status === 'unhealthy' ? 503 : 200

  return NextResponse.json(response, { status: httpStatus })
}
