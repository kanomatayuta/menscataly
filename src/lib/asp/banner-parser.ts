/**
 * バナーパーサー — ASP発行HTMLからバナーサイズ・画像URL・アフィリエイトURLを自動パース
 *
 * 対応ASP:
 * - A8.net: <a><img width/height /></a><img 1x1 />
 * - afb: <a><img width/height /></a>
 * - AccessTrade: <img width/height />
 * - ValueCommerce: <iframe width/height />
 * - style属性指定: <img style="width: Npx; height: Npx;" />
 *
 * セキュリティ:
 * - scriptタグ検出 → 警告ログ + null返却
 * - 不正URLバリデーション
 * - 異常サイズ (>2000px) の拒否
 */

import type { AdCreative } from '@/types/asp-config'

// ============================================================
// 定数
// ============================================================

/** バナーサイズの上限 (px) — これを超えるものは不正と判断 */
const MAX_BANNER_DIMENSION = 2000

/** トラッキングピクセルの閾値サイズ (px) */
const TRACKING_PIXEL_MAX_SIZE = 2

/** 有効なURLプロトコル */
const VALID_URL_PROTOCOLS = ['http:', 'https:']

// ============================================================
// パース結果型
// ============================================================

export interface BannerParseResult {
  /** バナー幅 (px) */
  width: number
  /** バナー高さ (px) */
  height: number
  /** バナー画像URL */
  imageUrl: string | null
  /** アフィリエイトURL (<a> の href) */
  affiliateUrl: string | null
}

// ============================================================
// セキュリティチェック
// ============================================================

/**
 * rawHTML内のscriptタグを検出する
 * scriptタグが含まれる場合は警告ログを出力しtrueを返す
 */
export function containsScriptTag(html: string): boolean {
  const scriptPattern = /<script[\s>]/i
  if (scriptPattern.test(html)) {
    console.warn('[banner-parser] XSS警告: rawHTML内にscriptタグが検出されました')
    return true
  }
  return false
}

/**
 * URLが有効なhttp/httpsプロトコルかどうかを検証する
 * javascript:, data:, vbscript: 等の危険なプロトコルを拒否する
 */
export function isValidUrl(url: string): boolean {
  if (!url || url.trim().length === 0) return false

  try {
    const parsed = new URL(url)
    return VALID_URL_PROTOCOLS.includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * バナーサイズが有効範囲内かどうかを検証する
 * 0以下または MAX_BANNER_DIMENSION 超はfalse
 */
export function isValidBannerSize(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false
  if (width > MAX_BANNER_DIMENSION || height > MAX_BANNER_DIMENSION) return false
  return true
}

// ============================================================
// サイズパース
// ============================================================

/**
 * HTML属性からwidth/heightを抽出する
 */
function parseAttributeSize(html: string): { width: number; height: number } | null {
  const widthMatch = html.match(/\bwidth\s*=\s*["']?(\d+)["']?/i)
  const heightMatch = html.match(/\bheight\s*=\s*["']?(\d+)["']?/i)

  if (widthMatch && heightMatch) {
    const width = parseInt(widthMatch[1], 10)
    const height = parseInt(heightMatch[1], 10)
    return { width, height }
  }

  return null
}

/**
 * style属性からwidth/heightを抽出する
 */
function parseStyleSize(html: string): { width: number; height: number } | null {
  const styleMatch = html.match(/style\s*=\s*["']([^"']+)["']/i)
  if (!styleMatch) return null

  const style = styleMatch[1]
  const widthMatch = style.match(/width\s*:\s*(\d+)\s*px/i)
  const heightMatch = style.match(/height\s*:\s*(\d+)\s*px/i)

  if (widthMatch && heightMatch) {
    const width = parseInt(widthMatch[1], 10)
    const height = parseInt(heightMatch[1], 10)
    return { width, height }
  }

  return null
}

// ============================================================
// 要素抽出
// ============================================================

/**
 * トラッキングピクセルを除いたimg/iframeタグを抽出する
 */
function extractMainElements(html: string): string[] {
  const elements: string[] = []

  const imgPattern = /<img\b[^>]*\/?>/gi
  let match: RegExpExecArray | null
  while ((match = imgPattern.exec(html)) !== null) {
    const tag = match[0]
    const attrSize = parseAttributeSize(tag)
    if (attrSize && attrSize.width <= TRACKING_PIXEL_MAX_SIZE && attrSize.height <= TRACKING_PIXEL_MAX_SIZE) {
      continue
    }
    elements.push(tag)
  }

  const iframePattern = /<iframe\b[^>]*(?:\/>|>[\s\S]*?<\/iframe>)/gi
  while ((match = iframePattern.exec(html)) !== null) {
    elements.push(match[0])
  }

  return elements
}

function extractSrc(element: string): string | null {
  const srcMatch = element.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
  return srcMatch ? srcMatch[1] : null
}

function extractAffiliateUrl(html: string): string | null {
  const hrefMatch = html.match(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i)
  return hrefMatch ? hrefMatch[1] : null
}

// ============================================================
// メインパース関数
// ============================================================

/**
 * ASP発行HTMLからバナーサイズ・画像URL・アフィリエイトURLをパースする
 */
export function parseBannerHtml(rawHtml: string | null | undefined): BannerParseResult | null {
  if (!rawHtml || rawHtml.trim().length === 0) return null
  if (containsScriptTag(rawHtml)) return null

  const mainElements = extractMainElements(rawHtml)
  if (mainElements.length === 0) return null

  const primaryElement = mainElements[0]
  let size = parseAttributeSize(primaryElement) ?? parseStyleSize(primaryElement)

  if (!size) {
    size = parseStyleSize(rawHtml)
  }

  if (!size) return null

  if (!isValidBannerSize(size.width, size.height)) {
    if (size.width > MAX_BANNER_DIMENSION || size.height > MAX_BANNER_DIMENSION) {
      console.warn(`[banner-parser] 異常サイズ検出: ${size.width}x${size.height} (上限: ${MAX_BANNER_DIMENSION}px)`)
    }
    return null
  }

  let imageUrl = extractSrc(primaryElement)
  if (imageUrl && !isValidUrl(imageUrl)) {
    console.warn(`[banner-parser] 不正な画像URL: ${imageUrl}`)
    imageUrl = null
  }

  let affiliateUrl = extractAffiliateUrl(rawHtml)
  if (affiliateUrl && !isValidUrl(affiliateUrl)) {
    console.warn(`[banner-parser] 不正なアフィリエイトURL: ${affiliateUrl}`)
    affiliateUrl = null
  }

  return {
    width: size.width,
    height: size.height,
    imageUrl,
    affiliateUrl,
  }
}

// ============================================================
// バナー配置適合性判定
// ============================================================

/** 配置コンテキスト */
export type BannerPlacement = 'inline' | 'sidebar'

/**
 * バナーサイズが配置コンテキストに適しているか判定する (純粋関数版)
 *
 * sidebar: 幅320px以下 かつ アスペクト比1.5以下 (縦長〜正方形)
 * inline:  幅300px以上 かつ アスペクト比0.8以上 (横長〜正方形)
 *
 * IAB標準バナーサイズ対応:
 * - 300x250 → sidebar=true, inline=true
 * - 728x90  → sidebar=false, inline=true
 * - 160x600 → sidebar=true, inline=false
 * - 468x60  → sidebar=false, inline=true
 * - 320x100 → sidebar=false, inline=true
 * - 120x600 → sidebar=true, inline=false
 * - 336x280 → sidebar=false, inline=true
 */
export function isBannerSuitableFor(width: number, height: number, placement: BannerPlacement): boolean {
  if (width <= 0 || height <= 0) return false
  const ratio = width / height

  if (placement === 'sidebar') {
    return ratio <= 1.5 && width <= 320
  }
  // inline: 横長 or 中型レクタングル, 幅300px以上
  return ratio >= 0.8 && width >= 300
}

// ============================================================
// AdCreativeエンリッチメント
// ============================================================

/**
 * AdCreativeのrawHtmlからバナーサイズを自動パースし、width/height/imageUrlを補完する
 * 既にwidth/heightが設定済みの場合はスキップ（手動設定優先）
 */
export function enrichCreativeWithParsedSize(creative: AdCreative): AdCreative {
  if (creative.width != null && creative.height != null) return creative
  if (!creative.rawHtml) return creative
  if (creative.type !== 'banner') return creative

  const parsed = parseBannerHtml(creative.rawHtml)
  if (!parsed) return creative

  return {
    ...creative,
    width: parsed.width,
    height: parsed.height,
    imageUrl: parsed.imageUrl ?? creative.imageUrl,
    affiliateUrl: parsed.affiliateUrl ?? creative.affiliateUrl,
  }
}
