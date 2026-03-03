/**
 * Slack通知クライアント
 * Webhook URLを使ったSlack通知の送信
 * 重要度に応じた色分け・アクションボタン対応
 */

import type { AlertSeverity } from '@/types/admin'

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

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: '#FF0000',  // 赤
  warning: '#FFA500',   // 黄色/オレンジ
  info: '#0000FF',      // 青
}

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: ':rotating_light:',
  warning: ':warning:',
  info: ':information_source:',
}

// ============================================================
// SlackNotifier クラス
// ============================================================

export class SlackNotifier {
  private webhookUrl: string | null

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl ?? process.env.SLACK_WEBHOOK_URL ?? null
  }

  /**
   * Slackメッセージを送信する
   * @param channel チャンネル名（Webhook設定で固定の場合は無視される）
   * @param text メッセージテキスト（フォールバック用）
   * @param blocks Block Kit ブロック（省略可）
   */
  async sendMessage(
    channel: string,
    text: string,
    blocks?: SlackBlock[]
  ): Promise<boolean> {
    if (!this.webhookUrl) {
      console.warn('[SlackNotifier] SLACK_WEBHOOK_URL が未設定 — 通知をスキップします')
      return false
    }

    const payload: SlackMessage = {
      channel,
      text,
      blocks,
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[SlackNotifier] 送信失敗: ${response.status} ${errorText}`)
        return false
      }

      console.log(`[SlackNotifier] メッセージ送信成功: ${channel}`)
      return true
    } catch (err) {
      // エラーをログに記録するがスローしない（通知失敗でシステムを止めない）
      console.error('[SlackNotifier] 送信エラー:', err instanceof Error ? err.message : err)
      return false
    }
  }

  /**
   * アラート通知を送信する（重要度に応じた色分け・ボタン付き）
   * @param severity アラート重要度
   * @param title アラートタイトル
   * @param message アラート本文
   * @param metadata 追加メタデータ（オプション）
   */
  async sendAlert(
    severity: AlertSeverity,
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
  private getChannelForSeverity(severity: AlertSeverity): string {
    const channels: Record<AlertSeverity, string> = {
      critical: process.env.SLACK_CHANNEL_CRITICAL ?? '#alerts-critical',
      warning: process.env.SLACK_CHANNEL_WARNING ?? '#alerts-warning',
      info: process.env.SLACK_CHANNEL_INFO ?? '#alerts-info',
    }
    return channels[severity]
  }
}
