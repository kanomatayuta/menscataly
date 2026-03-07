/**
 * Slack通知クライアント
 * Webhook URLを使ったSlack通知の送信
 * 重要度に応じた色分け・アクションボタン対応
 */

import type { AlertLevel } from '@/types/admin'

// ============================================================
// Slack Block Kit 型定義
// ============================================================

export interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
  elements?: Array<{
    type: string
    text?: {
      type: string
      text: string
      emoji?: boolean
    }
    url?: string
    action_id?: string
    style?: string
  }>
  fields?: Array<{
    type: string
    text: string
  }>
  accessory?: {
    type: string
    text?: {
      type: string
      text: string
    }
    url?: string
  }
}

export interface SlackMessage {
  channel?: string
  text: string
  blocks?: SlackBlock[]
  attachments?: Array<{
    color: string
    blocks?: SlackBlock[]
    text?: string
    fallback?: string
  }>
}

// ============================================================
// 重要度 → 色マッピング
// ============================================================

const SEVERITY_COLORS: Record<AlertLevel, string> = {
  critical: '#FF0000',  // 赤
  warning: '#FFA500',   // 黄色/オレンジ
  info: '#0000FF',      // 青
}

const SEVERITY_EMOJI: Record<AlertLevel, string> = {
  critical: ':rotating_light:',
  warning: ':warning:',
  info: ':information_source:',
}

// ============================================================
// SlackNotifier クラス
// ============================================================

/**
 * チャンネル名からWebhook URLを解決する
 * 環境変数 SLACK_WEBHOOK_URL_<SUFFIX> で上書き可能
 */
const CHANNEL_WEBHOOK_MAP: Record<string, string> = {
  '#レポート': 'SLACK_WEBHOOK_URL_REPORT',
  '#記事': 'SLACK_WEBHOOK_URL',
}

function resolveWebhookUrl(channel: string, defaultUrl: string | null): string | null {
  const envKey = CHANNEL_WEBHOOK_MAP[channel]
  if (envKey) {
    const url = process.env[envKey]
    if (url) return url
  }
  return defaultUrl
}

export class SlackNotifier {
  private webhookUrl: string | null

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl ?? process.env.SLACK_WEBHOOK_URL ?? null
  }

  /**
   * Slackメッセージを送信する
   * @param channel チャンネル名（チャンネル別Webhook URLが設定されていればそちらを使用）
   * @param text メッセージテキスト（フォールバック用）
   * @param blocks Block Kit ブロック（省略可）
   */
  async sendMessage(
    channel: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<boolean> {
    const webhookUrl = resolveWebhookUrl(channel, this.webhookUrl)
    if (!webhookUrl) {
      console.warn(`[SlackNotifier] Webhook URL が未設定 (${channel}) — 通知をスキップします`)
      return false
    }

    const payload: SlackMessage = {
      channel,
      text,
      blocks,
    }

    const maxRetries = 2

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          console.log(`[SlackNotifier] メッセージ送信成功: ${channel}`)
          return true
        }

        const errorText = await response.text()
        console.error(`[SlackNotifier] 送信失敗: ${response.status} ${errorText}`)

        if (response.status < 500 || attempt >= maxRetries) return false

        console.warn(`[SlackNotifier] リトライ (${attempt + 1}/${maxRetries})...`)
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      } catch (err) {
        console.error('[SlackNotifier] 送信エラー:', err instanceof Error ? err.message : err)
        if (attempt >= maxRetries) return false
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
    return false
  }

  /**
   * アラート通知を送信する（重要度に応じた色分け・ボタン付き）
   * @param severity アラート重要度
   * @param title アラートタイトル
   * @param message アラート本文
   * @param metadata 追加メタデータ（オプション）
   */
  async sendAlert(
    severity: AlertLevel,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const color = SEVERITY_COLORS[severity]
    const emoji = SEVERITY_EMOJI[severity]
    const adminDashboardUrl = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/admin`
      : 'https://menscataly.vercel.app/admin'

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message,
        },
      },
    ]

    // メタデータがある場合はフィールドとして追加
    if (metadata && Object.keys(metadata).length > 0) {
      const fields = Object.entries(metadata)
        .slice(0, 10) // 最大10フィールド
        .map(([key, value]) => ({
          type: 'mrkdwn' as const,
          text: `*${key}:*\n${String(value)}`,
        }))

      blocks.push({
        type: 'section',
        fields,
      })
    }

    // アクションボタン
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '管理画面を開く',
            emoji: true,
          },
          url: adminDashboardUrl,
          action_id: 'open_admin_dashboard',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'アラート一覧',
            emoji: true,
          },
          url: `${adminDashboardUrl}/alerts`,
          action_id: 'open_alerts',
        },
      ],
    })

    // 重要度に応じた色のアタッチメントで送信
    const channel = this.getChannelForSeverity(severity)
    const fallbackText = `[${severity.toUpperCase()}] ${title}: ${message}`

    if (!this.webhookUrl) {
      console.warn('[SlackNotifier] SLACK_WEBHOOK_URL が未設定 — 通知をスキップします')
      return false
    }

    try {
      const payload = {
        channel,
        text: fallbackText,
        attachments: [
          {
            color,
            blocks,
            fallback: fallbackText,
          },
        ],
      }

      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[SlackNotifier] アラート送信失敗: ${response.status} ${errorText}`)
        return false
      }

      console.log(`[SlackNotifier] アラート送信成功: [${severity}] ${title}`)
      return true
    } catch (err) {
      console.error('[SlackNotifier] アラート送信エラー:', err instanceof Error ? err.message : err)
      return false
    }
  }

  /**
   * 重要度に応じたチャンネル名を返す
   */
  private getChannelForSeverity(severity: AlertLevel): string {
    const channels: Record<AlertLevel, string> = {
      critical: process.env.SLACK_CHANNEL_CRITICAL ?? '#alerts-critical',
      warning: process.env.SLACK_CHANNEL_WARNING ?? '#alerts-warning',
      info: process.env.SLACK_CHANNEL_INFO ?? '#alerts-info',
    }
    return channels[severity]
  }
}
