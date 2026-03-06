/**
 * A8LinkManager コンポーネント テスト
 *
 * A8.net リンクマネージャーの Script タグ出力を検証する。
 * 新実装: 単一の Script タグ + onReady コールバックで初期化
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// ==============================================================
// next/script のモック
// ==============================================================

let capturedOnReady: (() => void) | undefined

vi.mock('next/script', () => ({
  default: ({
    id,
    src,
    strategy,
    onReady,
    ..._rest
  }: {
    id?: string
    src?: string
    strategy?: string
    onReady?: () => void
    [key: string]: unknown
  }) => {
    // onReady コールバックをキャプチャ
    capturedOnReady = onReady
    return (
      <script
        id={id}
        src={src}
        data-strategy={strategy}
        data-testid={id}
      />
    )
  },
}))

// ==============================================================
// テスト
// ==============================================================

describe('A8LinkManager', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    capturedOnReady = undefined
    process.env = { ...ORIGINAL_ENV }
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  // ============================================================
  // CONFIG_ID 未設定時の振る舞い
  // ============================================================

  describe('CONFIG_ID 未設定時', () => {
    it('NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID が未設定の場合、何もレンダリングしないこと', async () => {
      delete process.env.NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID

      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      const { container } = render(<A8LinkManager />)
      expect(container.innerHTML).toBe('')
    })

    it('NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID が空文字の場合、何もレンダリングしないこと', async () => {
      process.env.NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID = ''

      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      const { container } = render(<A8LinkManager />)
      expect(container.innerHTML).toBe('')
    })
  })

  // ============================================================
  // CONFIG_ID 設定時の振る舞い
  // ============================================================

  describe('CONFIG_ID 設定時', () => {
    const TEST_CONFIG_ID = 'test-config-id-abc123'

    beforeEach(() => {
      process.env.NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID = TEST_CONFIG_ID
    })

    it('SDK Script タグが1つだけレンダリングされること', async () => {
      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      const { container } = render(<A8LinkManager />)
      const scripts = container.querySelectorAll('script')

      expect(scripts.length).toBe(1)
      expect(scripts[0].id).toBe('a8-linkmgr-sdk')
    })

    it('SDK URL が正しいこと', async () => {
      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      const { container } = render(<A8LinkManager />)
      const sdkScript = container.querySelector('#a8-linkmgr-sdk')

      expect(sdkScript).not.toBeNull()
      expect(sdkScript?.getAttribute('src')).toBe(
        'https://statics.a8.net/a8link/a8linkmgr.js'
      )
    })

    it('SDK Script の strategy が afterInteractive であること', async () => {
      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      const { container } = render(<A8LinkManager />)
      const sdkScript = container.querySelector('#a8-linkmgr-sdk')

      expect(sdkScript).not.toBeNull()
      expect(sdkScript?.getAttribute('data-strategy')).toBe('afterInteractive')
    })

    it('onReady コールバックが設定されること', async () => {
      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      render(<A8LinkManager />)

      expect(capturedOnReady).toBeDefined()
      expect(typeof capturedOnReady).toBe('function')
    })

    it('onReady コールバックが a8linkmgr を正しい config_id で呼び出すこと', async () => {
      const mockA8linkmgr = vi.fn()
      ;(globalThis as Record<string, unknown>).a8linkmgr = mockA8linkmgr

      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      render(<A8LinkManager />)

      // SDK ロード完了をシミュレート
      expect(capturedOnReady).toBeDefined()
      capturedOnReady!()

      expect(mockA8linkmgr).toHaveBeenCalledWith({
        config_id: TEST_CONFIG_ID,
      })

      delete (globalThis as Record<string, unknown>).a8linkmgr
    })
  })

  // ============================================================
  // Script ID
  // ============================================================

  describe('Script ID', () => {
    it('SDK Script の id が a8-linkmgr-sdk であること', async () => {
      process.env.NEXT_PUBLIC_A8_LINKMGR_CONFIG_ID = 'test-id'

      const { A8LinkManager } = await import(
        '@/components/tracking/A8LinkManager'
      )

      const { container } = render(<A8LinkManager />)
      const sdkScript = container.querySelector('[id="a8-linkmgr-sdk"]')
      expect(sdkScript).not.toBeNull()
    })
  })
})
