/**
 * ASPプログラム ヘルパー関数
 * Supabase row → AspProgramSeed の変換を共通化
 */

import type { AspProgramSeed } from '@/lib/asp/seed'
import type { AspProgramRow } from '@/types/database'

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
  }
}
