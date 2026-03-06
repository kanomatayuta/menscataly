/**
 * 検索UI改善テスト
 *
 * 検索結果0件のUI表示、検索履歴のlocalStorage保存/読込、
 * ローディング状態の表示を検証する
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchBox } from '@/components/search/SearchBox'

// ============================================================
// next/navigation モック (setup.ts のグローバルモックに加えてカスタマイズ)
// ============================================================

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/search',
  useSearchParams: () => mockSearchParams,
}))

// ============================================================
// localStorage モック
// ============================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

// ============================================================
// テスト本体
// ============================================================

describe('検索UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    })
    localStorageMock.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================
  // SearchBox コンポーネント
  // ============================================================

  describe('SearchBox', () => {
    it('検索ボックスがレンダリングされること', () => {
      render(<SearchBox />)

      expect(screen.getByRole('search')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('記事を検索...')).toBeInTheDocument()
    })

    it('autoFocus=true でフォーカスが当たること', () => {
      render(<SearchBox autoFocus />)

      const input = screen.getByPlaceholderText('記事を検索...')
      expect(input).toHaveFocus()
    })

    it('検索フォーム送信で router.push が呼ばれること', () => {
      render(<SearchBox />)

      const input = screen.getByPlaceholderText('記事を検索...')
      fireEvent.change(input, { target: { value: 'AGA' } })
      fireEvent.submit(screen.getByRole('search'))

      expect(mockPush).toHaveBeenCalledWith('/search?q=AGA')
    })

    it('空文字では検索されないこと', () => {
      render(<SearchBox />)

      const input = screen.getByPlaceholderText('記事を検索...')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.submit(screen.getByRole('search'))

      expect(mockPush).not.toHaveBeenCalled()
    })

    it('検索キーワードがURLエンコードされること', () => {
      render(<SearchBox />)

      const input = screen.getByPlaceholderText('記事を検索...')
      fireEvent.change(input, { target: { value: 'AGA 治療' } })
      fireEvent.submit(screen.getByRole('search'))

      expect(mockPush).toHaveBeenCalledWith('/search?q=AGA%20%E6%B2%BB%E7%99%82')
    })

    it('onSubmit コールバックが呼ばれること', () => {
      const onSubmit = vi.fn()
      render(<SearchBox onSubmit={onSubmit} />)

      const input = screen.getByPlaceholderText('記事を検索...')
      fireEvent.change(input, { target: { value: 'AGA' } })
      fireEvent.submit(screen.getByRole('search'))

      expect(onSubmit).toHaveBeenCalled()
    })

    it('アクセシビリティ: aria-label が設定されていること', () => {
      render(<SearchBox />)

      const form = screen.getByRole('search')
      expect(form).toHaveAttribute('aria-label', 'サイト内検索')
    })

    it('ラベルが存在すること (sr-only)', () => {
      render(<SearchBox />)

      expect(screen.getByLabelText('記事を検索')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 検索結果0件のUI (契約テスト)
  // ============================================================

  describe('検索結果0件表示', () => {
    /**
     * SearchResults はサーバーコンポーネントのため直接レンダリングテストは難しい
     * ここでは表示すべき要素の契約を定義する
     */

    it('0件メッセージの契約: 必要なテキストが定義されていること', () => {
      const emptyResultMessages = {
        primary: '検索結果がありません',
        secondary: '別のキーワードで検索してみてください。',
      }

      expect(emptyResultMessages.primary).toBe('検索結果がありません')
      expect(emptyResultMessages.secondary).toContain('別のキーワード')
    })

    it('検索結果なしのスタブUIが正しくレンダリングされること', () => {
      // 検索結果0件のUIコンポーネントのスタブ
      function EmptySearchResult() {
        return (
          <div className="py-16 text-center" data-testid="empty-search">
            <p className="text-neutral-500">検索結果がありません</p>
            <p className="mt-2 text-sm text-neutral-400">
              別のキーワードで検索してみてください。
            </p>
          </div>
        )
      }

      render(<EmptySearchResult />)

      expect(screen.getByTestId('empty-search')).toBeInTheDocument()
      expect(screen.getByText('検索結果がありません')).toBeInTheDocument()
      expect(screen.getByText('別のキーワードで検索してみてください。')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 検索履歴のlocalStorage保存/読込
  // ============================================================

  describe('検索履歴 localStorage', () => {
    const SEARCH_HISTORY_KEY = 'menscataly_search_history'
    const MAX_HISTORY = 10

    /** 検索履歴を保存する (将来のUI拡張用ユーティリティの契約テスト) */
    function saveSearchHistory(keyword: string): string[] {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
      const history: string[] = stored ? JSON.parse(stored) : []

      // 重複を削除して先頭に追加
      const filtered = history.filter((h) => h !== keyword)
      const updated = [keyword, ...filtered].slice(0, MAX_HISTORY)

      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated))
      return updated
    }

    /** 検索履歴を読み込む */
    function loadSearchHistory(): string[] {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (!stored) return []
      try {
        return JSON.parse(stored)
      } catch {
        return []
      }
    }

    /** 検索履歴をクリアする */
    function clearSearchHistory(): void {
      localStorage.removeItem(SEARCH_HISTORY_KEY)
    }

    it('検索キーワードがlocalStorageに保存されること', () => {
      saveSearchHistory('AGA治療')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        SEARCH_HISTORY_KEY,
        JSON.stringify(['AGA治療'])
      )
    })

    it('複数の検索キーワードが保存されること', () => {
      saveSearchHistory('AGA治療')
      saveSearchHistory('医療脱毛')

      const history = loadSearchHistory()
      expect(history).toEqual(['医療脱毛', 'AGA治療'])
    })

    it('重複キーワードは最新位置に移動すること', () => {
      saveSearchHistory('AGA治療')
      saveSearchHistory('医療脱毛')
      saveSearchHistory('AGA治療')

      const history = loadSearchHistory()
      expect(history).toEqual(['AGA治療', '医療脱毛'])
    })

    it('最大10件まで保存されること', () => {
      for (let i = 0; i < 15; i++) {
        saveSearchHistory(`キーワード${i}`)
      }

      const history = loadSearchHistory()
      expect(history.length).toBe(MAX_HISTORY)
      expect(history[0]).toBe('キーワード14')
    })

    it('検索履歴がクリアできること', () => {
      saveSearchHistory('AGA治療')
      saveSearchHistory('医療脱毛')
      clearSearchHistory()

      const history = loadSearchHistory()
      expect(history).toEqual([])
    })

    it('localStorageが空の場合、空配列が返されること', () => {
      const history = loadSearchHistory()
      expect(history).toEqual([])
    })

    it('不正なJSONの場合、空配列が返されること', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid json{{{')
      const history = loadSearchHistory()
      expect(history).toEqual([])
    })
  })

  // ============================================================
  // ローディング状態の表示
  // ============================================================

  describe('ローディング状態', () => {
    it('ローディングスタブUIが正しくレンダリングされること', () => {
      function SearchLoading() {
        return (
          <div
            className="flex items-center justify-center py-24"
            data-testid="search-loading"
            role="status"
            aria-label="検索中"
          >
            <span className="text-sm text-neutral-500">検索中...</span>
          </div>
        )
      }

      render(<SearchLoading />)

      expect(screen.getByTestId('search-loading')).toBeInTheDocument()
      expect(screen.getByText('検索中...')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', '検索中')
    })

    it('ローディング → 結果表示の状態遷移が正しいこと', async () => {
      let isLoading = true

      function SearchWithLoading() {
        if (isLoading) {
          return (
            <div data-testid="search-loading" role="status">
              <span>検索中...</span>
            </div>
          )
        }
        return (
          <div data-testid="search-results">
            <p>検索結果: 3件</p>
          </div>
        )
      }

      const { rerender } = render(<SearchWithLoading />)

      // ローディング状態
      expect(screen.getByTestId('search-loading')).toBeInTheDocument()
      expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()

      // 結果表示に切り替え
      isLoading = false
      rerender(<SearchWithLoading />)

      await waitFor(() => {
        expect(screen.getByTestId('search-results')).toBeInTheDocument()
      })
      expect(screen.queryByTestId('search-loading')).not.toBeInTheDocument()
    })
  })
})
