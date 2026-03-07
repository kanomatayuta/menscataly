/**
 * POST /api/admin/articles/[id]/publish
 * 承認済み記事を microCMS に公開し、ステータスを更新する
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import { withRateLimit } from '@/lib/admin/rate-limit'
import type { ReviewStatus } from '@/types/admin'

// ============================================================
// リクエスト型
// ============================================================

interface PublishRequest {
  /** 公開方法: immediate (即時) or scheduled (予約) */
  publishMode?: 'immediate' | 'scheduled'
  /** 予約公開日時 (ISO 8601) — publishMode: scheduled 時に必須 */
  scheduledAt?: string
  /** microCMS の公開ステータス: draft or published */
  microCmsStatus?: 'draft' | 'published'
}

// ============================================================
// Route Handler
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = await withRateLimit(request, 'admin:articles:publish')
  if (rateLimited) return rateLimited

  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: 'Article ID is required' },
      { status: 400 }
    )
  }

  let body: PublishRequest = {}
  try {
    body = (await request.json()) as PublishRequest
  } catch {
    // JSON body はオプション — デフォルト値を使用
  }

  const publishMode = body.publishMode ?? 'immediate'
  const microCmsStatus = body.microCmsStatus ?? 'published'
  const now = new Date().toISOString()

  if (publishMode === 'scheduled' && !body.scheduledAt) {
    return NextResponse.json(
      { error: 'scheduledAt is required when publishMode is "scheduled"' },
      { status: 400 }
    )
  }

  if (publishMode === 'scheduled' && body.scheduledAt) {
    const scheduledDate = new Date(body.scheduledAt)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'scheduledAt must be a valid ISO 8601 date' },
        { status: 400 }
      )
    }
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'scheduledAt must be a future date' },
        { status: 400 }
      )
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    // ドライラン: Supabase/microCMS未設定
    return NextResponse.json({
      success: true,
      articleId: id,
      publishMode,
      microCmsStatus,
      scheduledAt: body.scheduledAt ?? null,
      publishedAt: publishMode === 'immediate' ? now : null,
      message: `Article ${id} publish ${publishMode} (dry-run)`,
      isDryRun: true,
    })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // 1. 記事の現在のステータスを取得して承認済みか確認
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: articleData, error: fetchError } = await (supabase as any)
      .from('articles')
      .select('id, microcms_id, title, slug, content, status, category')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Article not found' },
          { status: 404 }
        )
      }
      console.error('[admin/articles/publish] Fetch error:', fetchError.message)
      return NextResponse.json(
        { error: 'Failed to fetch article' },
        { status: 500 }
      )
    }

    // レビューキューのステータス確認
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reviewData } = await (supabase as any)
      .from('article_review_queue')
      .select('status')
      .eq('article_id', id)
      .single()

    const reviewStatus = (reviewData?.status as ReviewStatus) ?? null

    // 承認済みでない場合は公開不可
    if (reviewStatus && reviewStatus !== 'approved' && reviewStatus !== 'published') {
      return NextResponse.json(
        {
          error: `Article must be approved before publishing. Current review status: ${reviewStatus}`,
        },
        { status: 409 }
      )
    }

    // 2. microCMS に公開
    let microCmsContentId: string | null = articleData.microcms_id
    const microCmsServiceDomain = process.env.MICROCMS_SERVICE_DOMAIN
    const microCmsApiKey = process.env.MICROCMS_API_KEY

    if (microCmsServiceDomain && microCmsApiKey) {
      try {
        const apiBase = `https://${microCmsServiceDomain}.microcms.io/api/v1`

        if (microCmsContentId) {
          // 既存コンテンツを更新
          const patchRes = await fetch(`${apiBase}/articles/${microCmsContentId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-MICROCMS-API-KEY': microCmsApiKey,
            },
            body: JSON.stringify({
              title: articleData.title,
              slug: articleData.slug,
              content: articleData.content,
            }),
          })

          if (!patchRes.ok) {
            const errorText = await patchRes.text()
            console.error('[admin/articles/publish] microCMS PATCH error:', errorText)
            return NextResponse.json(
              { error: `microCMS update failed: ${patchRes.status}` },
              { status: 502 }
            )
          }
        } else {
          // 新規コンテンツを作成
          const postRes = await fetch(`${apiBase}/articles`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-MICROCMS-API-KEY': microCmsApiKey,
            },
            body: JSON.stringify({
              title: articleData.title,
              slug: articleData.slug,
              content: articleData.content,
            }),
          })

          if (!postRes.ok) {
            const errorText = await postRes.text()
            console.error('[admin/articles/publish] microCMS POST error:', errorText)
            return NextResponse.json(
              { error: `microCMS create failed: ${postRes.status}` },
              { status: 502 }
            )
          }

          const postData = (await postRes.json()) as { id?: string }
          microCmsContentId = postData.id ?? null
        }
      } catch (microCmsError) {
        console.error('[admin/articles/publish] microCMS error:', microCmsError)
        return NextResponse.json(
          { error: 'Failed to publish to microCMS' },
          { status: 502 }
        )
      }
    }

    // 3. Supabase の記事ステータスを更新
    const articleUpdate: Record<string, unknown> = {
      status: 'published' as const,
      updated_at: now,
      published_at: publishMode === 'immediate' ? now : body.scheduledAt,
    }

    if (microCmsContentId && !articleData.microcms_id) {
      articleUpdate.microcms_id = microCmsContentId
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('articles')
      .update(articleUpdate)
      .eq('id', id)

    if (updateError) {
      console.error('[admin/articles/publish] Article update error:', updateError.message)
      return NextResponse.json(
        { error: 'Failed to update article status' },
        { status: 500 }
      )
    }

    // 4. レビューキューのステータスを published に更新
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('article_review_queue')
      .update({
        status: 'published' as const,
        reviewed_at: now,
      })
      .eq('article_id', id)

    return NextResponse.json({
      success: true,
      articleId: id,
      microCmsContentId,
      publishMode,
      microCmsStatus,
      scheduledAt: body.scheduledAt ?? null,
      publishedAt: publishMode === 'immediate' ? now : body.scheduledAt,
      message: `Article ${id} published successfully`,
      isDryRun: false,
    })
  } catch (err) {
    console.error('[admin/articles/publish] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
