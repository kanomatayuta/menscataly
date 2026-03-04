/**
 * ASPプログラム データアクセス層
 * Supabase からプログラムを取得し、失敗時は config.ts の静的データにフォールバックする
 *
 * - サーバーサイド専用 (service role client)
 * - インメモリキャッシュ (5分TTL)
 */

import type { AspProgram } from '@/types/asp-config'
import type { ContentCategory } from '@/types/content'
import { getProgramsByCategory } from './config'
import { mapRowToProgram } from './helpers'

// ============================================================
// キャッシュ設定
// ============================================================

const CACHE_TTL_MS = 5 * 60 * 1000 // 5分

interface CacheEntry {
  data: AspProgram[]
  expiresAt: number
}

/** カテゴリ別インメモリキャッシュ */
const cache = new Map<string, CacheEntry>()

/**
 * キャッシュをクリアする (テスト用)
 */
export function clearProgramCache(): void {
  cache.clear()
}

// ============================================================
// Supabase クライアント (遅延初期化)
// ============================================================

/**
 * サーバーサイド Supabase クライアントを安全に作成する
 * 環境変数が未設定の場合は null を返す
 */
function tryCreateSupabaseClient() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return null
    }
    // 動的インポートを避け、環境変数チェック後にインポート
    // createServerSupabaseClient は環境変数未設定時に throw するため、
    // ここで事前チェックしてから呼び出す
    const { createServerSupabaseClient } = require('@/lib/supabase/client') as typeof import('@/lib/supabase/client')
    return createServerSupabaseClient()
  } catch {
    return null
  }
}

// ============================================================
// データ取得
// ============================================================

/**
 * カテゴリ別にASPプログラムを取得する (Supabase優先、フォールバック付き)
 *
 * 1. インメモリキャッシュをチェック
 * 2. Supabase から取得 (is_active=true, category一致, priority昇順)
 * 3. エラー時は config.ts の静的データにフォールバック
 *
 * @param category コンテンツカテゴリ
 * @returns AspProgram[] (アクティブなプログラム)
 */
export async function getProgramsByCategoryFromDB(
  category: ContentCategory
): Promise<AspProgram[]> {
  // 1. キャッシュチェック
  const cached = cache.get(category)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  // 2. Supabase から取得を試行
  try {
    const supabase = tryCreateSupabaseClient()
    if (!supabase) {
      // Supabase未設定 → 静的データにフォールバック
      return getProgramsByCategory(category)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('asp_programs')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('priority', { ascending: true })

    if (error) {
      console.warn(
        `[asp/repository] Supabase query failed for category="${category}": ${error.message}. Falling back to static config.`
      )
      return getProgramsByCategory(category)
    }

    if (!data || data.length === 0) {
      // DB にデータがない場合も静的データにフォールバック
      return getProgramsByCategory(category)
    }

    // mapRowToProgram は AspProgramSeed を返すが、AspProgram と構造互換
    const programs: AspProgram[] = data.map((row: import('@/types/database').AspProgramRow) => {
      const seed = mapRowToProgram(row)
      return {
        id: seed.id,
        aspName: seed.aspName as AspProgram['aspName'],
        programName: seed.programName,
        programId: seed.programId,
        category: seed.category,
        affiliateUrl: seed.affiliateUrl,
        rewardAmount: seed.rewardAmount,
        rewardType: seed.rewardType,
        conversionCondition: seed.conversionCondition || undefined,
        approvalRate: seed.approvalRate,
        epc: seed.epc,
        itpSupport: seed.itpSupport,
        cookieDuration: seed.cookieDuration,
        isActive: seed.isActive,
        priority: seed.priority,
        recommendedAnchors: seed.recommendedAnchors,
        landingPageUrl: seed.landingPageUrl,
        notes: seed.notes,
      }
    })

    // 3. キャッシュに格納
    cache.set(category, {
      data: programs,
      expiresAt: Date.now() + CACHE_TTL_MS,
    })

    return programs
  } catch (err) {
    console.warn(
      `[asp/repository] Unexpected error fetching programs for category="${category}":`,
      err instanceof Error ? err.message : err,
      'Falling back to static config.'
    )
    return getProgramsByCategory(category)
  }
}
