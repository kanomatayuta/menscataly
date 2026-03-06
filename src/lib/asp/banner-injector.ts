/**
 * バナー広告自動最適配置モジュール
 *
 * 4エージェント（収益最適化・UX/コンプライアンス・技術実装・SEO/アナリティクス）
 * の研究結果を統合した最適配置ロジック。
 *
 * 配置ルール:
 * - 最大3つのインラインバナー
 * - バナー間は最低3段落の間隔
 * - 禁止ゾーン: 免責事項、監修者セクション、医療警告、記事冒頭(1番目のh2前)
 * - CLS防止: min-height + コンテナ固定サイズ
 * - コンプライアンス: 各バナーにPR表記 + aria-label
 */

import type { ContentCategory } from '@/types/content'
import type { AdCreative } from '@/types/asp-config'
import { generateBannerHtml } from './link-injector'
import { selectBestPrograms } from './selector'
import {
  isBannerSuitableFor as isBannerSuitableForPure,
  enrichCreativeWithParsedSize,
} from './banner-parser'

/** バナーの配置コンテキスト */
export type BannerContext = 'inline' | 'sidebar'

/**
 * AdCreativeオブジェクトが配置コンテキストに適しているか判定する
 *
 * 重要: width/heightが未設定の場合はfalseを返す（デフォルト値で誤判定しない）
 * enrichCreativeWithParsedSize() でサイズ補完してからフィルタすること
 */
export function isBannerSuitableForCreative(creative: AdCreative, context: BannerContext): boolean {
  if (creative.width == null || creative.height == null) {
    return false
  }
  return isBannerSuitableForPure(creative.width, creative.height, context)
}

/** @deprecated isBannerSuitableForCreative を使用してください */
export const isBannerSuitableFor = isBannerSuitableForCreative

// ============================================================
// サイズ別配置ルール (参照データ)
// ============================================================

/** バナー配置位置 */
export type BannerPosition =
  | 'between-h2'
  | 'after-table'
  | 'before-summary'
  | 'in-long-section'
  | 'between-sections'
  | 'mobile-only'

/** バナーサイズ→最適配置マッピング */
export interface BannerPlacementRule {
  width: number
  height: number
  name: string
  preferredPositions: BannerPosition[]
  visibilityScore: number
  cvScore: number
  tabletMaxWidth: number
  mobileOnly: boolean
}

/** IAB標準サイズ別の最適配置ルール */
export const BANNER_PLACEMENT_RULES: BannerPlacementRule[] = [
  { width: 728, height: 90, name: 'leaderboard', preferredPositions: ['between-h2'], visibilityScore: 95, cvScore: 65, tabletMaxWidth: 468, mobileOnly: false },
  { width: 300, height: 250, name: 'medium-rectangle', preferredPositions: ['after-table', 'before-summary'], visibilityScore: 80, cvScore: 95, tabletMaxWidth: 300, mobileOnly: false },
  { width: 336, height: 280, name: 'large-rectangle', preferredPositions: ['in-long-section', 'before-summary'], visibilityScore: 75, cvScore: 85, tabletMaxWidth: 336, mobileOnly: false },
  { width: 468, height: 60, name: 'banner', preferredPositions: ['between-sections', 'between-h2'], visibilityScore: 60, cvScore: 50, tabletMaxWidth: 468, mobileOnly: false },
  { width: 320, height: 100, name: 'large-mobile-banner', preferredPositions: ['mobile-only', 'between-sections'], visibilityScore: 70, cvScore: 60, tabletMaxWidth: 320, mobileOnly: true },
]

/**
 * バナーサイズに最も近い配置ルールを取得する
 */
export function getPlacementRule(width: number, height: number): BannerPlacementRule | null {
  const exact = BANNER_PLACEMENT_RULES.find(r => r.width === width && r.height === height)
  if (exact) return exact

  const ratio = width / height
  if (ratio > 5) return BANNER_PLACEMENT_RULES.find(r => r.name === 'leaderboard') ?? null
  if (ratio > 2) return BANNER_PLACEMENT_RULES.find(r => r.name === 'banner') ?? null
  if (ratio >= 0.8 && ratio <= 1.4) {
    return width >= 320
      ? BANNER_PLACEMENT_RULES.find(r => r.name === 'large-rectangle') ?? null
      : BANNER_PLACEMENT_RULES.find(r => r.name === 'medium-rectangle') ?? null
  }
  if (width <= 320) return BANNER_PLACEMENT_RULES.find(r => r.name === 'large-mobile-banner') ?? null
  return BANNER_PLACEMENT_RULES.find(r => r.name === 'banner') ?? null
}

// ============================================================
// 型定義
// ============================================================

/** バナー挿入候補位置 */
interface BannerSlot {
  /** コンテンツ内のインデックス位置 */
  index: number
  /** 挿入位置の種別 */
  type: 'after-h2' | 'before-matome' | 'after-table' | 'mid-article'
  /** スコア (高いほど優先) */
  score: number
  /** 対応する BannerPosition (BANNER_PLACEMENT_RULES の preferredPositions に対応) */
  bannerPosition?: BannerPosition
}

/** 収集済みバナー (HTML + サイズ情報) */
interface CollectedBanner {
  html: string
  width: number | null
  height: number | null
  /** このバナーの推奨配置ルール */
  rule: BannerPlacementRule | null
}

/** バナー配置設定 */
export interface BannerPlacementConfig {
  /** 最大インラインバナー数 */
  maxBanners: number
  /** バナー間の最小段落数 */
  minParagraphSpacing: number
  /** 短い記事の閾値 (h2数がこれ未満ならバナー挿入しない) */
  minH2Count: number
}

const DEFAULT_CONFIG: BannerPlacementConfig = {
  maxBanners: 3,
  minParagraphSpacing: 3,
  minH2Count: 3,
}

// ============================================================
// まとめ/結論セクション検出パターン
// ============================================================

const MATOME_PATTERNS = [
  /まとめ/,
  /結論/,
  /おわりに/,
  /最後に/,
  /総括/,
]

// ============================================================
// メイン関数
// ============================================================

/**
 * 記事コンテンツにバナー広告を最適な位置に自動挿入する
 *
 * 挿入位置の優先順位:
 * 1. まとめ/結論セクションの直前 (スコア: 100)
 * 2. 比較テーブル直後 (スコア: 90)
 * 3. 2番目のh2の閉じタグ後 + 2段落後 (スコア: 80)
 * 4. 記事中盤のh2セクション境界 (スコア: 70)
 *
 * @param content HTML記事コンテンツ
 * @param category 記事カテゴリ
 * @param config 配置設定 (オプション)
 * @returns バナー挿入済みコンテンツ
 */
export async function insertBannerAds(
  content: string,
  category: ContentCategory,
  config: Partial<BannerPlacementConfig> = {}
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // バナークリエイティブを収集 (サイズ情報付き)
  const banners = await collectBannerCreativesWithSize(category, cfg.maxBanners)
  if (banners.length === 0) return content

  // h2の位置を取得
  const h2Positions = findH2Positions(content)
  if (h2Positions.length < cfg.minH2Count) return content

  // 候補スロットを算出
  const slots = calculateBannerSlots(content, h2Positions)
  if (slots.length === 0) return content

  // スコア順にソートし、間隔制約を満たすスロットを選択
  const selectedSlots = selectSlots(slots, content, cfg)

  // バナーとスロットのマッチング (サイズ別最適配置)
  const assignments = assignBannersToSlots(banners, selectedSlots)
  if (assignments.length === 0) return content

  // 後ろから挿入 (インデックスのずれ防止)
  let result = content
  const sortedByIndex = [...assignments].sort((a, b) => b.slot.index - a.slot.index)

  for (let i = 0; i < sortedByIndex.length; i++) {
    const { slot, banner } = sortedByIndex[i]
    const bannerBlock = wrapBannerHtml(
      banner.html,
      i === sortedByIndex.length - 1,
      banner.width,
      banner.height
    )
    result = result.slice(0, slot.index) + bannerBlock + result.slice(slot.index)
  }

  return result
}

// ============================================================
// バナークリエイティブ収集
// ============================================================

/**
 * サイズ情報付きバナークリエイティブを収集する
 * BANNER_PLACEMENT_RULES に基づくサイズ別最適配置のために使用
 */
async function collectBannerCreativesWithSize(
  category: ContentCategory,
  maxPrograms: number
): Promise<CollectedBanner[]> {
  const programs = await selectBestPrograms(category, { maxResults: maxPrograms + 2 })
  const banners: CollectedBanner[] = []

  for (const program of programs) {
    if (banners.length >= maxPrograms) break
    if (!program.adCreatives) continue

    // rawHtmlからサイズを自動補完してからフィルタ (サイズ未設定のバナーを正しく判定)
    const enrichedCreatives = program.adCreatives.map(enrichCreativeWithParsedSize)
    const bannerCreatives = enrichedCreatives.filter(
      (c) => c.type === 'banner' && c.isActive && c.useForBanner && isBannerSuitableFor(c, 'inline')
    )
    for (const creative of bannerCreatives) {
      if (banners.length >= maxPrograms) break
      const html = generateBannerHtml(creative, program.aspName, program.programId, program.category)
      if (html) {
        const rule = (creative.width && creative.height)
          ? getPlacementRule(creative.width, creative.height)
          : null
        banners.push({
          html,
          width: creative.width ?? null,
          height: creative.height ?? null,
          rule,
        })
      }
    }
  }

  return banners
}

/**
 * サイドバー用バナークリエイティブを収集する
 * 縦長・中型バナーを優先的に選択
 */
export async function collectSidebarBannerCreatives(
  category: ContentCategory,
  maxBanners: number = 2
): Promise<string[]> {
  const programs = await selectBestPrograms(category, { maxResults: maxBanners + 2 })
  const bannerHtmls: string[] = []

  for (const program of programs) {
    if (bannerHtmls.length >= maxBanners) break
    if (!program.adCreatives) continue

    // rawHtmlからサイズを自動補完してからフィルタ
    const enrichedCreatives = program.adCreatives.map(enrichCreativeWithParsedSize)
    const sidebarCreatives = enrichedCreatives.filter(
      (c) => c.type === 'banner' && c.isActive && c.useForBanner && isBannerSuitableFor(c, 'sidebar')
    )
    for (const creative of sidebarCreatives) {
      if (bannerHtmls.length >= maxBanners) break
      const html = generateBannerHtml(creative, program.aspName, program.programId, program.category)
      if (html) bannerHtmls.push(html)
    }
  }

  return bannerHtmls
}

// ============================================================
// バナー↔スロット マッチング
// ============================================================

/** バナーとスロットの割り当て */
interface BannerAssignment {
  banner: CollectedBanner
  slot: BannerSlot
}

/**
 * スロットタイプ → BannerPosition のマッピング
 */
function slotTypeToBannerPosition(type: BannerSlot['type']): BannerPosition {
  switch (type) {
    case 'before-matome': return 'before-summary'
    case 'after-table': return 'after-table'
    case 'after-h2': return 'between-h2'
    case 'mid-article': return 'in-long-section'
  }
}

/**
 * バナーをサイズ別最適位置に割り当てる
 *
 * アルゴリズム:
 * 1. サイズ情報ありのバナー → preferredPositions にマッチするスロットを優先
 * 2. マッチしない/サイズ不明のバナー → スコア順にフォールバック
 */
function assignBannersToSlots(
  banners: CollectedBanner[],
  slots: BannerSlot[]
): BannerAssignment[] {
  if (banners.length === 0 || slots.length === 0) return []

  const assignments: BannerAssignment[] = []
  const usedSlotIndices = new Set<number>()
  const usedBannerIndices = new Set<number>()

  // Pass 1: サイズ情報ありバナーを preferredPositions でマッチ
  for (let bi = 0; bi < banners.length; bi++) {
    const banner = banners[bi]
    if (!banner.rule) continue

    // preferredPositions の優先順でスロットを探す
    for (const preferredPos of banner.rule.preferredPositions) {
      let bestSlotIdx = -1
      let bestScore = -1

      for (let si = 0; si < slots.length; si++) {
        if (usedSlotIndices.has(si)) continue
        const slotPos = slotTypeToBannerPosition(slots[si].type)
        if (slotPos === preferredPos && slots[si].score > bestScore) {
          bestSlotIdx = si
          bestScore = slots[si].score
        }
      }

      if (bestSlotIdx !== -1) {
        assignments.push({ banner, slot: slots[bestSlotIdx] })
        usedSlotIndices.add(bestSlotIdx)
        usedBannerIndices.add(bi)
        break
      }
    }
  }

  // Pass 2: 未割り当てバナーをスコア順にフォールバック
  for (let bi = 0; bi < banners.length; bi++) {
    if (usedBannerIndices.has(bi)) continue

    // 空きスロットをスコア降順で探す
    let bestSlotIdx = -1
    let bestScore = -1
    for (let si = 0; si < slots.length; si++) {
      if (usedSlotIndices.has(si)) continue
      if (slots[si].score > bestScore) {
        bestSlotIdx = si
        bestScore = slots[si].score
      }
    }

    if (bestSlotIdx !== -1) {
      assignments.push({ banner: banners[bi], slot: slots[bestSlotIdx] })
      usedSlotIndices.add(bestSlotIdx)
      usedBannerIndices.add(bi)
    }
  }

  return assignments
}

// ============================================================
// h2位置検出
// ============================================================

interface H2Position {
  /** h2タグの開始位置 */
  start: number
  /** h2タグの閉じタグ(</h2>)の終了位置 */
  end: number
  /** h2の見出しテキスト */
  text: string
  /** まとめ/結論セクションかどうか */
  isMatome: boolean
}

/**
 * コンテンツ内のすべてのh2タグの位置とテキストを検出する
 */
export function findH2Positions(content: string): H2Position[] {
  const positions: H2Position[] = []
  const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi
  let match: RegExpExecArray | null

  while ((match = h2Regex.exec(content)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim()
    const isMatome = MATOME_PATTERNS.some(p => p.test(text))
    positions.push({
      start: match.index,
      end: match.index + match[0].length,
      text,
      isMatome,
    })
  }

  return positions
}

// ============================================================
// 候補スロット算出
// ============================================================

/**
 * バナー挿入の候補位置をスコア付きで算出する
 */
function calculateBannerSlots(content: string, h2Positions: H2Position[]): BannerSlot[] {
  const slots: BannerSlot[] = []

  // --- 1. まとめ/結論h2の直前 (スコア: 100) ---
  for (const h2 of h2Positions) {
    if (h2.isMatome) {
      slots.push({ index: h2.start, type: 'before-matome', score: 100 })
    }
  }

  // --- 2. 比較テーブル直後 (スコア: 90) ---
  const tableEndRegex = /<\/table>/gi
  let tableMatch: RegExpExecArray | null
  while ((tableMatch = tableEndRegex.exec(content)) !== null) {
    const afterTable = tableMatch.index + tableMatch[0].length
    // テーブルの後の次の段落終了位置を探す
    const nextPEnd = content.indexOf('</p>', afterTable)
    if (nextPEnd !== -1) {
      slots.push({ index: nextPEnd + 4, type: 'after-table', score: 90 })
    } else {
      slots.push({ index: afterTable, type: 'after-table', score: 90 })
    }
  }

  // --- 3. 2番目のh2セクション内 (スコア: 80) ---
  // 2番目のh2の終了位置から2段落後に挿入
  if (h2Positions.length >= 2) {
    const secondH2End = h2Positions[1].end
    const insertAfter = findNthParagraphEnd(content, secondH2End, 2)
    if (insertAfter !== -1) {
      slots.push({ index: insertAfter, type: 'after-h2', score: 80 })
    }
  }

  // --- 4. 記事中盤のh2境界 (スコア: 70) ---
  if (h2Positions.length >= 5) {
    const midIdx = Math.floor(h2Positions.length * 2 / 3)
    const midH2 = h2Positions[midIdx]
    if (!midH2.isMatome) {
      slots.push({ index: midH2.start, type: 'mid-article', score: 70 })
    }
  }

  // --- 5. 3番目のh2の前 (フォールバック、スコア: 60) ---
  if (h2Positions.length >= 3 && slots.length < 2) {
    const thirdH2 = h2Positions[2]
    if (!thirdH2.isMatome) {
      slots.push({ index: thirdH2.start, type: 'after-h2', score: 60 })
    }
  }

  return slots
}

// ============================================================
// スロット選択 (間隔制約適用)
// ============================================================

/**
 * スコア順にソートし、段落間隔の制約を満たすスロットのみ選択する
 */
function selectSlots(
  slots: BannerSlot[],
  content: string,
  config: BannerPlacementConfig
): BannerSlot[] {
  // スコア降順ソート
  const sorted = [...slots].sort((a, b) => b.score - a.score)

  const selected: BannerSlot[] = []

  for (const slot of sorted) {
    if (selected.length >= config.maxBanners) break

    // 既に選択済みのスロットとの間隔をチェック
    const tooClose = selected.some(s => {
      const _distance = Math.abs(slot.index - s.index)
      const paragraphsBetween = countParagraphsBetween(
        content,
        Math.min(slot.index, s.index),
        Math.max(slot.index, s.index)
      )
      return paragraphsBetween < config.minParagraphSpacing
    })

    if (!tooClose) {
      selected.push(slot)
    }
  }

  return selected
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 指定位置からn番目の</p>タグの終了位置を見つける
 * @returns </p>の終了位置のインデックス、見つからない場合は-1
 */
function findNthParagraphEnd(content: string, startIndex: number, n: number): number {
  let count = 0
  const pEndRegex = /<\/p>/gi
  pEndRegex.lastIndex = startIndex

  let match: RegExpExecArray | null
  while ((match = pEndRegex.exec(content)) !== null) {
    count++
    if (count >= n) {
      return match.index + match[0].length
    }
  }

  return -1
}

/**
 * 2つの位置間の段落数を数える
 */
function countParagraphsBetween(content: string, start: number, end: number): number {
  const slice = content.slice(start, end)
  const matches = slice.match(/<\/p>/gi)
  return matches ? matches.length : 0
}

/**
 * バナーHTMLをラッパーで包む
 * - CLS防止用のmin-height + aspect-ratio (バナーサイズ連動)
 * - コンプライアンス用PR表記
 * - アクセシビリティ用aria-label + role
 * - レイジーロード用data属性
 * - レスポンシブ: PC/タブレット/SPで表示切替
 * - data-ad="true" で検索エンジンの広告識別を支援
 * - data-nosnippet で広告がスニペットに混入することを防止
 * - rel="sponsored" リンクの保持を前提 (generateBannerHtml で付与済み)
 */
function wrapBannerHtml(
  bannerHtml: string,
  isFirstBanner: boolean,
  width?: number | null,
  height?: number | null
): string {
  const lazyAttr = isFirstBanner ? '' : ' data-lazy="true"'

  // サイズ情報がある場合:
  // 1. CSSサイズバリアントクラスを付与 (既存CSSルールが適用される)
  // 2. data属性でサイズ情報を埋め込み
  // 3. インラインスタイルで正確なmax-width/aspect-ratioを設定
  let sizeClass = ''
  let sizeAttrs = ''
  let outerStyle = ''
  let innerStyle = ''
  if (width && height && width > 0 && height > 0) {
    sizeClass = ` affiliate-inline-banner--${width}x${height}`
    sizeAttrs = ` data-banner-width="${width}" data-banner-height="${height}"`
    outerStyle = ` style="max-width:${width}px;"`
    innerStyle = ` style="max-width:${width}px;min-height:${height}px;aspect-ratio:${width}/${height};"`
  }

  return `<aside class="affiliate-inline-banner${sizeClass}" role="complementary" aria-label="広告" data-ad="true" data-nosnippet=""${lazyAttr}${sizeAttrs}${outerStyle}>
<p class="banner-disclosure" aria-hidden="true">PR</p>
<div class="banner-content banner-content--responsive"${innerStyle}>
${bannerHtml}
</div>
</aside>\n`
}
