// Supabase クライアント
// 依存: @supabase/supabase-js
// インストール: npm install @supabase/supabase-js

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ============================================================
// ブラウザ用クライアント (anon key — RLS適用)
// ============================================================
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)
}

// ============================================================
// サーバーサイド用クライアント (service role — RLS bypass)
// API Routes / Server Components / Server Actions で使用
// ============================================================
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined')
  }
  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// ============================================================
// ヘルパー関数
// ============================================================

export async function upsertArticle(
  supabase: ReturnType<typeof createServerClient>,
  data: {
    microcms_id: string
    title: string
    slug: string
    category: string
  }
) {
  const { data: result, error } = await supabase
    .from('articles')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(
      { ...data, updated_at: new Date().toISOString() } as any,
      { onConflict: 'microcms_id' }
    )
    .select()
    .single()

  if (error) throw error
  return result
}

export async function deleteArticle(
  supabase: ReturnType<typeof createServerClient>,
  microcmId: string
) {
  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('microcms_id', microcmId)

  if (error) throw error
}
