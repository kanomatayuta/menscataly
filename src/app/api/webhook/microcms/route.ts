// microCMS Webhook 受信エンドポイント
// POST /api/webhook/microcms
//
// 記事の公開・更新・削除時に Supabase articles テーブルを同期する
// microCMS管理画面の Webhook設定で本URLを登録し、
// シークレットキーを MICROCMS_WEBHOOK_SECRET に設定すること

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, upsertArticle, deleteArticle } from '@/lib/supabase/client'
import type { MicroCMSWebhookPayload } from '@/types/microcms'

export async function POST(req: NextRequest) {
  // ── Webhook Secret 認証 ──────────────────────────────────
  const secret = req.headers.get('x-microcms-signature') ?? req.headers.get('x-webhook-secret')
  if (process.env.MICROCMS_WEBHOOK_SECRET && secret !== process.env.MICROCMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: MicroCMSWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // articles API のみ処理
  if (payload.api !== 'articles') {
    return NextResponse.json({ message: 'Skipped: not articles API' })
  }

  const supabase = createServerClient()

  try {
    switch (payload.type) {
      case 'new':
      case 'edit': {
        const article = payload.contents?.new?.publishValue
        if (!article) {
          // 下書き保存の場合は同期不要
          return NextResponse.json({ message: 'Skipped: no published content' })
        }

        await upsertArticle(supabase, {
          microcms_id: payload.id,
          title: article.title,
          slug: article.id, // microCMS id をスラッグとして使用
          category: article.category?.slug ?? 'uncategorized',
        })

        return NextResponse.json({
          message: `Article ${payload.type === 'new' ? 'created' : 'updated'}`,
          id: payload.id,
        })
      }

      case 'delete': {
        await deleteArticle(supabase, payload.id)
        return NextResponse.json({ message: 'Article deleted', id: payload.id })
      }

      default:
        return NextResponse.json({ message: 'Unknown event type' })
    }
  } catch (err) {
    console.error('[webhook/microcms] Supabase sync error:', err)
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
