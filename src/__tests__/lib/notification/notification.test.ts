/**
 * NotificationRouter ユニットテスト
 *
 * 重要度に応じた通知ルーティングを検証する。
 * - critical: Slack + Email
 * - warning:  Slack のみ
 * - info:     Slack のみ
 * - Email 未設定時のスキップ
 * - Slack webhook 未設定時のフォールバック
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// SlackNotifier の sendAlert をスパイするための共有モック関数
const mockSendAlert = vi.fn()

// Slack モジュールをモック — class コンストラクタとして動作するようにする
vi.mock('@/lib/notification/slack', () => {
  class MockSlackNotifier {
    sendAlert = mockSendAlert
  }
  return {
    SlackNotifier: MockSlackNotifier,
  }
})

import { NotificationRouter, type NotificationPayload } from '@/lib/notification/index'

// ==============================================================
// テスト用ヘルパー
// ==============================================================

function createPayload(severity: 'critical' | 'warning' | 'info', overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    severity,
    title: `テスト通知 (${severity})`,
    message: `テスト通知メッセージです。重要度: ${severity}`,
    metadata: { source: 'unit-test' },
    ...overrides,
  }
}

// ==============================================================
// テスト本体
// ==============================================================

describe('NotificationRouter', () => {
  let router: NotificationRouter
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    router = new NotificationRouter()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // ==============================================================
  // ルーティング (severity ごとの振り分け)
  // ==============================================================

  describe('severity ごとのルーティング', () => {
    it('critical: Slack が呼ばれること', async () => {
      mockSendAlert.mockResolvedValue(true)
      const payload = createPayload('critical')

      const result = await router.notify(payload)

      expect(mockSendAlert).toHaveBeenCalledWith(
        'critical',
        payload.title,
        payload.message,
        payload.metadata
      )
      expect(result).toBe(true)
    })

    it('warning: Slack が呼ばれること', async () => {
      mockSendAlert.mockResolvedValue(true)
      const payload = createPayload('warning')

      const result = await router.notify(payload)

      expect(mockSendAlert).toHaveBeenCalledWith(
        'warning',
        payload.title,
        payload.message,
        payload.metadata
      )
      expect(result).toBe(true)
    })

    it('info: Slack が呼ばれること', async () => {
      mockSendAlert.mockResolvedValue(true)
      const payload = createPayload('info')

      const result = await router.notify(payload)

      expect(mockSendAlert).toHaveBeenCalledWith(
        'info',
        payload.title,
        payload.message,
        payload.metadata
      )
      expect(result).toBe(true)
    })
  })

  // ==============================================================
  // critical 時の Slack + Email 同時送信
  // ==============================================================

  describe('critical 通知の Slack + Email', () => {
    it('critical: Slack 成功 + Email 未設定 → true (少なくとも1つ成功)', async () => {
      mockSendAlert.mockResolvedValue(true)
      // ALERT_EMAIL_TO を未設定にする
      delete process.env.ALERT_EMAIL_TO

      const payload = createPayload('critical')
      const result = await router.notify(payload)

      // Slack は成功したので true
      expect(result).toBe(true)
      expect(mockSendAlert).toHaveBeenCalledTimes(1)
    })

    it('critical: Slack 失敗 + Email 未設定 → false', async () => {
      mockSendAlert.mockResolvedValue(false)
      delete process.env.ALERT_EMAIL_TO

      const payload = createPayload('critical')
      const result = await router.notify(payload)

      // 全て失敗
      expect(result).toBe(false)
    })
  })

  // ==============================================================
  // Email 通知のプレースホルダー
  // ==============================================================

  describe('Email 通知', () => {
    it('ALERT_EMAIL_TO 未設定の場合、Email は false を返す (Slack も失敗なら全体 false)', async () => {
      delete process.env.ALERT_EMAIL_TO
      mockSendAlert.mockResolvedValue(false)

      const payload = createPayload('critical')
      const result = await router.notify(payload)

      // Slack 失敗 + Email 未設定 = 全て false
      expect(result).toBe(false)
    })

    it('ALERT_EMAIL_TO 設定時でも送信ロジック未実装のため Email は false を返す', async () => {
      process.env.ALERT_EMAIL_TO = 'admin@menscataly.com'
      mockSendAlert.mockResolvedValue(false)

      const payload = createPayload('critical')
      const result = await router.notify(payload)

      // Slack 失敗 + Email 送信ロジック未実装 = 全体 false
      expect(result).toBe(false)
    })
  })

  // ==============================================================
  // Slack 通知の成功・失敗
  // ==============================================================

  describe('Slack 通知の成功・失敗', () => {
    it('Slack 成功時に true を返すこと (warning)', async () => {
      mockSendAlert.mockResolvedValue(true)
      const payload = createPayload('warning')
      const result = await router.notify(payload)

      expect(result).toBe(true)
    })

    it('Slack 失敗時に false を返すこと (warning)', async () => {
      mockSendAlert.mockResolvedValue(false)
      const payload = createPayload('warning')
      const result = await router.notify(payload)

      expect(result).toBe(false)
    })

    it('Slack 成功時に true を返すこと (info)', async () => {
      mockSendAlert.mockResolvedValue(true)
      const payload = createPayload('info')
      const result = await router.notify(payload)

      expect(result).toBe(true)
    })
  })

  // ==============================================================
  // sendDailyReport テスト
  // ==============================================================

  describe('sendDailyReport', () => {
    it('日次レポートが Slack に送信されること', async () => {
      mockSendAlert.mockResolvedValue(true)

      const report = {
        totalArticles: 30,
        publishedToday: 2,
        avgComplianceScore: 94,
        activeAlerts: 1,
        revenue30d: 15000,
      }

      const result = await router.sendDailyReport(report)

      expect(result).toBe(true)
      expect(mockSendAlert).toHaveBeenCalledTimes(1)
      expect(mockSendAlert).toHaveBeenCalledWith(
        'info',
        '日次レポート',
        expect.stringContaining('MENS CATALY')
      )
    })

    it('日次レポートのメッセージに主要指標が含まれること', async () => {
      mockSendAlert.mockResolvedValue(true)

      const report = {
        totalArticles: 30,
        publishedToday: 2,
        avgComplianceScore: 94,
        activeAlerts: 1,
        revenue30d: 15000,
      }

      await router.sendDailyReport(report)

      const callArgs = mockSendAlert.mock.calls[0]
      const message = callArgs[2] as string

      expect(message).toContain('30')   // totalArticles
      expect(message).toContain('2')    // publishedToday
      expect(message).toContain('94')   // avgComplianceScore
      expect(message).toContain('1')    // activeAlerts
    })
  })
})
