/**
 * レビューキュー管理UI コンポーネントテスト
 *
 * TDD: 他エージェントが並行して実装予定の /admin/review-queue ページに対する先行テスト
 * レンダリング、ステータスフィルタ、ページネーション、スコアバッジの色分けを検証する
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ArticleReviewItem, ReviewStatus } from '@/types/admin'

// ============================================================
// next/link モック
// ============================================================

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    [key: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// ============================================================
// テスト用のコンポーネントスタブ
// レビューキュー管理UIの契約テスト用
// 他エージェントの実装が完了したら実コンポーネントに差し替える
// ============================================================

interface ReviewQueueProps {
  items: ArticleReviewItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  activeTab: ReviewStatus | 'all'
  onTabChange: (tab: ReviewStatus | 'all') => void
  onPageChange: (page: number) => void
  onAction: (id: string, action: 'approve' | 'reject' | 'revision', comment?: string) => void
}

/**
 * スコアバッジの色分けロジック
 * - 90以上: 緑 (high)
 * - 70-89: 黄 (medium)
 * - 70未満: 赤 (low)
 */
function getScoreLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 90) return 'high'
  if (score >= 70) return 'medium'
  return 'low'
}

function getScoreBadgeColor(score: number): string {
  const level = getScoreLevel(score)
  switch (level) {
    case 'high':
      return 'bg-green-100 text-green-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'low':
      return 'bg-red-100 text-red-800'
  }
}

/** テスト用スタブコンポーネント */
function ReviewQueueStub({
  items,
  totalCount,
  currentPage,
  pageSize,
  activeTab,
  onTabChange,
  onPageChange,
  onAction,
}: ReviewQueueProps) {
  const totalPages = Math.ceil(totalCount / pageSize)
  const tabs: Array<ReviewStatus | 'all'> = ['all', 'pending', 'approved', 'rejected', 'revision']

  return (
    <div data-testid="review-queue">
      <h1>レビューキュー</h1>

      {/* ステータスフィルタータブ */}
      <div role="tablist" aria-label="ステータスフィルター">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
          >
            {tab === 'all' ? '全て' : tab}
          </button>
        ))}
      </div>

      {/* アイテム一覧 */}
      {items.length === 0 ? (
        <p>レビュー待ちのアイテムがありません</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>タイトル</th>
              <th>カテゴリ</th>
              <th>スコア</th>
              <th>ステータス</th>
              <th>アクション</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} data-testid={`review-item-${item.id}`}>
                <td>{item.title}</td>
                <td>{item.category}</td>
                <td>
                  <span
                    data-testid={`score-badge-${item.id}`}
                    className={getScoreBadgeColor(item.complianceScore)}
                    data-score-level={getScoreLevel(item.complianceScore)}
                  >
                    {item.complianceScore}
                  </span>
                </td>
                <td>{item.status}</td>
                <td>
                  {item.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onAction(item.id, 'approve')}
                        aria-label={`${item.title}を承認`}
                      >
                        承認
                      </button>
                      <button
                        onClick={() => onAction(item.id, 'reject')}
                        aria-label={`${item.title}を却下`}
                      >
                        却下
                      </button>
                      <button
                        onClick={() => onAction(item.id, 'revision')}
                        aria-label={`${item.title}の修正を依頼`}
                      >
                        修正依頼
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <nav aria-label="ページネーション">
          <button
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            前へ
          </button>
          <span data-testid="page-info">
            {currentPage} / {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            次へ
          </button>
        </nav>
      )}
    </div>
  )
}

// ============================================================
// モックデータ
// ============================================================

function createItems(count: number, status: ReviewStatus = 'pending'): ArticleReviewItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${String(i + 1).padStart(3, '0')}`,
    contentId: `content-${String(i + 1).padStart(3, '0')}`,
    title: `テスト記事 ${i + 1}`,
    slug: `test-article-${i + 1}`,
    category: (['aga', 'ed', 'skincare', 'hair-removal'] as const)[i % 4],
    status,
    complianceScore: 60 + (i * 10) % 40,
    generatedAt: '2026-03-01T00:00:00Z',
    reviewedAt: null,
    reviewedBy: null,
  }))
}

// ============================================================
// テスト本体
// ============================================================

describe('レビューキュー管理UI', () => {
  const mockOnTabChange = vi.fn()
  const mockOnPageChange = vi.fn()
  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('レンダリング', () => {
    it('レビューキュー一覧ページが正しくレンダリングされること', () => {
      const items = createItems(3)
      render(
        <ReviewQueueStub
          items={items}
          totalCount={3}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('レビューキュー')).toBeInTheDocument()
      expect(screen.getByTestId('review-queue')).toBeInTheDocument()
    })

    it('アイテムが0件の場合、空メッセージが表示されること', () => {
      render(
        <ReviewQueueStub
          items={[]}
          totalCount={0}
          currentPage={1}
          pageSize={10}
          activeTab="pending"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('レビュー待ちのアイテムがありません')).toBeInTheDocument()
    })

    it('各アイテムのタイトルとカテゴリが表示されること', () => {
      const items = createItems(2)
      render(
        <ReviewQueueStub
          items={items}
          totalCount={2}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('テスト記事 1')).toBeInTheDocument()
      expect(screen.getByText('テスト記事 2')).toBeInTheDocument()
    })

    it('pendingステータスのアイテムにアクションボタンが表示されること', () => {
      const items = createItems(1, 'pending')
      render(
        <ReviewQueueStub
          items={items}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('承認')).toBeInTheDocument()
      expect(screen.getByText('却下')).toBeInTheDocument()
      expect(screen.getByText('修正依頼')).toBeInTheDocument()
    })

    it('approvedステータスのアイテムにはアクションボタンが表示されないこと', () => {
      const items = createItems(1, 'approved')
      render(
        <ReviewQueueStub
          items={items}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.queryByText('承認')).not.toBeInTheDocument()
      expect(screen.queryByText('却下')).not.toBeInTheDocument()
    })
  })

  describe('ステータスフィルタータブ', () => {
    it('全てのフィルタータブが表示されること', () => {
      render(
        <ReviewQueueStub
          items={createItems(1)}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      const tabs = screen.getAllByRole('tab')
      expect(tabs.length).toBe(5) // all, pending, approved, rejected, revision
    })

    it('アクティブタブがaria-selected=trueになること', () => {
      render(
        <ReviewQueueStub
          items={createItems(1)}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="pending"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      const pendingTab = screen.getByRole('tab', { name: 'pending' })
      expect(pendingTab).toHaveAttribute('aria-selected', 'true')
    })

    it('タブクリックでonTabChangeが呼ばれること', () => {
      render(
        <ReviewQueueStub
          items={createItems(1)}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      const pendingTab = screen.getByRole('tab', { name: 'pending' })
      fireEvent.click(pendingTab)

      expect(mockOnTabChange).toHaveBeenCalledWith('pending')
    })

    it('異なるタブをクリックで切り替えられること', () => {
      render(
        <ReviewQueueStub
          items={createItems(1)}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      fireEvent.click(screen.getByRole('tab', { name: 'approved' }))
      expect(mockOnTabChange).toHaveBeenCalledWith('approved')

      fireEvent.click(screen.getByRole('tab', { name: 'rejected' }))
      expect(mockOnTabChange).toHaveBeenCalledWith('rejected')
    })
  })

  describe('ページネーション', () => {
    it('総ページ数が1以下の場合、ページネーションが表示されないこと', () => {
      render(
        <ReviewQueueStub
          items={createItems(3)}
          totalCount={3}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.queryByLabelText('ページネーション')).not.toBeInTheDocument()
    })

    it('総ページ数が2以上の場合、ページネーションが表示されること', () => {
      render(
        <ReviewQueueStub
          items={createItems(10)}
          totalCount={25}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByLabelText('ページネーション')).toBeInTheDocument()
      expect(screen.getByTestId('page-info')).toHaveTextContent('1 / 3')
    })

    it('最初のページでは「前へ」が無効になること', () => {
      render(
        <ReviewQueueStub
          items={createItems(10)}
          totalCount={25}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('前へ')).toBeDisabled()
    })

    it('最後のページでは「次へ」が無効になること', () => {
      render(
        <ReviewQueueStub
          items={createItems(5)}
          totalCount={25}
          currentPage={3}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      expect(screen.getByText('次へ')).toBeDisabled()
    })

    it('「次へ」クリックでonPageChangeが呼ばれること', () => {
      render(
        <ReviewQueueStub
          items={createItems(10)}
          totalCount={25}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      fireEvent.click(screen.getByText('次へ'))
      expect(mockOnPageChange).toHaveBeenCalledWith(2)
    })
  })

  describe('スコアバッジの色分け', () => {
    it('90以上のスコアにhighレベルが設定されること', () => {
      const items: ArticleReviewItem[] = [
        {
          id: 'high-score',
          contentId: 'c-001',
          title: '高スコア記事',
          slug: 'high-score',
          category: 'aga',
          status: 'pending',
          complianceScore: 95,
          generatedAt: '2026-03-01T00:00:00Z',
          reviewedAt: null,
          reviewedBy: null,
        },
      ]

      render(
        <ReviewQueueStub
          items={items}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      const badge = screen.getByTestId('score-badge-high-score')
      expect(badge).toHaveAttribute('data-score-level', 'high')
      expect(badge).toHaveClass('bg-green-100')
    })

    it('70-89のスコアにmediumレベルが設定されること', () => {
      const items: ArticleReviewItem[] = [
        {
          id: 'medium-score',
          contentId: 'c-002',
          title: '中スコア記事',
          slug: 'medium-score',
          category: 'ed',
          status: 'pending',
          complianceScore: 78,
          generatedAt: '2026-03-01T00:00:00Z',
          reviewedAt: null,
          reviewedBy: null,
        },
      ]

      render(
        <ReviewQueueStub
          items={items}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      const badge = screen.getByTestId('score-badge-medium-score')
      expect(badge).toHaveAttribute('data-score-level', 'medium')
      expect(badge).toHaveClass('bg-yellow-100')
    })

    it('70未満のスコアにlowレベルが設定されること', () => {
      const items: ArticleReviewItem[] = [
        {
          id: 'low-score',
          contentId: 'c-003',
          title: '低スコア記事',
          slug: 'low-score',
          category: 'skincare',
          status: 'pending',
          complianceScore: 45,
          generatedAt: '2026-03-01T00:00:00Z',
          reviewedAt: null,
          reviewedBy: null,
        },
      ]

      render(
        <ReviewQueueStub
          items={items}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      const badge = screen.getByTestId('score-badge-low-score')
      expect(badge).toHaveAttribute('data-score-level', 'low')
      expect(badge).toHaveClass('bg-red-100')
    })
  })

  describe('アクション', () => {
    it('承認ボタンクリックでonActionがapproveで呼ばれること', () => {
      const items = createItems(1)
      render(
        <ReviewQueueStub
          items={items}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      fireEvent.click(screen.getByText('承認'))
      expect(mockOnAction).toHaveBeenCalledWith('item-001', 'approve')
    })

    it('却下ボタンクリックでonActionがrejectで呼ばれること', () => {
      const items = createItems(1)
      render(
        <ReviewQueueStub
          items={items}
          totalCount={1}
          currentPage={1}
          pageSize={10}
          activeTab="all"
          onTabChange={mockOnTabChange}
          onPageChange={mockOnPageChange}
          onAction={mockOnAction}
        />
      )

      fireEvent.click(screen.getByText('却下'))
      expect(mockOnAction).toHaveBeenCalledWith('item-001', 'reject')
    })
  })
})
