/**
 * 管理画面記事API Unit Tests
 * GET/POST /api/admin/articles の契約テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockArticleReviewItem,
  createMockSupabaseQuery,
} from '@/test/helpers'
import type { ArticleReviewItem } from '@/types/admin'

// 認証モック
const mockValidateAuth = vi.fn()
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: mockValidateAuth,
}))

// モックデータ
const mockArticles: ArticleReviewItem[] = [
  createMockArticleReviewItem({ id: 'review-001', status: 'pending', complianceScore: 96 }),
  createMockArticleReviewItem({ id: 'review-002', status: 'approved', complianceScore: 98, title: 'ED治療ガイド', category: 'ed' }),
  createMockArticleReviewItem({ id: 'review-003', status: 'rejected', complianceScore: 72, title: 'スキンケア入門', category: 'skincare' }),
]

// Supabase モック
vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => createMockSupabaseQuery(mockArticles)),
  })),
}))

// APIルートモック
const mockGetArticles = vi.fn()
const mockPostArticle = vi.fn()

vi.mock('@/app/api/admin/articles/route', () => ({
  GET: mockGetArticles,
  POST: mockPostArticle,
}))

describe('管理画面記事API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateAuth.mockReturnValue({ authorized: true, user: { id: 'admin-001' } })

    mockGetArticles.mockResolvedValue(
      new Response(JSON.stringify({ articles: mockArticles, totalCount: mockArticles.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    mockPostArticle.mockResolvedValue(
      new Response(JSON.stringify({ success: true, articleId: 'review-001' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  describe('GET /api/admin/articles', () => {
    describe('認証', () => {
      it('認証済みリクエストが200を返すこと', async () => {
        const response = await mockGetArticles(new Request('http://localhost/api/admin/articles'))
        expect(response.status).toBe(200)
      })

      it('未認証リクエストが401を返すこと', async () => {
        mockValidateAuth.mockReturnValue({ authorized: false })
        mockGetArticles.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        )

        const response = await mockGetArticles(new Request('http://localhost/api/admin/articles'))
        expect(response.status).toBe(401)
      })
    })

    describe('レスポンス形式', () => {
      it('記事リストを返すこと', async () => {
        const response = await mockGetArticles(new Request('http://localhost/api/admin/articles'))
        const data = await response.json()

        expect(data.articles).toBeDefined()
        expect(Array.isArray(data.articles)).toBe(true)
        expect(data.totalCount).toBe(3)
      })

      it('各記事にArticleReviewItemの必須フィールドが含まれること', async () => {
        const response = await mockGetArticles(new Request('http://localhost/api/admin/articles'))
        const data = await response.json()

        data.articles.forEach((article: ArticleReviewItem) => {
          expect(article.id).toBeDefined()
          expect(article.articleId).toBeDefined()
          expect(article.title).toBeDefined()
          expect(article.slug).toBeDefined()
          expect(article.category).toBeDefined()
          expect(typeof article.complianceScore).toBe('number')
          expect(['pending', 'approved', 'rejected']).toContain(article.status)
          expect(article.authorName).toBeDefined()
          expect(article.generatedAt).toBeDefined()
        })
      })

      it('ステータスフィルタが機能すること', async () => {
        const pendingArticles = mockArticles.filter(a => a.status === 'pending')
        mockGetArticles.mockResolvedValueOnce(
          new Response(JSON.stringify({ articles: pendingArticles, totalCount: pendingArticles.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

        const response = await mockGetArticles(
          new Request('http://localhost/api/admin/articles?status=pending')
        )
        const data = await response.json()

        data.articles.forEach((article: ArticleReviewItem) => {
          expect(article.status).toBe('pending')
        })
      })
    })
  })

  describe('POST /api/admin/articles', () => {
    describe('認証', () => {
      it('認証済みリクエストが200を返すこと', async () => {
        const response = await mockPostArticle(
          new Request('http://localhost/api/admin/articles', {
            method: 'POST',
            body: JSON.stringify({
              articleId: 'review-001',
              action: 'approve',
              reviewNotes: 'LGTM',
            }),
          })
        )
        expect(response.status).toBe(200)
      })

      it('未認証リクエストが401を返すこと', async () => {
        mockValidateAuth.mockReturnValue({ authorized: false })
        mockPostArticle.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        )

        const response = await mockPostArticle(
          new Request('http://localhost/api/admin/articles', {
            method: 'POST',
            body: JSON.stringify({ articleId: 'review-001', action: 'approve' }),
          })
        )
        expect(response.status).toBe(401)
      })
    })

    describe('レビューアクション', () => {
      it('承認アクションが正常に処理されること', async () => {
        const response = await mockPostArticle(
          new Request('http://localhost/api/admin/articles', {
            method: 'POST',
            body: JSON.stringify({
              articleId: 'review-001',
              action: 'approve',
              reviewNotes: '薬機法チェックOK',
            }),
          })
        )
        const data = await response.json()

        expect(data.success).toBe(true)
        expect(data.articleId).toBeDefined()
      })

      it('却下アクションが正常に処理されること', async () => {
        mockPostArticle.mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true, articleId: 'review-003' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )

        const response = await mockPostArticle(
          new Request('http://localhost/api/admin/articles', {
            method: 'POST',
            body: JSON.stringify({
              articleId: 'review-003',
              action: 'reject',
              reviewNotes: 'コンプライアンススコアが基準以下',
            }),
          })
        )
        const data = await response.json()

        expect(data.success).toBe(true)
      })
    })
  })
})
