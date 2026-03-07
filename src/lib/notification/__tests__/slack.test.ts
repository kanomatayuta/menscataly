/**
 * Slack通知クライアント テスト
 * - SLACK_WEBHOOK_URL未設定時の安全な動作
 * - sendMessage の引数が正しくfetchに渡されること
 * - fetch失敗時にエラーを投げないこと (サイレント失敗)
 * - Block Kit形式のメッセージ構築
 * - sendAlert の重要度別動作
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SlackNotifier } from '../slack'
import type { SlackBlock } from '../slack'

// fetch をグローバルモック
const mockFetch = vi.fn()

describe('SlackNotifier', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...ORIGINAL_ENV }
    global.fetch = mockFetch as unknown as typeof fetch
    mockFetch.mockReset()
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
    vi.restoreAllMocks()
  })

  // =============================================================================
  // SLACK_WEBHOOK_URL 未設定時
  // =============================================================================

  describe('Webhook URL 未設定時', () => {
    it('sendMessage がエラーを投げずに false を返すこと', async () => {
      delete process.env.SLACK_WEBHOOK_URL
      const notifier = new SlackNotifier()

      const result = await notifier.sendMessage('#test', 'hello')

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('sendAlert がエラーを投げずに false を返すこと', async () => {
      delete process.env.SLACK_WEBHOOK_URL
      const notifier = new SlackNotifier()

      const result = await notifier.sendAlert('critical', 'Test Alert', 'Something happened')

      expect(result).toBe(false)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('console.warn を出力すること', async () => {
      delete process.env.SLACK_WEBHOOK_URL
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const notifier = new SlackNotifier()

      await notifier.sendMessage('#test', 'hello')

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Webhook URL')
      )
      warnSpy.mockRestore()
    })
  })

  // =============================================================================
  // sendMessage — 正常系
  // =============================================================================

  describe('sendMessage', () => {
    it('fetch に正しいURL・メソッド・ヘッダー・ボディを渡すこと', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx'
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const notifier = new SlackNotifier(webhookUrl)
      const result = await notifier.sendMessage('#general', 'Test message')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1)

      const [url, options] = mockFetch.mock.calls[0]
      expect(url).toBe(webhookUrl)
      expect(options.method).toBe('POST')
      expect(options.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(options.body)
      expect(body.channel).toBe('#general')
      expect(body.text).toBe('Test message')
    })

    it('blocks が正しく渡されること', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx'
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const blocks: SlackBlock[] = [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: 'Hello *world*' },
        },
      ]

      const notifier = new SlackNotifier(webhookUrl)
      await notifier.sendMessage('#general', 'fallback', blocks)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.blocks).toEqual(blocks)
    })

    it('環境変数からWebhook URLを取得すること', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/env-url'
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const notifier = new SlackNotifier()
      await notifier.sendMessage('#test', 'msg')

      expect(mockFetch.mock.calls[0][0]).toBe('https://hooks.slack.com/services/env-url')
    })
  })

  // =============================================================================
  // sendMessage — fetch失敗時
  // =============================================================================

  describe('sendMessage — エラーハンドリング', () => {
    it('fetch がネットワークエラーを投げても例外にならず false を返すこと', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx'
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const notifier = new SlackNotifier(webhookUrl)
      const result = await notifier.sendMessage('#test', 'msg')

      expect(result).toBe(false)
    })

    it('fetch が非OK応答を返しても例外にならず false を返すこと', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      const notifier = new SlackNotifier(webhookUrl)
      const result = await notifier.sendMessage('#test', 'msg')

      expect(result).toBe(false)
    })

    it('fetch エラー時に console.error を出力すること', async () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx'
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const notifier = new SlackNotifier(webhookUrl)
      await notifier.sendMessage('#test', 'msg')

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SlackNotifier]'),
        expect.stringContaining('Connection refused')
      )
      errorSpy.mockRestore()
    })
  })

  // =============================================================================
  // sendAlert — Block Kit 構築
  // =============================================================================

  describe('sendAlert', () => {
    const webhookUrl = 'https://hooks.slack.com/services/T00/B00/xxx'

    it('critical アラートで赤色アタッチメントを送信すること', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const notifier = new SlackNotifier(webhookUrl)
      const result = await notifier.sendAlert('critical', 'Server Down', 'Production server is not responding')

      expect(result).toBe(true)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.attachments).toBeDefined()
      expect(body.attachments[0].color).toBe('#FF0000')
    })

    it('warning アラートでオレンジ色を使用すること', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const notifier = new SlackNotifier(webhookUrl)
      await notifier.sendAlert('warning', 'High Cost', 'Cost exceeded threshold')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.attachments[0].color).toBe('#FFA500')
    })

    it('info アラートで青色を使用すること', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const notifier = new SlackNotifier(webhookUrl)
      await notifier.sendAlert('info', 'Pipeline Complete', 'Article generation finished')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.attachments[0].color).toBe('#0000FF')
    })

    it('メタデータ付きアラートでフィールドが追加されること', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const notifier = new SlackNotifier(webhookUrl)
      await notifier.sendAlert('info', 'Test', 'Body', {
        articleId: '123',
        score: 85,
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const blocks = body.attachments[0].blocks
      // metadata fields should be added as a section with fields
      const fieldSection = blocks.find(
        (b: SlackBlock) => b.type === 'section' && b.fields && b.fields.length > 0
      )
      expect(fieldSection).toBeDefined()
      expect(fieldSection.fields.length).toBe(2)
    })

    it('Block Kit にヘッダー・セクション・アクションボタンが含まれること', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => 'ok' })

      const notifier = new SlackNotifier(webhookUrl)
      await notifier.sendAlert('info', 'Test Title', 'Test body')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      const blocks = body.attachments[0].blocks
      const types = blocks.map((b: SlackBlock) => b.type)

      expect(types).toContain('header')
      expect(types).toContain('section')
      expect(types).toContain('actions')
    })

    it('sendAlert fetch失敗時にエラーを投げず false を返すこと', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'))

      const notifier = new SlackNotifier(webhookUrl)
      const result = await notifier.sendAlert('critical', 'Fail', 'msg')

      expect(result).toBe(false)
    })
  })
})
