/**
 * Google AdSense 型定義
 * 自動広告設定・パフォーマンス計測
 */

// ============================================================
// AdSense 広告スロット
// ============================================================

/** 広告スロット種別 */
export type AdSlotType =
  | 'display'           // ディスプレイ広告
  | 'in-feed'           // インフィード広告
  | 'in-article'        // 記事内広告
  | 'matched-content'   // 関連コンテンツ
  | 'anchor'            // アンカー広告（モバイル下部固定）
  | 'vignette'          // 全画面インタースティシャル

/** 広告スロット設定 */
export interface AdSlot {
  /** スロットID */
  slotId: string
  /** スロット種別 */
  type: AdSlotType
  /** 表示位置の識別子 */
  placement: string
  /** スロットの有効/無効 */
  isActive: boolean
  /** レスポンシブサイズ */
  responsive: boolean
  /** カスタムサイズ（responsive=false時） */
  width?: number
  height?: number
}

// ============================================================
// AdSense 設定
// ============================================================

/** AdSense アカウント設定 */
export interface AdSenseConfig {
  /** パブリッシャーID (ca-pub-xxxxxxxxxx) */
  publisherId: string
  /** 広告スロット一覧 */
  slots: AdSlot[]
  /** 自動広告設定 */
  autoAds: {
    /** 自動広告の有効/無効 */
    enabled: boolean
    /** ページレベル広告の有効/無効 */
    pageLevelAds: boolean
    /** アンカー広告（モバイル下部固定） */
    anchorAds: boolean
    /** ビネット広告（全画面インタースティシャル） */
    vignetteAds: boolean
    /** 広告最適化 */
    adOptimization: boolean
  }
  /** 除外ページパス（広告を表示しないページ） */
  excludePaths: string[]
  /** ads.txt のコンテンツ */
  adsTxtContent?: string
}

// ============================================================
// AdSense パフォーマンス
// ============================================================

/** AdSense パフォーマンスデータ */
export interface AdSensePerformance {
  /** ページRPM（1000PVあたりの収益） */
  pageRpm: number
  /** インプレッション数 */
  impressions: number
  /** クリック数 */
  clicks: number
  /** 収益（円） */
  revenue: number
  /** クリック率（CTR） */
  ctr: number
  /** CPC（クリック単価） */
  cpc: number
  /** 計測期間開始日（ISO 8601） */
  startDate: string
  /** 計測期間終了日（ISO 8601） */
  endDate: string
}

/** ページ別AdSenseパフォーマンス */
export interface PageAdSensePerformance {
  /** ページパス */
  pagePath: string
  /** 記事スラッグ */
  articleSlug?: string
  /** パフォーマンスデータ */
  performance: AdSensePerformance
}

/** AdSense 日次サマリ */
export interface AdSenseDailySummary {
  /** 日付（ISO 8601） */
  date: string
  /** パフォーマンスデータ */
  performance: AdSensePerformance
  /** 前日比（%） */
  revenueChangeRate?: number
}
