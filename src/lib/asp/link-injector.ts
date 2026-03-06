/**
 * ASPアフィリエイトリンク注入モジュール
 * HTMLコンテンツ中のアンカーテキストをアフィリエイトリンクに変換する
 *
 * マッチング優先順位:
 * 1. 完全一致（最速）
 * 2. 正規化マッチング（助詞除去・空白正規化）
 * 3. コアネーム マッチング（プログラム名で部分一致）
 */

import type { ContentCategory } from '@/types/content'
import type { AspProgram, AdCreative } from '@/types/asp-config'
import { selectBestPrograms } from './selector'

// ============================================================
// 定数
// ============================================================

/** 正規化時に除去する日本語助詞 */
const JAPANESE_PARTICLES = ['の', 'を', 'は', 'が', 'に', 'で', 'と', 'も', 'へ']

/** コアネーム抽出時に除去するサフィックス */
const ANCHOR_SUFFIXES = [
  '公式サイト',
  'の詳細を見る',
  '詳細はこちら',
  '無料カウンセリング',
  'オンライン診療',
]

// ============================================================
// HTML エスケープ
// ============================================================

/** HTML属性値用エスケープ */
function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ============================================================
// テキスト正規化ヘルパー
// ============================================================

/**
 * テキストを正規化する（助詞除去・空白正規化）
 * テスト用に公開する
 *
 * @internal
 */
export function normalizeText(text: string): string {
  let normalized = text

  // 全角スペースを半角スペースに統一
  normalized = normalized.replace(/\u3000/g, ' ')

  // 連続する空白を除去（完全に空白を取り除く）
  normalized = normalized.replace(/\s+/g, '')

  // 日本語助詞を除去
  for (const particle of JAPANESE_PARTICLES) {
    normalized = normalized.split(particle).join('')
  }

  return normalized
}

/**
 * アンカーテキストからコアネーム（プログラム固有名）を抽出する
 * サフィックス（"公式サイト" 等）を除去し、末尾の空白をトリムする
 *
 * @internal
 */
export function extractCoreName(anchor: string): string {
  let core = anchor
  let matched = false

  for (const suffix of ANCHOR_SUFFIXES) {
    // 「の公式サイト」のように助詞付きサフィックスを先にチェック（より長いパターン優先）
    for (const particle of JAPANESE_PARTICLES) {
      const withParticle = particle + suffix
      if (core.endsWith(withParticle)) {
        core = core.slice(0, -withParticle.length)
        matched = true
        break
      }
    }
    if (matched) break

    if (core.endsWith(suffix)) {
      core = core.slice(0, -suffix.length)
      break
    }
  }

  return core.trim()
}

// ============================================================
// 禁止タグ範囲の事前計算
// ============================================================

interface ForbiddenRange { start: number; end: number }

/** コンテンツ全体の禁止タグ範囲を一度計算する */
function computeForbiddenRanges(content: string): ForbiddenRange[] {
  const ranges: ForbiddenRange[] = []
  const pattern = /<(a|h2|h3|script)\b[^>]*>[\s\S]*?<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length })
  }
  return ranges
}

/** 禁止範囲内かチェック（事前計算済みの範囲を使用） */
function isInForbiddenRange(ranges: ForbiddenRange[], index: number, matchLength: number): boolean {
  return ranges.some(r => index >= r.start && index + matchLength <= r.end)
}

// ============================================================
// リンク注入
// ============================================================

/**
 * カテゴリに応じたアフィリエイトリンクをHTMLコンテンツに注入する
 *
 * - selectBestPrograms() で上位プログラムを選定
 * - 各プログラムの recommendedAnchors[] をコンテンツ内で検索
 * - 最初にヒットしたアンカーテキストのみリンク化（重複注入なし）
 *
 * @param htmlContent  対象HTMLコンテンツ
 * @param category     コンテンツカテゴリ
 * @param maxLinks     最大リンク数（デフォルト: 3）
 * @returns リンク注入済みHTMLコンテンツ
 */
export async function injectAffiliateLinksByCategory(
  htmlContent: string,
  category: ContentCategory,
  maxLinks: number = 3
): Promise<string> {
  const programs = await selectBestPrograms(category, { maxResults: maxLinks })

  if (programs.length === 0) {
    return htmlContent
  }

  let content = htmlContent
  let injectedCount = 0

  for (const program of programs) {
    if (injectedCount >= maxLinks) break

    const injected = injectSingleLink(content, program)
    if (injected !== null) {
      content = injected
      injectedCount++
    }
  }

  return content
}

/**
 * プログラムからテキストリンク用クリエイティブを解決する
 * adCreatives (useForInjection=true) があればそのURLを使用
 * rawHtml がある場合は rawHtml をそのまま注入に使用する
 * adCreatives が登録されていない場合は空配列を返す（リンク注入しない）
 */
export function resolveTextCreatives(
  program: AspProgram
): Array<{ affiliateUrl?: string; anchors: string[]; rawHtml?: string }> {
  if (program.adCreatives && program.adCreatives.length > 0) {
    const textCreatives = program.adCreatives.filter(
      (c) => c.type === 'text' && c.isActive && c.useForInjection
    )
    if (textCreatives.length > 0) {
      return textCreatives
        .map((c) => ({
          affiliateUrl: c.affiliateUrl,
          anchors: c.anchorText ? [c.anchorText] : program.recommendedAnchors,
          rawHtml: c.rawHtml,
        }))
        .filter((c) => c.rawHtml || c.anchors.length > 0)
    }
  }
  // adCreatives が未登録または有効なテキストクリエイティブがない場合はリンク注入しない
  return []
}

/**
 * バナーHTMLを生成する
 * 1. rawHtml がある場合はそのまま返す（ASP発行のトラッキングピクセル保持）
 * 2. imageUrl + affiliateUrl がある場合は <a><img> を生成（サイズ情報付き）
 */
export function generateBannerHtml(creative: AdCreative, aspName: string, programId: string, category: string): string {
  if (creative.type !== 'banner') return ''

  // 1. rawHtml がある場合はそのまま返す（トラッキングピクセル含む）
  if (creative.rawHtml) return creative.rawHtml

  // 2. imageUrl + affiliateUrl からバナーを生成
  if (creative.imageUrl && creative.affiliateUrl) {
    const w = creative.width ?? 300
    const h = creative.height ?? 250
    const alt = escapeHtmlAttr(creative.label || creative.anchorText || '')
    return `<a href="${escapeHtmlAttr(creative.affiliateUrl)}" rel="sponsored noopener" target="_blank" data-asp="${escapeHtmlAttr(aspName)}" data-program="${escapeHtmlAttr(programId)}" data-category="${escapeHtmlAttr(category)}"><img src="${escapeHtmlAttr(creative.imageUrl)}" width="${w}" height="${h}" alt="${alt}" loading="lazy" style="max-width:100%;height:auto;"></a>`
  }

  // 3. affiliateUrl のみ（テキストリンクバナー）
  if (creative.affiliateUrl) {
    const text = creative.anchorText || creative.label || ''
    if (!text) return ''
    return `<a href="${escapeHtmlAttr(creative.affiliateUrl)}" rel="sponsored noopener" target="_blank" class="cta-banner-link" data-asp="${escapeHtmlAttr(aspName)}" data-program="${escapeHtmlAttr(programId)}" data-category="${escapeHtmlAttr(category)}">${escapeHtmlAttr(text)}</a>`
  }

  return ''
}

/**
 * カテゴリ別バナーセクションHTMLを生成する
 */
export async function generateBannerSection(
  category: ContentCategory,
  maxPrograms: number = 3
): Promise<string> {
  const programs = await selectBestPrograms(category, { maxResults: maxPrograms })
  const bannerHtmls: string[] = []

  for (const program of programs) {
    if (!program.adCreatives) continue
    const bannerCreatives = program.adCreatives.filter(
      (c) => c.type === 'banner' && c.isActive && c.useForBanner
    )
    for (const creative of bannerCreatives) {
      bannerHtmls.push(generateBannerHtml(creative, program.aspName, program.programId, program.category))
    }
  }

  if (bannerHtmls.length === 0) return ''

  return `<div class="affiliate-banner-section">
<p>※以下はアフィリエイト広告です</p>
${bannerHtmls.join('\n')}
</div>`
}

/**
 * 単一プログラムのアフィリエイトリンクをコンテンツに注入する
 * adCreatives (useForInjection) のクリエイティブURLを使用
 * adCreatives が未登録の場合はリンク注入しない
 *
 * マッチング優先順位:
 * 1. 完全一致
 * 2. 正規化マッチング（助詞除去・空白正規化）
 * 3. コアネーム マッチング
 *
 * @returns リンク注入後のコンテンツ。注入できなかった場合は null
 */
function injectSingleLink(
  content: string,
  program: AspProgram
): string | null {
  // 禁止範囲を一度だけ計算する
  const forbiddenRanges = computeForbiddenRanges(content)

  // クリエイティブからテキストリンク用を解決
  const creatives = resolveTextCreatives(program)

  for (const creative of creatives) {
    // rawHtml がある場合: アンカーテキストの出現位置を rawHtml で置換
    if (creative.rawHtml) {
      for (const anchor of creative.anchors) {
        const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const alreadyLinked = new RegExp(`<a\\s[^>]*>[^<]*${escapedAnchor}[^<]*</a>`, 'i')
        if (alreadyLinked.test(content)) continue

        const index = content.indexOf(anchor)
        if (index === -1) continue
        if (isInForbiddenRange(forbiddenRanges, index, anchor.length)) continue

        const before = content.slice(0, index)
        const after = content.slice(index + anchor.length)
        return before + creative.rawHtml + after
      }
      continue
    }

    // クリエイティブにaffiliate URLがない場合はスキップ
    if (!creative.affiliateUrl) continue

    const creativeUrl = creative.affiliateUrl

    for (const anchor of creative.anchors) {
      // 既にリンク化済み（<a> タグ内）でないかチェック
      const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const alreadyLinked = new RegExp(
        `<a\\s[^>]*>[^<]*${escapedAnchor}[^<]*</a>`,
        'i'
      )

      if (alreadyLinked.test(content)) {
        continue
      }

      // --- Pass 1: 完全一致 ---
      const exactResult = tryExactMatch(content, anchor, program, creativeUrl, forbiddenRanges)
      if (exactResult !== null) return exactResult

      // --- Pass 2: 正規化マッチング ---
      const normalizedResult = tryNormalizedMatch(content, anchor, program, creativeUrl, forbiddenRanges)
      if (normalizedResult !== null) return normalizedResult

      // --- Pass 3: コアネーム マッチング ---
      const coreResult = tryCoreNameMatch(content, anchor, program, creativeUrl, forbiddenRanges)
      if (coreResult !== null) return coreResult
    }
  }

  return null
}

/**
 * Pass 1: 完全一致でリンクを注入する
 */
function tryExactMatch(
  content: string,
  anchor: string,
  program: AspProgram,
  affiliateUrl: string,
  forbiddenRanges: ForbiddenRange[]
): string | null {
  const index = content.indexOf(anchor)
  if (index === -1) return null

  // 禁止タグ内チェック
  if (isInForbiddenRange(forbiddenRanges, index, anchor.length)) return null

  const linkHtml = `<a href="${escapeHtmlAttr(affiliateUrl)}" rel="sponsored noopener" target="_blank" data-asp="${escapeHtmlAttr(program.aspName)}" data-program="${escapeHtmlAttr(program.programId)}" data-category="${escapeHtmlAttr(program.category)}">${anchor}</a>`
  const before = content.slice(0, index)
  const after = content.slice(index + anchor.length)

  return before + linkHtml + after
}

/**
 * Pass 2: 正規化マッチング
 * 助詞・空白を除去した上でコンテンツ内のテキストと照合する。
 * マッチした場合は元のコンテンツ上のテキストをそのままリンクテキストとして使用する。
 */
function tryNormalizedMatch(
  content: string,
  anchor: string,
  program: AspProgram,
  affiliateUrl: string,
  forbiddenRanges: ForbiddenRange[]
): string | null {
  const normalizedAnchor = normalizeText(anchor)
  if (normalizedAnchor.length === 0) return null

  // コンテンツからHTMLタグを除いたテキスト部分をスキャンする
  // テキストノード（タグ外テキスト）の各部分に対して正規化マッチを試みる
  const textSegments = extractTextSegments(content, forbiddenRanges)

  for (const segment of textSegments) {
    const normalizedSegment = normalizeText(segment.text)
    const normalizedIndex = normalizedSegment.indexOf(normalizedAnchor)

    if (normalizedIndex === -1) continue

    // 正規化前のテキストで対応する範囲を特定する
    const originalRange = findOriginalRange(segment.text, normalizedAnchor)
    if (originalRange === null) continue

    const absoluteStart = segment.start + originalRange.start
    const absoluteEnd = segment.start + originalRange.end
    const matchedText = content.slice(absoluteStart, absoluteEnd)

    // 禁止タグ内チェック
    if (isInForbiddenRange(forbiddenRanges, absoluteStart, matchedText.length)) continue

    const linkHtml = `<a href="${escapeHtmlAttr(affiliateUrl)}" rel="sponsored noopener" target="_blank" data-asp="${escapeHtmlAttr(program.aspName)}" data-program="${escapeHtmlAttr(program.programId)}" data-category="${escapeHtmlAttr(program.category)}">${matchedText}</a>`
    const before = content.slice(0, absoluteStart)
    const after = content.slice(absoluteEnd)

    return before + linkHtml + after
  }

  return null
}

/**
 * Pass 3: コアネーム マッチング
 * アンカーテキストからコアネーム（例: "AGAスキンクリニック"）を抽出し、
 * コンテンツ内でそのコアネームを検索する。
 * 見つかった場合はコアネーム部分のみをリンクテキストとして使用する。
 */
function tryCoreNameMatch(
  content: string,
  anchor: string,
  program: AspProgram,
  affiliateUrl: string,
  forbiddenRanges: ForbiddenRange[]
): string | null {
  const coreName = extractCoreName(anchor)

  // コアネームがアンカーと同一、または空の場合はスキップ
  // （Pass 1/2 で既にチェック済みのため）
  if (coreName === anchor || coreName.length === 0) return null

  const index = content.indexOf(coreName)
  if (index === -1) return null

  // 禁止タグ内チェック
  if (isInForbiddenRange(forbiddenRanges, index, coreName.length)) return null

  const linkHtml = `<a href="${escapeHtmlAttr(affiliateUrl)}" rel="sponsored noopener" target="_blank" data-asp="${escapeHtmlAttr(program.aspName)}" data-program="${escapeHtmlAttr(program.programId)}" data-category="${escapeHtmlAttr(program.category)}">${coreName}</a>`
  const before = content.slice(0, index)
  const after = content.slice(index + coreName.length)

  return before + linkHtml + after
}

// ============================================================
// HTMLテキストセグメント抽出
// ============================================================

interface TextSegment {
  /** セグメントテキスト */
  text: string
  /** コンテンツ全体における開始インデックス */
  start: number
}

/**
 * HTMLコンテンツからタグ外のテキストセグメントを抽出する
 * 禁止タグ（<a>, <h2>, <h3>, <script>）内のテキストは除外する
 */
function extractTextSegments(content: string, forbiddenRanges: ForbiddenRange[]): TextSegment[] {
  const segments: TextSegment[] = []

  // HTMLタグ（任意）を検出してテキストセグメントを分割
  const tagPattern = /<[^>]+>/g
  let lastEnd = 0
  let tagMatch: RegExpExecArray | null

  while ((tagMatch = tagPattern.exec(content)) !== null) {
    if (tagMatch.index > lastEnd) {
      const segStart = lastEnd
      const segText = content.slice(segStart, tagMatch.index)

      // 禁止範囲内でなければ追加
      const inForbidden = forbiddenRanges.some(
        (r) => segStart >= r.start && tagMatch!.index <= r.end
      )
      if (!inForbidden && segText.length > 0) {
        segments.push({ text: segText, start: segStart })
      }
    }
    lastEnd = tagMatch.index + tagMatch[0].length
  }

  // 末尾の残りテキスト
  if (lastEnd < content.length) {
    const segText = content.slice(lastEnd)
    const inForbidden = forbiddenRanges.some(
      (r) => lastEnd >= r.start && content.length <= r.end
    )
    if (!inForbidden && segText.length > 0) {
      segments.push({ text: segText, start: lastEnd })
    }
  }

  return segments
}

/**
 * 正規化前のテキストから、正規化後のアンカーに対応する元テキストの範囲を特定する
 *
 * 正規化は「助詞除去」+「空白除去」なので、元テキストの各文字を正規化しながら
 * 正規化後の文字列中のアンカー位置に対応する元テキストの開始/終了インデックスを計算する
 */
function findOriginalRange(
  originalText: string,
  normalizedAnchor: string
): { start: number; end: number } | null {
  // 元テキストの各文字について、正規化後に残るかどうかをマッピング
  const charMap: Array<{ origIndex: number; normalizedChar: string }> = []

  for (let i = 0; i < originalText.length; i++) {
    const ch = originalText[i]

    // 空白（半角・全角）チェック
    if (ch === ' ' || ch === '\u3000' || ch === '\t' || ch === '\n' || ch === '\r') {
      continue
    }

    // 助詞チェック
    if (JAPANESE_PARTICLES.includes(ch)) {
      continue
    }

    charMap.push({ origIndex: i, normalizedChar: ch })
  }

  // charMap から正規化テキストを組み立ててアンカーを検索
  const normalizedFull = charMap.map((c) => c.normalizedChar).join('')
  const anchorIdx = normalizedFull.indexOf(normalizedAnchor)

  if (anchorIdx === -1) return null

  const startOrigIdx = charMap[anchorIdx].origIndex
  const endMapIdx = anchorIdx + normalizedAnchor.length - 1
  const endOrigIdx = charMap[endMapIdx].origIndex + 1

  return { start: startOrigIdx, end: endOrigIdx }
}

// ============================================================
// アフィリエイトセクション生成
// ============================================================

/**
 * アフィリエイトリンクのHTMLセクションを生成する（記事末尾追加用）
 *
 * @param category     コンテンツカテゴリ
 * @param maxPrograms  最大プログラム数（デフォルト: 3）
 * @returns HTMLセクション文字列
 */
export async function generateAffiliateSection(
  category: ContentCategory,
  maxPrograms: number = 3
): Promise<string> {
  const programs = await selectBestPrograms(category, { maxResults: maxPrograms })

  if (programs.length === 0) {
    return ''
  }

  const listItems: string[] = []
  for (const p of programs) {
    // adCreatives からアクティブなテキストクリエイティブを探す
    const textCreative = p.adCreatives?.find(
      (c) => c.type === 'text' && c.isActive && c.useForInjection
    )

    if (textCreative?.rawHtml) {
      // rawHtml がある場合はそのまま使用
      listItems.push(`  <li>${textCreative.rawHtml} - ${p.programName}</li>`)
    } else if (textCreative?.affiliateUrl) {
      // クリエイティブの affiliateUrl を使用
      const anchorText = textCreative.anchorText || p.recommendedAnchors[0] || p.programName
      listItems.push(
        `  <li><a href="${escapeHtmlAttr(textCreative.affiliateUrl)}" rel="sponsored noopener" target="_blank" data-asp="${escapeHtmlAttr(p.aspName)}" data-program="${escapeHtmlAttr(p.programId)}" data-category="${escapeHtmlAttr(p.category)}">${anchorText}</a> - ${p.programName}</li>`
      )
    }
    // adCreatives が無い or 有効なテキストクリエイティブが無い場合はスキップ
  }

  if (listItems.length === 0) {
    return ''
  }

  return `<div class="affiliate-section">
<h3>おすすめクリニック・サービス</h3>
<p>※以下のリンクはアフィリエイト広告を含みます</p>
<ul>
${listItems.join('\n')}
</ul>
</div>`
}
