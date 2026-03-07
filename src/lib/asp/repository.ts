/**
 * ASPプログラム データアクセス層
 * Supabase からプログラムを取得し、失敗時は config.ts の静的データにフォールバックする
 *
 * - サーバーサイド専用 (service role client)
 * - インメモリキャッシュ (5分TTL)
 * - Promise-based cache でキャッシュスタンピードを防止
 */

import { connection } from 'next/server'
import type { AspProgram } from '@/types/asp-config'
import type { ContentCategory } from '@/types/content'
import type { AspProgramRow } from '@/types/database'
import { getProgramsByCategory } from './config'
import { mapRowToProgram } from './helpers'

// ============================================================
// キャッシュ設定
// ============================================================

const CACHE_TTL_MS = 5 * 60 * 1000 // 5分

interface CacheEntry {
  promise: Promise<AspProgram[]>
  expiresAt: number
}

/** カテゴリ別インメモリキャッシュ (Promise-based でスタンピード防止) */
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
async function tryCreateSupabaseClient() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return null
    }
    // 動的 import で ESM 互換に
    // createServerSupabaseClient は環境変数未設定時に throw するため、
    // ここで事前チェックしてから呼び出す
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    return createServerSupabaseClient()
  } catch {
    return null
  }
}

// ============================================================
// 内部データ取得
// ============================================================

/**
 * Supabase から ASP プログラムを取得する内部関数
 * キャッシュスタンピード防止のため、getProgramsByCategoryFromDB から分離
 */
async function fetchProgramsFromSupabase(category: ContentCategory): Promise<AspProgram[]> {
  const supabase = await tryCreateSupabaseClient()
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
    // PPR プリレンダリング時の fetch() 拒否はログ不要
    if (!error.message?.includes("prerender")) {
      console.warn(
        `[asp/repository] Supabase query failed for category="${category}": ${error.message}. Falling back to static config.`
      )
    }
    return getProgramsByCategory(category)
  }

  if (!data || data.length === 0) {
    // DB にデータがない場合も静的データにフォールバック
    return getProgramsByCategory(category)
  }

  // mapRowToProgram は AspProgramSeed を返すが、AspProgram と構造互換
  const programs: AspProgram[] = data.map((row: AspProgramRow) => {
    const seed = mapRowToProgram(row)
    return {
      id: seed.id,
      aspName: seed.aspName as AspProgram['aspName'],
      programName: seed.programName,
      programId: seed.programId,
      category: seed.category,
      rewardTiers: seed.rewardTiers,
      approvalRate: seed.approvalRate,
      epc: seed.epc,
      itpSupport: seed.itpSupport,
      cookieDuration: seed.cookieDuration,
      isActive: seed.isActive,
      priority: seed.priority,
      recommendedAnchors: seed.recommendedAnchors,
      notes: seed.notes,
      adCreatives: seed.adCreatives,
      advertiserName: seed.advertiserName,
      aspCategory: seed.aspCategory,
      confirmationPeriodDays: seed.confirmationPeriodDays,
      partnershipStatus: seed.partnershipStatus,
      lastApprovalDate: seed.lastApprovalDate,
    }
  })

  return programs
}

// ============================================================
// データ取得 (公開API)
// ============================================================

/**
 * カテゴリ別にASPプログラムを取得する (Supabase優先、フォールバック付き)
 *
 * 1. インメモリキャッシュをチェック (Promise-based でスタンピード防止)
 * 2. Supabase から取得 (is_active=true, category一致, priority昇順)
 * 3. エラー時は config.ts の静的データにフォールバック
 *
 * @param category コンテンツカテゴリ
 * @returns AspProgram[] (アクティブなプログラム)
 */
export async function getProgramsByCategoryFromDB(
  category: ContentCategory
): Promise<AspProgram[]> {
  // connection() を呼んでから Date.now() を使用 (PPR対応)
  await connection()
  // 1. キャッシュチェック (Promise-based)
  const now = Date.now()
  const cached = cache.get(category)
  if (cached && cached.expiresAt > now) {
    return cached.promise
  }

  // 2. 新しい Promise をキャッシュに即座に格納（同時リクエストは同じ Promise を共有）
  const promise = fetchProgramsFromSupabase(category)
  cache.set(category, { promise, expiresAt: now + CACHE_TTL_MS })

  // fetch が失敗したらキャッシュから削除（次回リクエストで再試行できるように）
  promise.catch(() => cache.delete(category))

  return promise
}
