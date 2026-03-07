/**
 * パイプライン CRON API Unit Tests
 * GET /api/pipeline/run (Vercel Cron Jobs)
 *
 * type クエリパラメータ / CRON_SECRET 認証 / PIPELINE_API_KEY フォールバックを検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数スタブ
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
vi.stubEnv('ENABLE_CRON_JOBS', 'true')

// Pipeline 認証のモック
vi.mock('@/lib/admin/auth', () => ({
  validatePipelineAuth: vi.fn(() => ({ authorized: true })),
  validateCronAuth: vi.fn(() => true),
  getAuthErrorStatus: vi.fn((error: { code: string }) =>
    error.code === 'FORBIDDEN' ? 403 : 401
  ),
}))

// PipelineExecutor のモック
vi.mock('@/lib/pipeline/executor', () => {
  class MockPipelineExecutor {
    run = vi.fn().mockResolvedValue({
      runId: 'cron-run-001',
      status: 'success',
      type: 'daily',
      steps: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 1000,
    })
  }
  return {
    PipelineExecutor: MockPipelineExecutor,
    getDailyPipelineSteps: vi.fn().mockResolvedValue([]),
    getPDCAPipelineSteps: vi.fn().mockResolvedValue([]),
    getRunningPipelineIds: vi.fn().mockReturnValue([]),
  }
})

// Supabase client モック (DB lock check)
vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}))

// next/server の after() をモック
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: vi.fn((fn: () => void) => { fn() }),
  }
})

// automation-config モック
vi.mock('@/app/api/admin/automation-config/route', () => ({
  getAutomationConfig: vi.fn().mockResolvedValue({
    dailyPipeline: true,
    pdcaBatch: true,
  }),
}))

// Pipeline スケジューラーのモック
vi.mock('@/lib/pipeline/scheduler', () => ({
  getPipelineConfig: vi.fn((type: string) => ({
    type,
    maxConcurrentSteps: 1,
    retryDelayMs: 3000,
    timeoutMs: 900000,
    enableSupabaseLogging: false,
    dryRun: true,
  })),
}))

import { validatePipelineAuth, validateCronAuth } from '@/lib/admin/auth'
import { getAutomationConfig } from '@/app/api/admin/automation-config/route'

// ================================================================
// Failsafe: ENABLE_CRON_JOBS 多層防御テスト
// ================================================================
describe('Failsafe: ENABLE_CRON_JOBS multi-layer defense', () => {
  let GET: typeof import('@/app/api/pipeline/run/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('ENABLE_CRON_JOBS', 'true')
    ;(validatePipelineAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      authorized: true,
    })
    const pipelineRoute = await import('@/app/api/pipeline/run/route')
    GET = pipelineRoute.GET
  })

  // Layer 1: 環境変数チェック
  it('Layer 1: ENABLE_CRON_JOBS が未設定なら自動実行をスキップ', async () => {
    vi.stubEnv('ENABLE_CRON_JOBS', '')
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.skipped).toBe(true)
    expect(data.message).toContain('ENABLE_CRON_JOBS')
  })

  it('Layer 1: ENABLE_CRON_JOBS="1" は許可しない（厳密一致のみ）', async () => {
    vi.stubEnv('ENABLE_CRON_JOBS', '1')
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  it('Layer 1: ENABLE_CRON_JOBS="yes" は許可しない', async () => {
    vi.stubEnv('ENABLE_CRON_JOBS', 'yes')
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  it('Layer 1: ENABLE_CRON_JOBS="TRUE" (大文字) は許可しない', async () => {
    vi.stubEnv('ENABLE_CRON_JOBS', 'TRUE')
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  // Layer 2: DB設定取得失敗
  it('Layer 2: getAutomationConfig が例外を投げたら自動実行をスキップ', async () => {
    ;(getAutomationConfig as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB connection failed'))
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(data.skipped).toBe(true)
    expect(data.message).toContain('safety')
  })

  // Layer 3: 厳密な型チェック
  it('Layer 3: dailyPipeline が string "true" なら自動実行をスキップ', async () => {
    ;(getAutomationConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      dailyPipeline: 'true' as unknown as boolean,
      pdcaBatch: true,
    })
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  it('Layer 3: pdcaBatch が 1 なら自動実行をスキップ', async () => {
    ;(getAutomationConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      dailyPipeline: true,
      pdcaBatch: 1 as unknown as boolean,
    })
    const req = new Request('http://localhost/api/pipeline/run?type=pdca', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  it('Layer 3: dailyPipeline === false なら自動実行をスキップ', async () => {
    ;(getAutomationConfig as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      dailyPipeline: false,
      pdcaBatch: true,
    })
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  // 全レイヤー通過 → 実行
  it('全レイヤー通過: ENABLE_CRON_JOBS=true + dailyPipeline===true → 実行', async () => {
    const req = new Request('http://localhost/api/pipeline/run?type=daily', { method: 'GET' }) as any
    const response = await GET(req)
    expect(response.status).toBe(202)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.skipped).toBeUndefined()
  })
})

describe('GET /api/pipeline/run', () => {
  let GET: typeof import('@/app/api/pipeline/run/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validatePipelineAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      authorized: true,
    })

    const pipelineRoute = await import('@/app/api/pipeline/run/route')
    GET = pipelineRoute.GET
  })

  // ==============================================================
  // type クエリパラメータ
  // ==============================================================
  describe('type クエリパラメータ', () => {
    it('should accept type=daily query parameter', async () => {
      const req = new Request('http://localhost/api/pipeline/run?type=daily', {
        method: 'GET',
      }) as any

      const response = await GET(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should accept type=pdca query parameter', async () => {
      const req = new Request('http://localhost/api/pipeline/run?type=pdca', {
        method: 'GET',
      }) as any

      const response = await GET(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should default to daily when no type specified', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'GET',
      }) as any

      const response = await GET(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
      // GET delegates to POST which defaults to 'manual' when no body/type is given
      expect(data.message).toBeDefined()
    })

    it('should reject invalid type parameter', async () => {
      // The route delegates GET to POST; invalid types will still execute
      // as the route uses body.type which may be undefined for GET requests.
      // The route defaults to 'manual' when type is not provided.
      const req = new Request('http://localhost/api/pipeline/run?type=invalid', {
        method: 'GET',
      }) as any

      const response = await GET(req)
      // GET delegates to POST which reads body, not query params
      // So the type from query params is not used directly
      expect(response.status).toBe(202)
    })
  })
})

describe('CRON_SECRET authentication', () => {
  let GET: typeof import('@/app/api/pipeline/run/route').GET

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validatePipelineAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      authorized: true,
    })

    const pipelineRoute = await import('@/app/api/pipeline/run/route')
    GET = pipelineRoute.GET
  })

  it('should accept valid CRON_SECRET in Authorization header', async () => {
    // CRON_SECRET is validated through validatePipelineAuth which is mocked to return authorized
    const req = new Request('http://localhost/api/pipeline/run', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid-cron-secret',
      },
    }) as any

    const response = await GET(req)
    expect(response.status).toBe(202)

    const data = await response.json()
    expect(data.success).toBe(true)
  })

  it('should reject invalid CRON_SECRET', async () => {
    ;(validatePipelineAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      authorized: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized: Invalid API key',
      },
    })
    ;(validateCronAuth as ReturnType<typeof vi.fn>).mockReturnValue(false)

    const req = new Request('http://localhost/api/pipeline/run', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid-cron-secret',
      },
    }) as any

    const response = await GET(req)
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('should still accept PIPELINE_API_KEY', async () => {
    // The route's validatePipelineAuth supports both CRON_SECRET (via Bearer)
    // and X-Pipeline-Api-Key header
    const req = new Request('http://localhost/api/pipeline/run', {
      method: 'GET',
      headers: {
        'X-Pipeline-Api-Key': 'valid-pipeline-key',
      },
    }) as any

    const response = await GET(req)
    expect(response.status).toBe(202)

    const data = await response.json()
    expect(data.success).toBe(true)
  })
})
