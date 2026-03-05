/**
 * /api/admin/articles/[id]
 * GET: 記事詳細取得 (article_review_queue + article_review_comments)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminAuth } from '@/lib/admin/auth'
import type { ArticleReviewDetail, ReviewComment } from '@/types/admin'
import type { ContentCategory } from '@/types/content'

// ============================================================
// モックデータ (Supabase未設定時のフォールバック)
// ============================================================

function getMockArticleDetail(id: string): ArticleReviewDetail | null {
  const MOCK_ARTICLES: Record<string, ArticleReviewDetail> = {
    'rev-1': {
      id: 'rev-1',
      contentId: 'cnt-1',
      articleId: 'art-1',
      microcmsId: 'mc-abc123',
      title: 'AGA治療の基礎知識 — 原因・治療法・費用を徹底解説',
      slug: 'aga-basic-guide',
      category: 'aga' as ContentCategory,
      complianceScore: 96,
      status: 'approved',
      authorName: 'メンズカタリ編集部',
      generatedAt: '2026-03-01T06:30:00+09:00',
      reviewedAt: '2026-03-01T10:00:00+09:00',
      reviewedBy: 'admin',
      reviewNotes: null,
      reviewComment: null,
      complianceBreakdown: { yakkinhou: 98, keihinhou: 95, sutema: 96, eeat: 94 },
      reviewHistory: [
        {
          id: 'rc-1',
          author: 'admin',
          content: '薬機法チェック完了。問題なし。E-E-A-T要件も満たしています。',
          action: 'approve',
          createdAt: '2026-03-01T10:00:00+09:00',
        },
      ],
    },
    'rev-2': {
      id: 'rev-2',
      contentId: 'cnt-2',
      articleId: 'art-2',
      microcmsId: 'mc-def456',
      title: 'メンズ医療脱毛おすすめクリニック比較2026',
      slug: 'mens-hair-removal-clinics-2026',
      category: 'hair-removal' as ContentCategory,
      complianceScore: 91,
      status: 'pending',
      authorName: 'メンズカタリ編集部',
      generatedAt: '2026-03-02T06:30:00+09:00',
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: null,
      reviewComment: null,
      complianceBreakdown: { yakkinhou: 92, keihinhou: 88, sutema: 95, eeat: 90 },
      reviewHistory: [],
    },
    'rev-3': {
      id: 'rev-3',
      contentId: 'cnt-3',
      articleId: 'art-3',
      microcmsId: null,
      title: 'ED治療薬の種類と効果 — バイアグラ・シアリス・レビトラ',
      slug: 'ed-medication-comparison',
      category: 'ed' as ContentCategory,
      complianceScore: 78,
      status: 'rejected',
      authorName: 'メンズカタリ編集部',
      generatedAt: '2026-03-02T06:35:00+09:00',
      reviewedAt: '2026-03-02T11:00:00+09:00',
      reviewedBy: 'admin',
      reviewNotes: 'Compliance score too low. Multiple NG expressions found.',
      reviewComment: 'Compliance score too low. Multiple NG expressions found.',
      complianceBreakdown: { yakkinhou: 65, keihinhou: 82, sutema: 90, eeat: 75 },
      reviewHistory: [
        {
          id: 'rc-2',
          author: 'admin',
          content:
            '薬機法スコアが基準値を下回っています。「確実に効果がある」「副作用なし」等のNG表現が複数検出されました。修正してください。',
          action: 'reject',
          createdAt: '2026-03-02T11:00:00+09:00',
        },
      ],
    },
    'rev-4': {
      id: 'rev-4',
      contentId: 'cnt-4',
      articleId: 'art-4',
      microcmsId: 'mc-ghi789',
      title: 'メンズスキンケア入門 — 肌タイプ別おすすめルーティン',
      slug: 'mens-skincare-routine',
      category: 'skincare' as ContentCategory,
      complianceScore: 98,
      status: 'published',
      authorName: 'メンズカタリ編集部',
      generatedAt: '2026-03-03T06:30:00+09:00',
      reviewedAt: '2026-03-03T08:00:00+09:00',
      reviewedBy: 'admin',
      reviewNotes: null,
      reviewComment: null,
      complianceBreakdown: { yakkinhou: 99, keihinhou: 98, sutema: 97, eeat: 96 },
      reviewHistory: [
        {
          id: 'rc-3',
          author: 'admin',
          content: '全項目クリア。品質良好です。',
          action: 'approve',
          createdAt: '2026-03-03T08:00:00+09:00',
        },
        {
          id: 'rc-4',
          author: 'admin',
          content: 'microCMSへの公開が完了しました。',
          action: 'comment',
          createdAt: '2026-03-03T08:30:00+09:00',
        },
      ],
    },
    'rev-5': {
      id: 'rev-5',
      contentId: 'cnt-5',
      articleId: 'art-5',
      microcmsId: null,
      title: 'フィナステリドとデュタステリドの違い — 効果・副作用・選び方',
      slug: 'finasteride-vs-dutasteride',
      category: 'aga' as ContentCategory,
      complianceScore: 88,
      status: 'revision',
      authorName: 'メンズカタリ編集部',
      generatedAt: '2026-03-03T06:35:00+09:00',
      reviewedAt: '2026-03-03T09:00:00+09:00',
      reviewedBy: 'admin',
      reviewNotes: null,
      reviewComment: null,
      complianceBreakdown: { yakkinhou: 85, keihinhou: 90, sutema: 92, eeat: 84 },
      reviewHistory: [
        {
          id: 'rc-5',
          author: 'admin',
          content:
            'E-E-A-Tスコアが低めです。監修者情報と参考文献を追加してください。薬機法スコアも改善が必要です。',
          action: 'revision',
          createdAt: '2026-03-03T09:00:00+09:00',
        },
      ],
    },
  }

  return MOCK_ARTICLES[id] ?? null
}

// ============================================================
// GET: 記事詳細取得
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await validateAdminAuth(request)
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Supabase未設定時はモックデータにフォールバック
  if (!supabaseUrl || !serviceRoleKey) {
    const article = getMockArticleDetail(id)
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ article })
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // article_review_queue から記事情報を取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: queueRow, error: queueError } = await (supabase as any)
      .from('article_review_queue')
      .select('*')
      .eq('id', id)
      .single()

    if (queueError) {
      if (queueError.code === 'PGRST116') {
        // 0件
        return NextResponse.json({ error: 'Article not found' }, { status: 404 })
      }
      console.error('[admin/articles/[id]] Queue query error:', queueError.message)
      return NextResponse.json({ error: 'Failed to query article' }, { status: 500 })
    }

    if (!queueRow) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // レビューコメント履歴を取得
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: commentsData, error: commentsError } = await (supabase as any)
      .from('article_review_comments')
      .select('*')
      .eq('article_id', id)
      .order('created_at', { ascending: true })

    if (commentsError) {
      console.error('[admin/articles/[id]] Comments query error:', commentsError.message)
      // コメント取得失敗は致命的でないのでログのみ
    }

    const reviewHistory: ReviewComment[] = ((commentsData ?? []) as Record<string, unknown>[]).map(
      (row) => ({
        id: row.id as string,
        author: (row.author as string) ?? 'admin',
        content: (row.content as string) ?? '',
        action: row.action as ReviewComment['action'],
        createdAt: row.created_at as string,
      })
    )

    // complianceBreakdown のパース
    // DB では JSON カラムまたは個別カラムとして保存されている想定
    const rawBreakdown = queueRow.compliance_breakdown as Record<string, number> | null
    const complianceBreakdown = {
      yakkinhou: rawBreakdown?.yakkinhou ?? Math.round((queueRow.compliance_score as number) ?? 0),
      keihinhou: rawBreakdown?.keihinhou ?? Math.round((queueRow.compliance_score as number) ?? 0),
      sutema: rawBreakdown?.sutema ?? Math.round((queueRow.compliance_score as number) ?? 0),
      eeat: rawBreakdown?.eeat ?? Math.round((queueRow.compliance_score as number) ?? 0),
    }

    const article: ArticleReviewDetail = {
      id: queueRow.id as string,
      contentId: (queueRow.content_id as string) ?? (queueRow.article_id as string),
      articleId: (queueRow.article_id as string) ?? (queueRow.id as string),
      microcmsId: (queueRow.microcms_id as string | null) ?? null,
      title: (queueRow.title as string) ?? '（タイトルなし）',
      slug: (queueRow.slug as string) ?? '',
      category: (queueRow.category as ContentCategory) ?? 'column',
      complianceScore: parseFloat(String(queueRow.compliance_score ?? '0')),
      status: queueRow.status as ArticleReviewDetail['status'],
      authorName: (queueRow.author_name as string) ?? 'メンズカタリ編集部',
      generatedAt: (queueRow.generated_at as string) ?? new Date().toISOString(),
      reviewedAt: (queueRow.reviewed_at as string | null) ?? null,
      reviewedBy: (queueRow.reviewed_by as string | null) ?? null,
      reviewNotes: (queueRow.review_notes as string | null) ?? null,
      reviewComment: (queueRow.review_notes as string | null) ?? null,
      complianceBreakdown,
      reviewHistory,
      content: (queueRow.content as string | undefined) ?? undefined,
      htmlContent: (queueRow.html_content as string | undefined) ?? undefined,
      seoTitle: (queueRow.seo_title as string | undefined) ?? undefined,
      seoDescription: (queueRow.seo_description as string | undefined) ?? undefined,
      jsonLd: (queueRow.json_ld as Record<string, unknown> | undefined) ?? undefined,
    }

    return NextResponse.json({ article })
  } catch (err) {
    console.error('[admin/articles/[id]] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
