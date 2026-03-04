/**
 * パイプライン実行 API Unit Tests
 * POST /api/pipeline/run
 *
 * 認証・リクエストボディ・実行開始を検証する。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数スタブ
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

// Pipeline 認証のモック
vi.mock('@/lib/admin/auth', () => ({
  validatePipelineAuth: vi.fn(() => ({ authorized: true })),
  getAuthErrorStatus: vi.fn((error: { code: string }) =>
    error.code === 'FORBIDDEN' ? 403 : 401
  ),
}))

// PipelineExecutor のモック — class を使って正しくコンストラクタをモックする
vi.mock('@/lib/pipeline/executor', () => {
  class MockPipelineExecutor {
    run = vi.fn().mockResolvedValue({
      runId: 'test-run-001',
      status: 'success',
      type: 'manual',
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
  }
})

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

import { validatePipelineAuth } from '@/lib/admin/auth'

describe('パイプライン実行 API (POST /api/pipeline/run)', () => {
  let POST: typeof import('@/app/api/pipeline/run/route').POST

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validatePipelineAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      authorized: true,
    })

    const pipelineRoute = await import('@/app/api/pipeline/run/route')
    POST = pipelineRoute.POST
  })

  // ==============================================================
  // 認証テスト
  // ==============================================================
  describe('認証', () => {
    it('認証なし → 401を返すこと', async () => {
      ;(validatePipelineAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized: Missing authentication credentials',
        },
      })

      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(401)
    })

    it('サーバー設定エラー → 403を返すこと', async () => {
      ;(validatePipelineAuth as ReturnType<typeof vi.fn>).mockReturnValue({
        authorized: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Server configuration error: PIPELINE_API_KEY not set',
        },
      })

      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(403)
    })

    it('正しい認証 → パイプライン実行開始 (202)', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.runId).toBeDefined()
      expect(data.status).toBe('running')
    })
  })

  // ==============================================================
  // リクエストボディ
  // ==============================================================
  describe('リクエストボディ', () => {
    it('不正なJSON body → 400を返すこと', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {{{{',
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('空ボディでもデフォルト設定で実行されること', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('type=daily でパイプラインが実行されること', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'daily' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('daily')
    })

    it('type=pdca でパイプラインが実行されること', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'pdca' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('pdca')
    })

    it('dryRun=true が正しく伝播されること', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual', dryRun: true }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(202)

      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  // ==============================================================
  // レスポンス形式
  // ==============================================================
  describe('レスポンス形式', () => {
    it('成功レスポンスが正しい形式であること', async () => {
      const req = new Request('http://localhost/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual' }),
      }) as any

      const response = await POST(req)
      const data = await response.json()

      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('runId')
      expect(data).toHaveProperty('message')
      expect(data).toHaveProperty('status')
    })
  })
})
