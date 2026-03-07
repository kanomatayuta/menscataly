// Supabase クライアント
// 依存: @supabase/supabase-js v2, @supabase/ssr
//
// 環境変数:
//   NEXT_PUBLIC_SUPABASE_URL       — Supabase プロジェクトURL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  — 匿名キー (RLS適用)
//   SUPABASE_SERVICE_ROLE_KEY      — サービスロールキー (RLSバイパス)

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRServerClient, createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import type { Database, ArticleInsert, ArticleUpdate, ArticleRow } from '@/types/database'
// Note: categories テーブルは削除済み (microCMS に移行)

// ============================================================
// ブラウザ用クライアント (anon key — RLS適用)
// Client Components で使用
// ============================================================
export function createBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey)
}

// 後方互換エイリアス
export const createBrowserClient = createBrowserSupabaseClient

// ============================================================
// サーバーサイド用クライアント (service role — RLSバイパス)
// Server Components / Route Handlers / Server Actions で使用
// ============================================================
export function createServerSupabaseClient() {
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

// 後方互換エイリアス
export const createServerClient = createServerSupabaseClient

// ============================================================
// SSR対応クライアント (Supabase Auth / Cookie管理)
// Server Components, Route Handlers, Server Actions で使用
// ============================================================

/**
 * SSR対応サーバークライアント (anon key — Cookie管理付き)
 * Server Components, Route Handlers, Server Actions で使用
 * Supabase Auth セッション管理に必要
 */
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  return createSSRServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

/**
 * SSR対応ブラウザクライアント (anon key — Cookie管理付き)
 * Client Components で使用
 * Supabase Auth セッション管理に必要
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')

  return createSSRBrowserClient(supabaseUrl, supabaseAnonKey)
}

// ============================================================
// 型エイリアス
// ============================================================

export type SupabaseServerClient = ReturnType<typeof createServerSupabaseClient>
export type SupabaseBrowserClient = ReturnType<typeof createBrowserSupabaseClient>

// ============================================================
// 型安全なクエリヘルパー
// ============================================================

/**
 * 記事をUpsert (microCMS同期用)
 * microcms_id の一致で重複排除する
 *
 * Note: supabase-js v2 の型推論が複雑なため、Insert 型を明示的にキャスト
 */
export async function upsertArticle(
  supabase: SupabaseServerClient,
  data: ArticleInsert & { microcms_id: string }
) {
  const payload = {
    ...data,
    updated_at: new Date().toISOString(),
  } satisfies ArticleInsert

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any)
    .from('articles')
    .upsert(payload, { onConflict: 'microcms_id' })
    .select()
    .single() as { data: ArticleRow | null; error: { message: string; code: string } | null }

  if (error) throw error
  return result
}

/**
 * 記事を更新する
 */
export async function updateArticle(
  supabase: SupabaseServerClient,
  id: string,
  data: ArticleUpdate
) {
  const payload = {
    ...data,
    updated_at: new Date().toISOString(),
  } satisfies ArticleUpdate

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase as any)
    .from('articles')
    .update(payload)
    .eq('id', id)
    .select()
    .single() as { data: ArticleRow | null; error: { message: string; code: string } | null }

  if (error) throw error
  return result
}

/**
 * microcms_id で記事を削除する
 */
export async function deleteArticle(
  supabase: SupabaseServerClient,
  microcmsId: string
) {
  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('microcms_id', microcmsId)

  if (error) throw error
}

/**
 * スラッグで公開済み記事を1件取得する
 */
export async function getArticleBySlug(
  supabase: SupabaseServerClient | SupabaseBrowserClient,
  slug: string
) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // 0件
    throw error
  }
  return data
}

/**
 * 記事一覧を取得する (RLS適用 — 公開済みのみ)
 */
export async function getArticles(
  supabase: SupabaseServerClient | SupabaseBrowserClient,
  options: {
    category?: string
    limit?: number
    offset?: number
    orderBy?: keyof ArticleRow
    ascending?: boolean
  } = {}
) {
  const {
    category,
    limit = 10,
    offset = 0,
    orderBy = 'published_at',
    ascending = false,
  } = options

  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .eq('status', 'published')
    .order(orderBy, { ascending })
    .range(offset, offset + limit - 1)

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error, count } = await query

  if (error) throw error
  return { articles: data ?? [], total: count ?? 0 }
}

// categories テーブルは削除済み — microCMS の getCategories() を使用してください
// import { getCategories } from '@/lib/microcms/client'
