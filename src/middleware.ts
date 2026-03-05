/**
 * Next.js ミドルウェア
 * - 管理者ルート認証保護 (/admin/*)
 * - ASP ITPトラッキングスクリプト自動注入
 * - ファーストパーティ Cookie アフィリエイトトラッキング (Safari/Firefox ITP対策)
 *
 * 管理者ルート (/admin/*) にアクセスした場合:
 *   1. /admin/login はそのまま通す
 *   2. それ以外は admin-token Cookie を検証
 *   3. 未認証の場合は /admin/login にリダイレクト
 *
 * 記事ページ (/articles/*) にアクセスした場合:
 *   1. アフィリエイトクリックパラメータ (utm_source, asp_ref, a8mat 等) を検出
 *   2. ファーストパーティ Cookie に保存 (ITP で失われるサードパーティ Cookie の代替)
 *   3. ASP ITPスクリプトタグを HTML レスポンスに注入
 */

import { NextRequest, NextResponse } from 'next/server'

// ============================================================
// 設定定数
// ============================================================

/** 管理者認証 Cookie 名 */
const ADMIN_TOKEN_COOKIE = 'admin-token'

/** 管理者ルートのパスパターン */
const ADMIN_PATH_REGEX = /^\/admin(\/.*)?$/

/** ログインページのパス */
const ADMIN_LOGIN_PATH = '/admin/login'

/** トラッキング Cookie 名 */
const TRACKING_COOKIE_NAME = '_mc_aff'

/** Cookie 有効期限 (日数) — ITP制限下でも1st party cookieは7日間保持 */
const COOKIE_MAX_AGE_DAYS = 7

/** 記事ページのパスパターン */
const ARTICLE_PATH_REGEX = /^\/articles\/.+/

/** ASPクリックパラメータマッピング */
const ASP_CLICK_PARAMS: Record<string, string> = {
  'a8mat': 'a8',
  'afb_ref': 'afb',
  'at_ref': 'accesstrade',
  'vc_ref': 'valuecommerce',
  'fm_ref': 'felmat',
  'moshimo_ref': 'moshimo',
  'asp_ref': 'generic',    // 汎用ASPパラメータ
  'utm_source': 'utm',     // UTMパラメータ (ASP連携用)
}

/** ASP別 ITPトラッキングスクリプトURL */
const ITP_SCRIPT_MAP: Record<string, { url: string; attributes: Record<string, string> }> = {
  afb: {
    url: 'https://t.afi-b.com/ta.js',
    attributes: { 'data-afb-id': 'afb-tracking', 'data-afb-mode': 'itp' },
  },
  a8: {
    url: 'https://statics.a8.net/a8sales/a8sales.js',
    attributes: { 'data-a8': process.env.A8_MEDIA_ID ?? '' },
  },
  accesstrade: {
    url: 'https://h.accesstrade.net/js/nct/nct.js',
    attributes: { 'data-at-id': 'accesstrade-tracking', 'data-at-server': 'true' },
  },
  valuecommerce: {
    url: 'https://amd.c.yimg.jp/amd/vcsc/vc_bridge.js',
    attributes: { 'data-vc-id': 'valuecommerce-tracking', 'data-vc-mode': 'bridge' },
  },
  felmat: {
    url: 'https://www.felmat.net/fmimg/fm.js',
    attributes: { 'data-fm-id': 'felmat-tracking', 'data-fm-itp': 'server' },
  },
  moshimo: {
    url: 'https://af.moshimo.com/af/r/result.js',
    attributes: { 'data-moshimo-id': 'moshimo-tracking', 'data-moshimo-itp': 'true' },
  },
}

// ============================================================
// ミドルウェア本体
// ============================================================

/**
 * admin-token Cookie を検証する
 * Edge Runtime では crypto.timingSafeEqual が使えないため、
 * 定数時間比較をピュアJSで実装する
 */
function verifyAdminToken(token: string, expected: string): boolean {
  if (token.length !== expected.length) {
    // 長さが異なる場合でもダミー比較を実行して定数時間にする
    let result = 1
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ expected.charCodeAt(i)
    }
    return result === 0 // 常に false
  }
  let result = 0
  for (let i = 0; i < token.length; i++) {
    result |= token.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return result === 0
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname, searchParams } = request.nextUrl

  // --------------------------------------------------------
  // 管理者ルート認証チェック
  // --------------------------------------------------------
  if (ADMIN_PATH_REGEX.test(pathname)) {
    // /admin/login はそのまま通す（認証不要）
    if (pathname === ADMIN_LOGIN_PATH) {
      const response = NextResponse.next()
      response.headers.set('x-admin-pathname', pathname)
      return response
    }

    const adminApiKey = process.env.ADMIN_API_KEY

    // admin-token Cookie を検証
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value

    if (!token || !adminApiKey || !verifyAdminToken(token, adminApiKey)) {
      // 未認証 → ログインページにリダイレクト
      const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const response = NextResponse.next()
    response.headers.set('x-admin-pathname', pathname)
    return response
  }

  // --------------------------------------------------------
  // 記事ページ: ITPトラッキング処理
  // --------------------------------------------------------
  const response = NextResponse.next()

  // 記事ページ以外はスキップ
  if (!ARTICLE_PATH_REGEX.test(pathname)) {
    return response
  }

  // --------------------------------------------------------
  // 1. ASPクリックパラメータ検出 → ファーストパーティ Cookie 保存
  // --------------------------------------------------------
  const detectedAsps = detectAspParams(searchParams)

  if (detectedAsps.length > 0) {
    const trackingData: AffiliateTrackingData = {
      asps: detectedAsps,
      referrer: request.headers.get('referer') ?? '',
      landingPath: pathname,
      timestamp: Date.now(),
    }

    // ファーストパーティ Cookie にトラッキングデータを保存
    response.cookies.set(TRACKING_COOKIE_NAME, JSON.stringify(trackingData), {
      path: '/',
      maxAge: COOKIE_MAX_AGE_DAYS * 24 * 60 * 60,
      httpOnly: false,    // クライアントサイドJSからも読み取り可能に
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',    // ITP対策: Lax で設定
    })
  }

  // --------------------------------------------------------
  // 2. 既存トラッキング Cookie の読み取り
  // --------------------------------------------------------
  const existingCookie = request.cookies.get(TRACKING_COOKIE_NAME)
  let activeAsps: string[] = []

  if (existingCookie) {
    try {
      const data = JSON.parse(existingCookie.value) as AffiliateTrackingData
      activeAsps = data.asps.map((a) => a.aspName)
    } catch {
      // Cookie パース失敗は無視
    }
  }

  // URL パラメータから検出したASP も追加
  for (const asp of detectedAsps) {
    if (!activeAsps.includes(asp.aspName)) {
      activeAsps.push(asp.aspName)
    }
  }

  // --------------------------------------------------------
  // 3. ITPスクリプト注入用ヘッダーを設定
  //    (実際のHTML注入はクライアントサイドの <Script> コンポーネントが
  //     このヘッダーを読み取って行う)
  // --------------------------------------------------------
  if (activeAsps.length > 0) {
    // カスタムヘッダーでアクティブなASP名を渡す
    response.headers.set('X-Active-ASPs', activeAsps.join(','))

    // ITPスクリプトURLリストをヘッダーで渡す
    const scriptUrls = activeAsps
      .filter((asp) => asp in ITP_SCRIPT_MAP)
      .map((asp) => ITP_SCRIPT_MAP[asp].url)

    if (scriptUrls.length > 0) {
      response.headers.set('X-ITP-Scripts', scriptUrls.join(','))
    }
  }

  return response
}

// ============================================================
// ヘルパー関数
// ============================================================

interface DetectedAsp {
  aspName: string
  paramName: string
  paramValue: string
}

interface AffiliateTrackingData {
  asps: DetectedAsp[]
  referrer: string
  landingPath: string
  timestamp: number
}

/**
 * URLパラメータからASPクリックパラメータを検出する
 */
function detectAspParams(searchParams: URLSearchParams): DetectedAsp[] {
  const detected: DetectedAsp[] = []

  for (const [paramName, aspName] of Object.entries(ASP_CLICK_PARAMS)) {
    const value = searchParams.get(paramName)
    if (value) {
      detected.push({
        aspName,
        paramName,
        paramValue: value,
      })
    }
  }

  return detected
}

/**
 * 指定ASPのITPスクリプトタグHTMLを生成する (SSR用ユーティリティ)
 */
export function generateItpScriptTags(aspNames: string[]): string {
  return aspNames
    .filter((asp) => asp in ITP_SCRIPT_MAP)
    .map((asp) => {
      const config = ITP_SCRIPT_MAP[asp]
      const attrs = Object.entries(config.attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')
      return `<script src="${config.url}" ${attrs} async></script>`
    })
    .join('\n')
}

/**
 * ITPスクリプト設定を取得する (コンポーネント用)
 */
export function getItpScriptConfigs(aspNames: string[]): Array<{
  aspName: string
  url: string
  attributes: Record<string, string>
}> {
  return aspNames
    .filter((asp) => asp in ITP_SCRIPT_MAP)
    .map((asp) => ({
      aspName: asp,
      url: ITP_SCRIPT_MAP[asp].url,
      attributes: ITP_SCRIPT_MAP[asp].attributes,
    }))
}

// ============================================================
// ミドルウェア設定
// ============================================================

export const config = {
  matcher: [
    // 管理者ルート (認証保護)
    '/admin/:path*',
    // 記事ページ (ITPトラッキング)
    '/articles/:path*',
  ],
}
