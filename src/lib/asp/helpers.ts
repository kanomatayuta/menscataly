/**
 * ASPプログラム ヘルパー関数
 * Supabase row → AspProgramSeed の変換を共通化
 */

import type { AspProgramSeed } from '@/lib/asp/seed'
import type { AdCreative } from '@/types/asp-config'
import type { AspProgramRow, Json } from '@/types/database'

/**
 * Supabase の行データを AspProgramSeed 型にマッピングする
 * snake_case (DB) / camelCase (インメモリ) の両方に対応
 */
export function mapRowToProgram(row: AspProgramRow): AspProgramSeed {
  return {
    id: row.id,
    aspName: row.asp_name as AspProgramSeed['aspName'],
    programName: row.program_name,
    programId: row.program_id,
    category: row.category as AspProgramSeed['category'],
    affiliateUrl: row.affiliate_url,
    rewardAmount: parseFloat(String(row.reward_amount ?? '0')),
    rewardType: row.reward_type as 'fixed' | 'percentage',
    conversionCondition: row.conversion_condition ?? '',
    approvalRate: parseFloat(String(row.approval_rate ?? '0')),
    epc: parseFloat(String(row.epc ?? '0')),
    itpSupport: Boolean(row.itp_support),
    cookieDuration: parseInt(String(row.cookie_duration ?? '30'), 10),
    isActive: Boolean(row.is_active),
    priority: parseInt(String(row.priority ?? '3'), 10),
    recommendedAnchors: row.recommended_anchors ?? [],
    landingPageUrl: row.landing_page_url ?? '',
    notes: row.notes ?? undefined,
    adCreatives: parseAdCreatives(row.ad_creatives),
  }
}

/**
 * JSONB の ad_creatives を AdCreative[] にパースする
 */
function parseAdCreatives(raw: Json | null | undefined): AdCreative[] | undefined {
  if (!raw) return undefined
  if (!Array.isArray(raw)) {
    console.warn('[parseAdCreatives] Expected array, got:', typeof raw)
    return undefined
  }
  if (raw.length === 0) return undefined
  // 各アイテムの最低限の型チェック
  const valid = raw.filter((item) => {
    if (typeof item !== 'object' || item === null) {
      console.warn('[parseAdCreatives] Invalid creative item:', item)
      return false
    }
    const c = item as Record<string, unknown>
    return typeof c.id === 'string' && typeof c.type === 'string' && typeof c.affiliateUrl === 'string'
  })
  if (valid.length === 0) return undefined
  return valid as unknown as AdCreative[]
}
