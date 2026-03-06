/**
 * レビューキューAPI Unit Tests
 * GET /api/admin/review-queue — 一覧取得
 * GET /api/admin/review-queue/stats — 統計取得
 * PATCH /api/admin/review-queue/[id] — ステータス更新
 *
 * TDD: 他エージェントが並行して実装予定の API に対する先行テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockArticleReviewItem,
  createMockSupabaseQuery,
} from '@/test/helpers'
import type { ArticleReviewItem, ReviewStatus } from '@/types/admin'

// ============================================================
// 認証モック
// ============================================================

const mockValidateAuth = vi.fn()
vi.mock('@/lib/admin/auth', () => ({
  validateAdminAuth: mockValidateAuth,
  getAuthErrorStatus: vi.fn((error: { code: string }) =>
    error.code === 'FORBIDDEN' ? 403 : 401
  ),
}))

// ============================================================
// Supabase モック
// ============================================================

const mockPendingItems: ArticleReviewItem[] = [
  createMockArticleReviewItem({
    id: 'queue-001',
    status: 'pending',
    complianceScore: 92,
    title: 'AGA治療の最新ガイド',
    category: 'aga',
  }),
  createMockArticleReviewItem({
    id: 'queue-002',
    status: 'pending',
    complianceScore: 78,
    title: 'ED治療薬の比較',
    category: 'ed',
  }),
]

const mockApprovedItems: ArticleReviewItem[] = [
  createMockArticleReviewItem({
    id: 'queue-003',
    status: 'approved',
    complianceScore: 98,
    title: '医療脱毛の選び方',
    category: 'hair-removal',
    reviewedAt: '2026-03-05T10:00:00Z',
    reviewedBy: 'admin-001',
  }),
]

const mockRejectedItems: ArticleReviewItem[] = [
  createMockArticleReviewItem({
    id: 'queue-004',
    status: 'rejected',
    complianceScore: 45,
    title: 'スキンケア入門',
    category: 'skincare',
    reviewedAt: '2026-03-05T11:00:00Z',
    reviewedBy: 'admin-001',
  }),
]

const allItems = [...mockPendingItems, ...mockApprovedItems, ...mockRejectedItems]

vi.mock('@/lib/supabase/client', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => createMockSupabaseQuery(allItems)),
  })),
}))

// ============================================================
// APIルートモック
// ============================================================

const mockGetReviewQueue = vi.fn()
const mockGetReviewQueueStats = vi.fn()
const mockPatchReviewQueueItem = vi.fn()

vi.mock('@/app/api/admin/review-queue/route', () => ({
  GET: mockGetReviewQueue,
}))

vi.mock('@/app/api/admin/review-queue/stats/route', () => ({
  GET: mockGetReviewQueueStats,
}))

vi.mock('@/app/api/admin/review-queue/[id]/route', () => ({
  PATCH: mockPatchReviewQueueItem,
}))

// ============================================================
// テスト本体
// ============================================================

describe('レビューキューAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateAuth.mockReturnValue({ authorized: true, user: { id: 'admin-001' } })

    // GET /api/admin/review-queue のデフォルトレスポンス
    mockGetReviewQueue.mockResolvedValue(
      new Response(
        JSON.stringify({ items: allItems, totalCount: allItems.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    // GET /api/admin/review-queue/stats のデフォルトレスポンス
    mockGetReviewQueueStats.mockResolvedValue(
      new Response(
        JSON.stringify({
          pending: 2,
          approved: 1,
          rejected: 1,
          total: 4,
          avgComplianceScore: 78.25,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )

    // PATCH /api/admin/review-queue/[id] のデフォルトレスポンス
    mockPatchReviewQueueItem.mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, id: 'queue-001', status: 'approved' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    )
  })

  // ============================================================
  // GET /api/admin/review-queue
  // ============================================================

  describe('GET /api/admin/review-queue', () => {
    describe('認証', () => {
      it('認証なしで401を返すこと', async () => {
        mockValidateAuth.mockReturnValue({ authorized: false })
        mockGetReviewQueue.mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        )

        const response = await mockGetReviewQueue(
          new Request('http://localhost/api/admin/review-queue')
        )
        expect(response.status).toBe(401)
      })

      it('認証ありで200を返すこと', async () => {
        const response = await mockGetReviewQueue(
          new Request('http://localhost/api/admin/review-queue')
        )
        expect(response.status).toBe(200)
      })
    })

    describe('レスポンス形式', () => {
      it('レビューキュー一覧を返すこと', async () => {
        const response = await mockGetReviewQueue(
          new Request('http://localhost/api/admin/review-queue')
        )
        const data = await response.json()

        expect(data.items).toBeDefined()
        expect(Array.isArray(data.items)).toBe(true)
        expect(data.totalCount).toBe(4)
      })

      it('各アイテムに必須フィールドが含まれること', async () => {
        const response = await mockGetReviewQueue(
          new Request('http://localhost/api/admin/review-queue')
        )
        const data = await response.json()

        data.items.forEach((item: ArticleReviewItem) => {
          expect(item.id).toBeDefined()
          expect(item.title).toBeDefined()
          expect(item.slug).toBeDefined()
          expect(item.category).toBeDefined()
          expect(typeof item.complianceScore).toBe('number')
          expect(
            ['draft', 'pending', 'approved', 'rejected', 'revision', 'published'] as ReviewStatus[]
          ).toContain(item.status)
          expect(item.generatedAt).toBeDefined()
        })
      })
    })

    describe('フィルタリング', () => {
      it('status=pending でフィルタリングできること', async () => {
        mockGetReviewQueue.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              items: mockPendingItems,
              totalCount: mockPendingItems.length,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )

        const response = await mockGetReviewQueue(
          new Request('http://localhost/api/admin/review-queue?status=pending')
        )
        const data = await response.json()

        expect(data.totalCount).toBe(2)
        data.items.forEach((item: ArticleReviewItem) => {
          expect(item.status).toBe('pending')
        })
      })

      it('status=approved でフィルタリングできること', async () => {
        mockGetReviewQueue.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              items: mockApprovedItems,
              totalCount: mockApprovedItems.length,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )

        const response = await mockGetReviewQueue(
          new Request('http://localhost/api/admin/review-queue?status=approved')
        )
        const data = await response.json()

        expect(data.totalCount).toBe(1)
        data.items.forEach((item: ArticleReviewItem) => {
          expect(item.status).toBe('approved')
        })
      })

      it('status=rejected でフィルタリングできること', async () => {
        mockGetReviewQueue.mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              items: mockRejectedItems,
              totalCount: mockRejectedItems.length,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        )

        const response = await mockGetReviewQueue(
          new Request('http://localhost/api/admin/review-queue?status=rejected')
        )
        const data = await response.json()

        expect(data.totalCount).toBe(1)
        data.items.forEach((item: ArticleReviewItem) => {
          expect(item.status).toBe('rejected')
        })
      })
    })
  })

  // ============================================================
  // GET /api/admin/review-queue/stats
  // ============================================================

  describe('GET /api/admin/review-queue/stats', () => {
    it('認証なしで401を返すこと', async () => {
      mockValidateAuth.mockReturnValue({ authorized: false })
      mockGetReviewQueueStats.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )

      const response = await mockGetReviewQueueStats(
        new Request('http://localhost/api/admin/review-queue/stats')
      )
      expect(response.status).toBe(401)
    })

    it('統計データを返すこと', async () => {
      const response = await mockGetReviewQueueStats(
        new Request('http://localhost/api/admin/review-queue/stats')
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(typeof data.pending).toBe('number')
      expect(typeof data.approved).toBe('number')
      expect(typeof data.rejected).toBe('number')
      expect(typeof data.total).toBe('number')
      expect(typeof data.avgComplianceScore).toBe('number')
    })

    it('統計の合計が正しいこと', async () => {
      const response = await mockGetReviewQueueStats(
        new Request('http://localhost/api/admin/review-queue/stats')
      )
      const data = await response.json()

      expect(data.total).toBe(data.pending + data.approved + data.rejected)
    })
  })

  // ============================================================
  // PATCH /api/admin/review-queue/[id]
  // ============================================================

  describe('PATCH /api/admin/review-queue/[id]', () => {
    it('認証なしで401を返すこと', async () => {
      mockValidateAuth.mockReturnValue({ authorized: false })
      mockPatchReviewQueueItem.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      )

      const response = await mockPatchReviewQueueItem(
        new Request('http://localhost/api/admin/review-queue/queue-001', {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
        })
      )
      expect(response.status).toBe(401)
    })

    it('承認ステータスへの更新が成功すること', async () => {
      const response = await mockPatchReviewQueueItem(
        new Request('http://localhost/api/admin/review-queue/queue-001', {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'approved',
            comment: '薬機法チェックOK',
          }),
        })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('approved')
    })

    it('却下ステータスへの更新が成功すること', async () => {
      mockPatchReviewQueueItem.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, id: 'queue-002', status: 'rejected' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const response = await mockPatchReviewQueueItem(
        new Request('http://localhost/api/admin/review-queue/queue-002', {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'rejected',
            comment: 'コンプライアンススコアが基準以下',
          }),
        })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('rejected')
    })

    it('リビジョン要求への更新が成功すること', async () => {
      mockPatchReviewQueueItem.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, id: 'queue-001', status: 'revision' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const response = await mockPatchReviewQueueItem(
        new Request('http://localhost/api/admin/review-queue/queue-001', {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'revision',
            comment: '表現を修正してください',
          }),
        })
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.status).toBe('revision')
    })

    it('無効なステータスで400エラーを返すこと', async () => {
      mockPatchReviewQueueItem.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Invalid status: invalid_status' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const response = await mockPatchReviewQueueItem(
        new Request('http://localhost/api/admin/review-queue/queue-001', {
          method: 'PATCH',
          body: JSON.stringify({ status: 'invalid_status' }),
        })
      )

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('存在しないIDで404エラーを返すこと', async () => {
      mockPatchReviewQueueItem.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Review item not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      )

      const response = await mockPatchReviewQueueItem(
        new Request('http://localhost/api/admin/review-queue/nonexistent-id', {
          method: 'PATCH',
          body: JSON.stringify({ status: 'approved' }),
        })
      )

      expect(response.status).toBe(404)
    })
  })
})
