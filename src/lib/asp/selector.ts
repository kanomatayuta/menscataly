/**
 * ASPプログラム選定ロジック
 * EPC・承認率・ITP対応をスコアリングし、最適なプログラムを選定する
 */

import type { AspProgram, AspName, ItpMitigationConfig } from '@/types/asp-config'
import type { AffiliateLink, ContentCategory } from '@/types/content'
import { getProgramsByCategoryFromDB } from './repository'

// ============================================================
// 選定オプション
// ============================================================

export interface SelectionOptions {
  /** ITP対応必須にするか */
  requireItpSupport?: boolean
  /** 最大選定数 */
  maxResults?: number
}

// ============================================================
// スコアリング関数
// ============================================================

/**
 * ASPプログラムのスコアを算出する
 * score = epc * 0.4 + approvalRate * 0.3 + (itpSupport ? 20 : 0) * 0.3
 */
function calculateScore(program: AspProgram): number {
  return (
    program.epc * 0.4 +
    program.approvalRate * 0.3 +
    (program.itpSupport ? 20 : 0) * 0.3
  )
}

// ============================================================
// 選定関数
// ============================================================

/**
 * カテゴリに最適なASPプログラムを選定する (上位3件)
 * Supabase からプログラムを取得し、失敗時は config.ts にフォールバック
 */
export async function selectBestPrograms(
  category: ContentCategory,
  options: SelectionOptions = {}
): Promise<AspProgram[]> {
  const { requireItpSupport = false, maxResults = 3 } = options

  let programs = await getProgramsByCategoryFromDB(category)

  if (requireItpSupport) {
    programs = programs.filter((p) => p.itpSupport)
  }

  return programs
    .map((program) => ({ program, score: calculateScore(program) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(({ program }) => program)
}

/**
 * AspProgram[] を AffiliateLink[] に変換する
 * adCreatives (useForInjection) があればクリエイティブURLを優先
 */
export function toAffiliateLinks(programs: AspProgram[]): AffiliateLink[] {
  return programs.map((program) => {
    // adCreatives から有効なテキストクリエイティブを探す
    const textCreative = program.adCreatives?.find(
      (c) => c.type === 'text' && c.isActive && c.useForInjection
    )
    return {
      programName: program.programName,
      aspName: program.aspName,
      url: textCreative?.affiliateUrl ?? '',
      rewardAmount: program.rewardTiers[0]?.amount ?? 0,
      anchorText: (textCreative?.anchorText || undefined) ?? program.recommendedAnchors[0] ?? program.programName,
    }
  })
}

/**
 * 指定ASP群のITPミティゲーション設定を取得する
 */
export function getITPMitigationScripts(
  aspNames: AspName[]
): ItpMitigationConfig[] {
  // ITPスクリプトの遅延ロードを避けるためインラインで定義
  const ITP_CONFIGS: Record<AspName, ItpMitigationConfig> = {
    afb: {
      aspName: 'afb',
      scriptUrl: 'https://t.afi-b.com/ta.js',
      scriptAttributes: { 'data-afb-id': 'afb-tracking' },
      lazyLoad: true,
      sameSiteCookie: 'Lax',
    },
    a8: {
      aspName: 'a8',
      scriptUrl: 'https://statics.a8.net/a8sales/a8sales.js',
      scriptAttributes: { 'data-a8-id': 'a8-tracking' },
      lazyLoad: true,
      sameSiteCookie: 'None',
    },
    accesstrade: {
      aspName: 'accesstrade',
      scriptUrl: 'https://h.accesstrade.net/js/nct/nct.js',
      scriptAttributes: { 'data-at-id': 'accesstrade-tracking' },
      lazyLoad: false,
      sameSiteCookie: 'Lax',
    },
    valuecommerce: {
      aspName: 'valuecommerce',
      scriptUrl: 'https://amd.c.yimg.jp/amd/vcsc/vc_bridge.js',
      scriptAttributes: { 'data-vc-id': 'valuecommerce-tracking' },
      lazyLoad: true,
      sameSiteCookie: 'Lax',
    },
    felmat: {
      aspName: 'felmat',
      scriptUrl: 'https://www.felmat.net/fmimg/fm.js',
      scriptAttributes: { 'data-fm-id': 'felmat-tracking' },
      lazyLoad: false,
      sameSiteCookie: 'None',
    },
    moshimo: {
      aspName: 'moshimo',
      scriptUrl: 'https://af.moshimo.com/af/r/result.js',
      scriptAttributes: { 'data-moshimo-id': 'moshimo-tracking' },
      lazyLoad: true,
      sameSiteCookie: 'Lax',
    },
  }

  const uniqueNames = [...new Set(aspNames)]
  return uniqueNames
    .filter((name) => name in ITP_CONFIGS)
    .map((name) => ITP_CONFIGS[name])
}
