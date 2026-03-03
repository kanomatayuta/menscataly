/**
 * ITPミティゲーションスクリプト設定 (B7)
 * ASP別のITP対応トラッキングスクリプト管理
 */

import type { AspName, ItpMitigationConfig } from '@/types/asp-config'

// ============================================================
// ITPトラッキングスクリプト設定
// ============================================================

export const ITP_TRACKING_SCRIPTS: Record<AspName, ItpMitigationConfig> = {
  afb: {
    aspName: 'afb',
    scriptUrl: 'https://t.afi-b.com/ta.js',
    scriptAttributes: {
      'data-afb-id': 'afb-tracking',
      'data-afb-mode': 'itp',
      async: 'true',
    },
    lazyLoad: true,
    sameSiteCookie: 'Lax',
  },
  a8: {
    aspName: 'a8',
    scriptUrl: 'https://statics.a8.net/a8sales/a8sales.js',
    scriptAttributes: {
      'data-a8-id': 'a8-tracking',
      'data-a8-itp': 'true',
      async: 'true',
    },
    lazyLoad: true,
    sameSiteCookie: 'None',
  },
  accesstrade: {
    aspName: 'accesstrade',
    scriptUrl: 'https://h.accesstrade.net/js/nct/nct.js',
    scriptAttributes: {
      'data-at-id': 'accesstrade-tracking',
      'data-at-server': 'true',
    },
    lazyLoad: false,
    sameSiteCookie: 'Lax',
  },
  valuecommerce: {
    aspName: 'valuecommerce',
    scriptUrl: 'https://amd.c.yimg.jp/amd/vcsc/vc_bridge.js',
    scriptAttributes: {
      'data-vc-id': 'valuecommerce-tracking',
      'data-vc-mode': 'bridge',
    },
    lazyLoad: true,
    sameSiteCookie: 'Lax',
  },
  felmat: {
    aspName: 'felmat',
    scriptUrl: 'https://www.felmat.net/fmimg/fm.js',
    scriptAttributes: {
      'data-fm-id': 'felmat-tracking',
      'data-fm-itp': 'server',
    },
    lazyLoad: false,
    sameSiteCookie: 'None',
  },
  moshimo: {
    aspName: 'moshimo',
    scriptUrl: 'https://af.moshimo.com/af/r/result.js',
    scriptAttributes: {
      'data-moshimo-id': 'moshimo-tracking',
      'data-moshimo-itp': 'true',
      async: 'true',
    },
    lazyLoad: true,
    sameSiteCookie: 'Lax',
  },
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 指定ASPのトラッキングスクリプト設定を取得する
 */
export function getTrackingScripts(aspNames: AspName[]): ItpMitigationConfig[] {
  const uniqueNames = [...new Set(aspNames)]
  return uniqueNames
    .filter((name) => name in ITP_TRACKING_SCRIPTS)
    .map((name) => ITP_TRACKING_SCRIPTS[name])
}

/**
 * 全ASPのトラッキングスクリプト設定を取得する
 */
export function getAllTrackingScripts(): ItpMitigationConfig[] {
  return Object.values(ITP_TRACKING_SCRIPTS)
}
