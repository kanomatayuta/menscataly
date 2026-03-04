/**
 * 通知ルーター
 * 重要度に応じて通知先を振り分ける
 * critical → Slack + Email（プレースホルダー）
 * warning  → Slack
 * info     → Slack（低優先度チャンネル）
 */

import type { AlertLevel } from '@/types/admin'
import { SlackNotifier } from './slack'

// ============================================================
// 通知ペイロード型定義
// ============================================================

export interface NotificationPayload {
  /** アラート重要度 */
  severity: AlertLevel
  /** 通知タイトル */
  title: string
  /** 通知メッセージ本文 */
  message: string
  /** 追加メタデータ */
  metadata?: Record<string, unknown>
}

// ============================================================
// Email通知プレースホルダー
// ============================================================

/**
 * メール通知を送信する（プレースホルダー実装）
 * 将来的に SendGrid / SES 等のメールサービスと連携する
 */
async function sendEmailNotification(payload: NotificationPayload): Promise<boolean> {
  const emailTo = process.env.ALERT_EMAIL_TO
  if (!emailTo) {
    console.info('[NotificationRouter] ALERT_EMAIL_TO が未設定 — メール通知をスキップします')
    return false
  }

  // TODO: SendGrid / Amazon SES 連携を実装
  console.log(
    `[NotificationRouter] メール通知（プレースホルダー）: to=${emailTo}, subject=[${payload.severity}] ${payload.title}`
  )
  return true
}

// ============================================================
// NotificationRouter クラス
// ============================================================

export class NotificationRouter {
  private slack: SlackNotifier

  constructor() {
    this.slack = new SlackNotifier()
  }

  /**
   * 重要度に応じて通知を振り分ける
   *
   * - critical: Slack + Email
   * - warning:  Slack
   * - info:     Slack（低優先度チャンネル）
   *
   * @param payload 通知ペイロード
   * @returns 少なくとも1つの通知先に成功した場合 true
   */
  async notify(payload: NotificationPayload): Promise<boolean> {
    const { severity, title, message, metadata } = payload
    const results: boolean[] = []

    console.log(`[NotificationRouter] 通知を送信: [${severity}] ${title}`)

    switch (severity) {
      case 'critical': {
        // Slack + Email
        const slackResult = await this.slack.sendAlert(severity, title, message, metadata)
        results.push(slackResult)

        const emailResult = await sendEmailNotification(payload)
        results.push(emailResult)
        break
      }

      case 'warning': {
        // Slack のみ
        const slackResult = await this.slack.sendAlert(severity, title, message, metadata)
        results.push(slackResult)
        break
      }

      case 'info': {
        // Slack（低優先度チャンネル）
        const slackResult = await this.slack.sendAlert(severity, title, message, metadata)
        results.push(slackResult)
        break
      }

      default: {
        console.warn(`[NotificationRouter] 未知の重要度: ${severity}`)
        return false
      }
    }

    const anySuccess = results.some((r) => r)
    if (!anySuccess) {
      console.warn(`[NotificationRouter] 全ての通知先への送信が失敗しました: [${severity}] ${title}`)
    }

    return anySuccess
  }

  /**
   * 日次レポートを送信する
   * @param report レポートデータ
   */
  async sendDailyReport(report: {
    totalArticles: number
    publishedToday: number
    avgComplianceScore: number
    activeAlerts: number
    revenue30d: number
  }): Promise<boolean> {
    const message = [
      '*MENS CATALY 日次レポート*',
      '',
      `・記事総数: ${report.totalArticles}`,
      `・本日公開: ${report.publishedToday}`,
      `・平均コンプライアンススコア: ${report.avgComplianceScore}%`,
      `・アクティブアラート: ${report.activeAlerts}件`,
      `・30日間収益: ¥${report.revenue30d.toLocaleString()}`,
    ].join('\n')

    return this.slack.sendAlert('info', '日次レポート', message)
  }
}
