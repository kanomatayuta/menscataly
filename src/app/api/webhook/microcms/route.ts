// microCMS Webhook 受信エンドポイント
// POST /api/webhook/microcms
//
// 記事の公開・更新・削除時に Supabase articles テーブルを同期し、
// Next.js キャッシュを即座に無効化する (revalidatePath + revalidateTag)
//
// microCMS管理画面のWebhook設定:
//   URL: https://your-domain.com/api/webhook/microcms
//   シークレット: MICROCMS_WEBHOOK_SECRET に設定

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createServerSupabaseClient, upsertArticle, deleteArticle } from '@/lib/supabase/client'
import type { MicroCMSWebhookPayload } from '@/types/microcms'

// ============================================================
// シグネチャ検証 (HMAC-SHA256)
// microCMS は X-MICROCMS-Signature ヘッダに
// HMAC-SHA256(secret, body) を Base64エンコードして送信する
// ============================================================

async function verifySignature(
  secret: string,
  signature: string,
  body: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(body)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  // タイミング攻撃対策: 文字数が一致しない場合でも定数時間で比較
  if (expectedSignature.length !== signature.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return result === 0
}

// ============================================================
// POST ハンドラー
// ============================================================

export async function POST(req: NextRequest) {
  // ── ボディを先に読み取る (シグネチャ検証に必要) ──────────────
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 })
  }

  // ── シグネチャ検証 ──────────────────────────────────────────
  const webhookSecret = process.env.MICROCMS_WEBHOOK_SECRET
  if (!webhookSecret) {
    // シークレット未設定の場合はリクエストを拒否 (セキュリティ対策)
    console.error('[webhook/microcms] MICROCMS_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })
  }

  // microCMS は 'X-MICROCMS-Signature' ヘッダを使用
  const signature =
    req.headers.get('X-MICROCMS-Signature') ??
    req.headers.get('x-microcms-signature') ??
    req.headers.get('x-webhook-secret') ??
    ''

  const isValid = await verifySignature(webhookSecret, signature, rawBody)
  if (!isValid) {
    console.warn('[webhook/microcms] Invalid signature')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── ペイロード解析 ─────────────────────────────────────────
  let payload: MicroCMSWebhookPayload
  try {
    payload = JSON.parse(rawBody) as MicroCMSWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // articles API のみ処理
  if (payload.api !== 'articles') {
    return NextResponse.json({ message: `Skipped: api="${payload.api}" is not articles` })
  }

  const supabase = createServerSupabaseClient()

  try {
    switch (payload.type) {
      case 'new':
      case 'edit': {
        const publishedContent = payload.contents?.new?.publishValue
        if (!publishedContent) {
          // 下書き保存のみ — Supabase同期は不要
          return NextResponse.json({ message: 'Skipped: no published content' })
        }

        const slug = publishedContent.slug ?? payload.id

        await upsertArticle(supabase, {
          microcms_id: payload.id,
          slug,
          title: publishedContent.title ?? '(無題)',
          category: publishedContent.category?.slug ?? 'uncategorized',
          status: 'published',
          published_at: new Date().toISOString(),
        })

        // revalidatePath: 該当ページのキャッシュを即座に無効化
        revalidatePath('/articles')
        revalidatePath(`/articles/${slug}`)
        revalidatePath('/', 'layout')

        // revalidateTag: cacheTag を使用しているキャッシュを無効化
        // Next.js 16 Cache Components の revalidateTag は第2引数にキャッシュプロファイルが必要
        revalidateTag('articles', 'default')
        revalidateTag(`article-${slug}`, 'default')
        revalidateTag(`article-${payload.id}`, 'default')

        return NextResponse.json({
          message: `Article ${payload.type === 'new' ? 'created' : 'updated'}`,
          id: payload.id,
          slug,
          revalidated: {
            paths: ['/articles', `/articles/${slug}`, '/'],
            tags: ['articles', `article-${slug}`, `article-${payload.id}`],
          },
        })
      }

      case 'delete': {
        await deleteArticle(supabase, payload.id)

        // キャッシュ revalidate (スラッグ不明のため全体を revalidate)
        revalidatePath('/articles')
        revalidatePath('/', 'layout')
        revalidateTag('articles', 'default')
        revalidateTag(`article-${payload.id}`, 'default')

        return NextResponse.json({
          message: 'Article deleted',
          id: payload.id,
          revalidated: {
            paths: ['/articles', '/'],
            tags: ['articles', `article-${payload.id}`],
          },
        })
      }

      default: {
        const _exhaustive: never = payload.type
        return NextResponse.json({ message: `Unknown event type: ${_exhaustive}` })
      }
    }
  } catch (err) {
    console.error('[webhook/microcms] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET は許可しない
export function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
