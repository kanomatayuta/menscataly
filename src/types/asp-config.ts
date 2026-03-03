/**
 * ASP設定 型定義
 * アフィリエイトプログラム管理、カテゴリマッピング、最適ASP選定
 */

import type { ContentCategory } from './content'

// ============================================================
// ASPプログラム
// ============================================================

export type AspName = 'afb' | 'a8' | 'accesstrade' | 'valuecommerce' | 'felmat'

export interface AspProgram {
  id: string
  aspName: AspName
  programName: string
  programId: string
  category: ContentCategory
  /** アフィリエイトURL (トラッキングパラメータ含む) */
  affiliateUrl: string
  /** 報酬金額 (円) */
  rewardAmount: number
  /** 報酬種別 */
  rewardType: 'fixed' | 'percentage'
  /** 承認率 (0-100) */
  approvalRate: number
  /** EPC (Earnings Per Click) */
  epc: number
  /** ITP対応状況 */
  itpSupport: boolean
  /** Cookie有効期間 (日) */
  cookieDuration: number
  /** プログラム状態 */
  isActive: boolean
  /** 推奨アンカーテキスト候補 */
  recommendedAnchors: string[]
  /** LP URL */
  landingPageUrl: string
}

// ============================================================
// カテゴリマッピング
// ============================================================

export interface AspCategoryMapping {
  category: ContentCategory
  programs: AspProgram[]
  /** カテゴリ内のデフォルト推奨ASP */
  defaultAspName: AspName
}

// ============================================================
// ASP選定結果
// ============================================================

export interface AspSelectionResult {
  /** 選定されたプログラム (スコア降順) */
  selectedPrograms: Array<{
    program: AspProgram
    score: number
    reason: string
  }>
  /** カテゴリ */
  category: ContentCategory
  /** 選定基準 */
  selectionCriteria: {
    prioritizeEpc: boolean
    prioritizeApprovalRate: boolean
    requireItpSupport: boolean
  }
}

// ============================================================
// ITPミティゲーション
// ============================================================

export interface ItpMitigationConfig {
  aspName: AspName
  /** トラッキングスクリプトURL */
  scriptUrl: string
  /** スクリプト属性 */
  scriptAttributes: Record<string, string>
  /** 遅延読み込み */
  lazyLoad: boolean
  /** SameSite Cookie設定 */
  sameSiteCookie: 'Strict' | 'Lax' | 'None'
}
