/**
 * ミドルウェア Unit Tests
 * - ITP Cookie設定・ASPパラメータ検出・ヘッダー注入のテスト
 * - Supabase Auth 管理ページ認証テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ==============================================================
// Supabase SSR モック
// ==============================================================

const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

import { middleware, generateItpScriptTags, getItpScriptConfigs, config } from '@/middleware'

// ==============================================================
// ヘルパー
// ==============================================================

/** テスト用 NextRequest を作成する */
function createMockRequest(
  path: string,
  params: Record<string, string> = {},
  cookies: Record<string, string> = {},
  headers: Record<string, string> = {}
): NextRequest {
  const url = new URL(path, 'http://localhost:3000')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const req = new NextRequest(url, {
    headers: new Headers(headers),
  })

  // Cookie を設定
  for (const [name, value] of Object.entries(cookies)) {
    req.cookies.set(name, value)
  }

  return req
}

// ==============================================================
// ミドルウェア本体テスト
// ==============================================================

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルト: 未認証
    mockGetUser.mockResolvedValue({ data: { user: null } })
    // 環境変数設定
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  describe('パスマッチング', () => {
    it('記事ページ以外ではCookieを設定しないこと', async () => {
      const req = createMockRequest('/', { a8mat: 'test-value' })
      const res = await middleware(req)

      // Cookie が設定されていないことを確認
      const setCookieHeader = res.headers.get('set-cookie')
      expect(setCookieHeader).toBeNull()
    })

    it('/articles/xxx パスではミドルウェアが動作すること', async () => {
      const req = createMockRequest('/articles/aga-basics', { a8mat: 'test-id' })
      const res = await middleware(req)

      // Cookie が設定されることを確認
      const setCookieHeader = res.headers.get('set-cookie')
      expect(setCookieHeader).toBeDefined()
      expect(setCookieHeader).toContain('_mc_aff')
    })

    it('/articles パス（末尾スラッシュなし）ではスキップされること', async () => {
      // ARTICLE_PATH_REGEX = /^\/articles\/.+/ なので /articles だけではマッチしない
      const req = createMockRequest('/articles', { a8mat: 'test-value' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie')
      expect(setCookieHeader).toBeNull()
    })

    it('管理ページ /admin/xxx では ITP Cookie を設定しないこと', async () => {
      const req = createMockRequest('/admin/dashboard', { a8mat: 'test-value' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      expect(setCookieHeader).not.toContain('_mc_aff')
    })
  })

  // ==============================================================
  // 管理ページ認証テスト (Supabase Auth)
  // ==============================================================

  describe('管理ページ認証 (Supabase Auth)', () => {
    it('未認証ユーザーが /admin にアクセスすると /admin/login にリダイレクトされること', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = createMockRequest('/admin')
      const res = await middleware(req)

      expect(res.status).toBe(307)
      const location = res.headers.get('location')
      expect(location).toContain('/admin/login')
      expect(location).toContain('from=%2Fadmin')
    })

    it('未認証ユーザーが /admin/articles にアクセスするとリダイレクトされること', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = createMockRequest('/admin/articles')
      const res = await middleware(req)

      expect(res.status).toBe(307)
      const location = res.headers.get('location')
      expect(location).toContain('/admin/login')
      expect(location).toContain('from=%2Fadmin%2Farticles')
    })

    it('/admin/login ページはそのまま通過すること', async () => {
      const req = createMockRequest('/admin/login')
      const res = await middleware(req)

      // リダイレクトされないこと
      expect(res.status).toBe(200)
      expect(res.headers.get('x-admin-pathname')).toBe('/admin/login')
    })

    it('認証済みユーザーが /admin にアクセスできること', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'admin@example.com' },
        },
      })

      const req = createMockRequest('/admin')
      const res = await middleware(req)

      // リダイレクトされないこと
      expect(res.status).toBe(200)
      expect(res.headers.get('x-admin-pathname')).toBe('/admin')
    })

    it('認証済みユーザーが /admin/dashboard にアクセスできること', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'admin@example.com' },
        },
      })

      const req = createMockRequest('/admin/dashboard')
      const res = await middleware(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('x-admin-pathname')).toBe('/admin/dashboard')
    })
  })

  // ==============================================================
  // ASPパラメータ検出テスト
  // ==============================================================

  describe('ASPパラメータ検出', () => {
    it('a8mat パラメータを検出して Cookie に保存すること', async () => {
      const req = createMockRequest('/articles/aga-guide', { a8mat: 'a8-tracking-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      expect(setCookieHeader).toContain('_mc_aff')

      // Cookie 値をデコードして検証
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps).toBeDefined()
        expect(data.asps.length).toBe(1)
        expect(data.asps[0].aspName).toBe('a8')
        expect(data.asps[0].paramName).toBe('a8mat')
        expect(data.asps[0].paramValue).toBe('a8-tracking-id')
      }
    })

    it('afb_ref パラメータを検出すること', async () => {
      const req = createMockRequest('/articles/ed-guide', { afb_ref: 'afb-id-123' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps[0].aspName).toBe('afb')
      }
    })

    it('at_ref パラメータを検出すること', async () => {
      const req = createMockRequest('/articles/skincare', { at_ref: 'at-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps[0].aspName).toBe('accesstrade')
      }
    })

    it('vc_ref パラメータを検出すること', async () => {
      const req = createMockRequest('/articles/hair-removal', { vc_ref: 'vc-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps[0].aspName).toBe('valuecommerce')
      }
    })

    it('fm_ref パラメータを検出すること', async () => {
      const req = createMockRequest('/articles/supplement', { fm_ref: 'fm-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps[0].aspName).toBe('felmat')
      }
    })

    it('moshimo_ref パラメータを検出すること', async () => {
      const req = createMockRequest('/articles/comparison', { moshimo_ref: 'moshi-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps[0].aspName).toBe('moshimo')
      }
    })

    it('asp_ref (汎用ASPパラメータ) を検出すること', async () => {
      const req = createMockRequest('/articles/test', { asp_ref: 'generic-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps[0].aspName).toBe('generic')
      }
    })

    it('utm_source パラメータを検出すること', async () => {
      const req = createMockRequest('/articles/test', { utm_source: 'partner' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps[0].aspName).toBe('utm')
      }
    })

    it('複数のASPパラメータを同時に検出すること', async () => {
      const req = createMockRequest('/articles/multi', {
        a8mat: 'a8-id',
        afb_ref: 'afb-id',
      })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.asps.length).toBe(2)
        const aspNames = data.asps.map((a: any) => a.aspName)
        expect(aspNames).toContain('a8')
        expect(aspNames).toContain('afb')
      }
    })

    it('ASPパラメータがない場合Cookieを設定しないこと', async () => {
      const req = createMockRequest('/articles/no-params')
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie')
      expect(setCookieHeader).toBeNull()
    })

    it('無関係なパラメータはASPとして検出されないこと', async () => {
      const req = createMockRequest('/articles/test', {
        page: '2',
        sort: 'date',
        foo: 'bar',
      })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie')
      expect(setCookieHeader).toBeNull()
    })
  })

  // ==============================================================
  // Cookie 設定テスト (ITP対策)
  // ==============================================================

  describe('Cookie 設定 (ITP対策)', () => {
    it('Cookie にトラッキングデータが含まれること', async () => {
      const req = createMockRequest('/articles/test', { a8mat: 'test-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      const cookieMatch = setCookieHeader.match(/_mc_aff=([^;]+)/)
      expect(cookieMatch).toBeDefined()
      if (cookieMatch) {
        const data = JSON.parse(decodeURIComponent(cookieMatch[1]))
        expect(data.landingPath).toBe('/articles/test')
        expect(typeof data.timestamp).toBe('number')
        expect(data.asps).toBeDefined()
      }
    })

    it('Cookie のmaxAgeが7日 (604800秒) であること', async () => {
      const req = createMockRequest('/articles/test', { a8mat: 'test-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      // 7日 = 7 * 24 * 60 * 60 = 604800
      expect(setCookieHeader).toContain('Max-Age=604800')
    })

    it('Cookie のPathが / であること', async () => {
      const req = createMockRequest('/articles/test', { a8mat: 'test-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      expect(setCookieHeader).toContain('Path=/')
    })

    it('Cookie のSameSiteがLaxであること', async () => {
      const req = createMockRequest('/articles/test', { a8mat: 'test-id' })
      const res = await middleware(req)

      const setCookieHeader = res.headers.get('set-cookie') ?? ''
      // Next.js may output SameSite in lowercase
      expect(setCookieHeader.toLowerCase()).toContain('samesite=lax')
    })
  })

  // ==============================================================
  // X-Active-ASPs / X-ITP-Scripts ヘッダーテスト
  // ==============================================================

  describe('カスタムヘッダー', () => {
    it('ASP検出時に X-Active-ASPs ヘッダーが設定されること', async () => {
      const req = createMockRequest('/articles/test', { a8mat: 'test-id' })
      const res = await middleware(req)

      const activeAsps = res.headers.get('X-Active-ASPs')
      expect(activeAsps).toBeDefined()
      expect(activeAsps).toContain('a8')
    })

    it('複数ASP検出時に X-Active-ASPs がカンマ区切りであること', async () => {
      const req = createMockRequest('/articles/test', {
        a8mat: 'a8-id',
        afb_ref: 'afb-id',
      })
      const res = await middleware(req)

      const activeAsps = res.headers.get('X-Active-ASPs')
      expect(activeAsps).toBeDefined()
      expect(activeAsps).toContain('a8')
      expect(activeAsps).toContain('afb')
    })

    it('ITPスクリプトURL用に X-ITP-Scripts ヘッダーが設定されること', async () => {
      const req = createMockRequest('/articles/test', { a8mat: 'test-id' })
      const res = await middleware(req)

      const itpScripts = res.headers.get('X-ITP-Scripts')
      expect(itpScripts).toBeDefined()
      expect(itpScripts).toContain('a8sales.js')
    })

    it('afb検出時にafb ITPスクリプトURLが含まれること', async () => {
      const req = createMockRequest('/articles/test', { afb_ref: 'afb-id' })
      const res = await middleware(req)

      const itpScripts = res.headers.get('X-ITP-Scripts')
      expect(itpScripts).toContain('t.afi-b.com/ta.js')
    })

    it('ASPパラメータなしの場合ヘッダーが設定されないこと', async () => {
      const req = createMockRequest('/articles/test')
      const res = await middleware(req)

      expect(res.headers.get('X-Active-ASPs')).toBeNull()
      expect(res.headers.get('X-ITP-Scripts')).toBeNull()
    })

    it('既存Cookie のASPデータがヘッダーに反映されること', async () => {
      const existingTracking = JSON.stringify({
        asps: [
          { aspName: 'afb', paramName: 'afb_ref', paramValue: 'old-id' },
        ],
        referrer: '',
        landingPath: '/articles/old',
        timestamp: Date.now() - 100000,
      })

      const req = createMockRequest(
        '/articles/new-article',
        {},
        { _mc_aff: existingTracking }
      )
      const res = await middleware(req)

      const activeAsps = res.headers.get('X-Active-ASPs')
      expect(activeAsps).toContain('afb')
    })

    it('既存CookieのASPと新規検出ASPが両方ヘッダーに含まれること', async () => {
      const existingTracking = JSON.stringify({
        asps: [
          { aspName: 'afb', paramName: 'afb_ref', paramValue: 'old-id' },
        ],
        referrer: '',
        landingPath: '/articles/old',
        timestamp: Date.now() - 100000,
      })

      const req = createMockRequest(
        '/articles/new-article',
        { a8mat: 'new-a8-id' },
        { _mc_aff: existingTracking }
      )
      const res = await middleware(req)

      const activeAsps = res.headers.get('X-Active-ASPs')
      expect(activeAsps).toContain('afb')
      expect(activeAsps).toContain('a8')
    })

    it('既存Cookieが不正なJSONの場合でもエラーにならないこと', async () => {
      const req = createMockRequest(
        '/articles/test',
        { a8mat: 'test-id' },
        { _mc_aff: 'invalid-json{{{' }
      )
      // エラーが発生しないことを確認
      const res = await middleware(req)
      expect(res.headers.get('X-Active-ASPs')).toContain('a8')
    })
  })
})

// ==============================================================
// generateItpScriptTags テスト
// ==============================================================

describe('generateItpScriptTags', () => {
  it('afb の ITPスクリプトタグを生成すること', () => {
    const html = generateItpScriptTags(['afb'])
    expect(html).toContain('<script')
    expect(html).toContain('src="https://t.afi-b.com/ta.js"')
    expect(html).toContain('data-afb-id="afb-tracking"')
    expect(html).toContain('data-afb-mode="itp"')
    expect(html).toContain('async')
  })

  it('a8 の ITPスクリプトタグを生成すること', () => {
    const html = generateItpScriptTags(['a8'])
    expect(html).toContain('src="https://statics.a8.net/a8sales/a8sales.js"')
    expect(html).toContain('data-a8=')
  })

  it('accesstrade の ITPスクリプトタグを生成すること', () => {
    const html = generateItpScriptTags(['accesstrade'])
    expect(html).toContain('src="https://h.accesstrade.net/js/nct/nct.js"')
    expect(html).toContain('data-at-id="accesstrade-tracking"')
  })

  it('valuecommerce の ITPスクリプトタグを生成すること', () => {
    const html = generateItpScriptTags(['valuecommerce'])
    expect(html).toContain('src="https://amd.c.yimg.jp/amd/vcsc/vc_bridge.js"')
    expect(html).toContain('data-vc-id="valuecommerce-tracking"')
  })

  it('felmat の ITPスクリプトタグを生成すること', () => {
    const html = generateItpScriptTags(['felmat'])
    expect(html).toContain('src="https://www.felmat.net/fmimg/fm.js"')
    expect(html).toContain('data-fm-id="felmat-tracking"')
  })

  it('moshimo の ITPスクリプトタグを生成すること', () => {
    const html = generateItpScriptTags(['moshimo'])
    expect(html).toContain('src="https://af.moshimo.com/af/r/result.js"')
    expect(html).toContain('data-moshimo-id="moshimo-tracking"')
  })

  it('複数ASPのスクリプトタグを改行区切りで生成すること', () => {
    const html = generateItpScriptTags(['a8', 'afb', 'accesstrade'])
    const scriptTags = html.split('\n')
    expect(scriptTags.length).toBe(3)
    expect(scriptTags[0]).toContain('a8sales.js')
    expect(scriptTags[1]).toContain('ta.js')
    expect(scriptTags[2]).toContain('nct.js')
  })

  it('不明なASP名は無視されること', () => {
    const html = generateItpScriptTags(['unknown-asp'])
    expect(html).toBe('')
  })

  it('空配列で空文字列を返すこと', () => {
    const html = generateItpScriptTags([])
    expect(html).toBe('')
  })

  it('有効・無効混在のASPリストで有効なもののみ生成すること', () => {
    const html = generateItpScriptTags(['a8', 'invalid', 'afb'])
    expect(html).toContain('a8sales.js')
    expect(html).toContain('ta.js')
    expect(html).not.toContain('invalid')
  })
})

// ==============================================================
// getItpScriptConfigs テスト
// ==============================================================

describe('getItpScriptConfigs', () => {
  it('afb のスクリプト設定を取得すること', () => {
    const configs = getItpScriptConfigs(['afb'])
    expect(configs.length).toBe(1)
    expect(configs[0].aspName).toBe('afb')
    expect(configs[0].url).toBe('https://t.afi-b.com/ta.js')
    expect(configs[0].attributes['data-afb-id']).toBe('afb-tracking')
  })

  it('複数ASPの設定を取得すること', () => {
    const configs = getItpScriptConfigs(['a8', 'afb', 'accesstrade'])
    expect(configs.length).toBe(3)
    expect(configs.map((c) => c.aspName)).toEqual(['a8', 'afb', 'accesstrade'])
  })

  it('各設定にurl, aspName, attributes が含まれること', () => {
    const configs = getItpScriptConfigs(['a8', 'afb'])
    for (const config of configs) {
      expect(config.aspName).toBeDefined()
      expect(config.url).toBeDefined()
      expect(config.url.startsWith('https://')).toBe(true)
      expect(config.attributes).toBeDefined()
      expect(typeof config.attributes).toBe('object')
    }
  })

  it('不明なASP名はフィルタされること', () => {
    const configs = getItpScriptConfigs(['unknown'])
    expect(configs.length).toBe(0)
  })

  it('空配列で空配列を返すこと', () => {
    const configs = getItpScriptConfigs([])
    expect(configs.length).toBe(0)
  })
})

// ==============================================================
// config テスト
// ==============================================================

describe('ミドルウェア config', () => {
  it('matcher が /articles/:path* を含むこと', () => {
    expect(config.matcher).toContain('/articles/:path*')
  })

  it('matcher が /admin/:path* を含むこと', () => {
    expect(config.matcher).toContain('/admin/:path*')
  })

  it('matcher 配列が空でないこと', () => {
    expect(config.matcher.length).toBeGreaterThan(0)
  })
})
