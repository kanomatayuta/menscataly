/**
 * ASPプログラム ヘルパー関数
 * Supabase row → AspProgramSeed の変換を共通化
 */

import type { AspProgramSeed } from '@/lib/asp/seed'
import type { AdCreative, RewardTier } from '@/types/asp-config'
import type { AspProgramRow, Json } from '@/types/database'
import { enrichCreativeWithParsedSize } from './banner-parser'

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
    rewardTiers: parseRewardTiers(row.reward_tiers),
    approvalRate: parseFloat(String(row.approval_rate ?? '0')),
    epc: parseFloat(String(row.epc ?? '0')),
    itpSupport: Boolean(row.itp_support),
    cookieDuration: parseInt(String(row.cookie_duration ?? '30'), 10),
    isActive: Boolean(row.is_active),
    priority: parseInt(String(row.priority ?? '3'), 10),
    recommendedAnchors: row.recommended_anchors ?? [],
    notes: row.notes ?? undefined,
    adCreatives: parseAdCreatives(row.ad_creatives),
    advertiserName: row.advertiser_name ?? '',
    aspCategory: row.asp_category ?? '',
    confirmationPeriodDays: row.confirmation_period_days ?? 30,
    partnershipStatus: row.partnership_status ?? 'active',
    lastApprovalDate: row.last_approval_date ?? null,
  }
}

/**
 * JSONB の reward_tiers を RewardTier[] にパースする
 */
export function parseRewardTiers(raw: Json | null | undefined): RewardTier[] {
  if (!raw) return []
  if (!Array.isArray(raw)) {
    console.warn('[parseRewardTiers] Expected array, got:', typeof raw)
    return []
  }
  return raw.filter((item) => {
    if (typeof item !== 'object' || item === null) return false
    const t = item as Record<string, unknown>
    return (
      typeof t.condition === 'string' &&
      typeof t.amount === 'number' &&
      (t.type === 'fixed' || t.type === 'percentage')
    )
  }) as unknown as RewardTier[]
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
  // 各アイテムの最低限の型チェック + width/height/imageUrl の正規化
  const valid = raw.filter((item) => {
    if (typeof item !== 'object' || item === null) {
      console.warn('[parseAdCreatives] Invalid creative item:', item)
      return false
    }
    const c = item as Record<string, unknown>
    return typeof c.id === 'string' && typeof c.type === 'string' && (typeof c.rawHtml === 'string' || typeof c.affiliateUrl === 'string' || typeof c.imageUrl === 'string')
  }).map((item) => {
    const c = item as Record<string, unknown>
    return {
      ...c,
      width: typeof c.width === 'number' ? c.width : undefined,
      height: typeof c.height === 'number' ? c.height : undefined,
      imageUrl: typeof c.imageUrl === 'string' ? c.imageUrl : undefined,
    }
  })
  if (valid.length === 0) return undefined
  // rawHtml から width/height を自動補完
  return (valid as unknown as AdCreative[]).map(enrichCreativeWithParsedSize)
}
