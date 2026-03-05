// microCMS プレビューモード API
// GET /api/preview?contentId=xxx&draftKey=yyy&secret=zzz
//
// microCMS 管理画面のプレビューURL設定:
//   https://your-domain.com/api/preview?contentId={CONTENT_ID}&draftKey={DRAFT_KEY}&secret=PREVIEW_SECRET
//
// Next.js 16 Draft Mode に対応

import { NextRequest, NextResponse } from 'next/server'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { getArticleBySlug, getArticleById } from '@/lib/microcms/client'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  // ── パラメータ取得 ────────────────────────────────────────
  const secret = searchParams.get('secret')
  const contentId = searchParams.get('contentId')
  const draftKey = searchParams.get('draftKey')

  // ── シークレット検証 ──────────────────────────────────────
  const previewSecret = process.env.MICROCMS_PREVIEW_SECRET
  if (!previewSecret) {
    // シークレット未設定の場合はリクエストを拒否 (セキュリティ対策)
    return NextResponse.json({ error: 'Preview not configured' }, { status: 503 })
  }
  if (secret !== previewSecret) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // ── 必須パラメータ検証 ────────────────────────────────────
  if (!contentId) {
    return NextResponse.json({ error: 'Missing contentId' }, { status: 400 })
  }
  if (!draftKey) {
    return NextResponse.json({ error: 'Missing draftKey' }, { status: 400 })
  }

  // ── 下書き記事の存在確認 ──────────────────────────────────
  // 環境変数が設定されている場合のみ microCMS API を呼び出す
  let slug: string = contentId
  try {
    // まず contentId (microCMS ID) で記事取得を試みる
    const article = await getArticleById(contentId, draftKey)
    slug = article.slug ?? article.id
  } catch {
    // getArticleById が失敗した場合は contentId をスラッグとして使用
    // (モックデータフォールバック時も同様)
    const articleBySlug = await getArticleBySlug(contentId, draftKey)
    if (articleBySlug) {
      slug = articleBySlug.slug ?? articleBySlug.id
    }
  }

  // ── Draft Mode を有効化 ───────────────────────────────────
  const draft = await draftMode()
  draft.enable()

  // ── 記事詳細ページへリダイレクト ──────────────────────────
  // draftKey をクエリパラメータとして渡す
  redirect(`/articles/${slug}?draftKey=${draftKey}`)
}
