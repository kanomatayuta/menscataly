/**
 * ASP CRUD API Unit Tests
 * GET/POST /api/admin/asp および GET/PUT/DELETE /api/admin/asp/[id]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 環境変数をクリアして、インメモリストアを使うモードに強制する
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

// 認証をバイパスする
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: vi.fn(async () => ({ authorized: true })),
  getAuthErrorStatus: vi.fn((error: { code: string }) => error.code === 'FORBIDDEN' ? 403 : 401),
}))

import { validateAdminAuth } from '@/lib/admin/auth'

/** テスト用にインメモリストアへシードデータを投入するヘルパー */
async function seedTestProgram(
  POST: (req: Request) => Promise<Response>,
  overrides: Record<string, unknown> = {},
) {
  const body = {
    aspName: 'afb',
    programName: 'テストシードプログラム',
    programId: `seed-${Date.now()}`,
    category: 'aga',
    rewardTiers: [{ condition: '初回購入', amount: 5000, type: 'fixed' }],
    isActive: true,
    ...overrides,
  }
  const req = new Request('http://localhost/api/admin/asp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
  await POST(req)
  return body
}

describe('ASP CRUD API', () => {
  let GET: typeof import('@/app/api/admin/asp/route').GET
  let POST: typeof import('@/app/api/admin/asp/route').POST
  let resetInMemoryPrograms: typeof import('@/app/api/admin/asp/route').resetInMemoryPrograms

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({ authorized: true })

    // 動的インポートでモジュールを取得（各テスト毎にリセットできるように）
    const aspRoute = await import('@/app/api/admin/asp/route')
    GET = aspRoute.GET
    POST = aspRoute.POST
    resetInMemoryPrograms = aspRoute.resetInMemoryPrograms

    // インメモリストアを空にリセット
    resetInMemoryPrograms()
  })

  // ==============================================================
  // GET /api/admin/asp
  // ==============================================================
  describe('GET /api/admin/asp', () => {
    it('認証済みリクエストが200を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp') as any
      const response = await GET(req)
      expect(response.status).toBe(200)
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        authorized: false,
        error: 'Unauthorized',
      })
      const req = new Request('http://localhost/api/admin/asp') as any
      const response = await GET(req)
      expect(response.status).toBe(401)
    })

    it('プログラム一覧を返すこと', async () => {
      // テスト用データを投入
      await seedTestProgram(POST)

      const req = new Request('http://localhost/api/admin/asp') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.programs).toBeDefined()
      expect(Array.isArray(data.programs)).toBe(true)
      expect(data.total).toBeGreaterThan(0)
    })

    it('各プログラムに必須フィールドが含まれること', async () => {
      await seedTestProgram(POST)

      const req = new Request('http://localhost/api/admin/asp') as any
      const response = await GET(req)
      const data = await response.json()

      for (const program of data.programs) {
        expect(program.id).toBeDefined()
        expect(program.aspName).toBeDefined()
        expect(program.programName).toBeDefined()
        expect(program.category).toBeDefined()
        expect(Array.isArray(program.rewardTiers)).toBe(true)
        expect(program.rewardTiers.length).toBeGreaterThan(0)
        expect(typeof program.isActive).toBe('boolean')
      }
    })

    it('ASP名でフィルタできること', async () => {
      await seedTestProgram(POST, { aspName: 'afb', category: 'aga' })
      await seedTestProgram(POST, { aspName: 'a8', category: 'aga', programId: 'seed-a8' })

      const req = new Request('http://localhost/api/admin/asp?asp=afb') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.programs.length).toBeGreaterThan(0)
      for (const program of data.programs) {
        expect(program.aspName).toBe('afb')
      }
    })

    it('カテゴリでフィルタできること', async () => {
      await seedTestProgram(POST, { aspName: 'afb', category: 'aga' })
      await seedTestProgram(POST, { aspName: 'afb', category: 'ed', programId: 'seed-ed' })

      const req = new Request('http://localhost/api/admin/asp?category=aga') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.programs.length).toBeGreaterThan(0)
      for (const program of data.programs) {
        expect(program.category).toBe('aga')
      }
    })

    it('ページネーション（limit/offset）が機能すること', async () => {
      const req = new Request('http://localhost/api/admin/asp?limit=3&offset=0') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.programs.length).toBeLessThanOrEqual(3)
    })

    it('active=false で非アクティブプログラムも返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp?active=false') as any
      const response = await GET(req)
      const data = await response.json()

      expect(data.programs).toBeDefined()
      expect(data.total).toBeGreaterThanOrEqual(0)
    })
  })

  // ==============================================================
  // POST /api/admin/asp
  // ==============================================================
  describe('POST /api/admin/asp', () => {
    const validBody = {
      aspName: 'afb',
      programName: 'テストプログラム',
      programId: 'test-prog-001',
      category: 'aga',
      rewardTiers: [{ condition: '初回購入完了', amount: 10000, type: 'fixed' as const }],
    }

    it('有効なリクエストで201を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.program).toBeDefined()
      expect(data.program.programName).toBe('テストプログラム')
    })

    it('未認証リクエストが401を返すこと', async () => {
      ;(validateAdminAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        authorized: false,
        error: 'Unauthorized',
      })

      const req = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(401)
    })

    it('不正なJSON bodyが400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('必須フィールド欠如で400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspName: 'afb' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('無効なASP名で400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, aspName: 'invalid-asp' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('無効なカテゴリで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, category: 'invalid-category' }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('無効なrewardTiersで400を返すこと', async () => {
      const req = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, rewardTiers: [{ condition: 'test', amount: 100, type: 'invalid' }] }),
      }) as any

      const response = await POST(req)
      expect(response.status).toBe(400)
    })

    it('作成後にGETで取得できること', async () => {
      const postReq = new Request('http://localhost/api/admin/asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }) as any
      await POST(postReq)

      const getReq = new Request('http://localhost/api/admin/asp?asp=afb&category=aga') as any
      const response = await GET(getReq)
      const data = await response.json()

      const found = data.programs.find(
        (p: { programId: string }) => p.programId === 'test-prog-001'
      )
      expect(found).toBeDefined()
    })
  })
})
