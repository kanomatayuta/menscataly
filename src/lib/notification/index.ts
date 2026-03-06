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
// Email通知
// ============================================================

/**
 * メール通知の設定状態を確認する
 *
 * メール通知を有効にするには、以下の環境変数を設定してください:
 *   - ALERT_EMAIL_TO: 通知先メールアドレス
 *   - SENDGRID_API_KEY: SendGrid APIキー (SendGrid利用時)
 *   または
 *   - SMTP_HOST: SMTPサーバーホスト (SMTP利用時)
 *   - SMTP_PORT: SMTPサーバーポート
 *   - SMTP_USER: SMTP認証ユーザー
 *   - SMTP_PASS: SMTP認証パスワード
 */
function isEmailConfigured(): { configured: boolean; reason: string } {
  const emailTo = process.env.ALERT_EMAIL_TO
  if (!emailTo) {
    return { configured: false, reason: 'ALERT_EMAIL_TO が未設定' }
  }

  const hasSendGrid = !!process.env.SENDGRID_API_KEY
  const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER)

  if (!hasSendGrid && !hasSmtp) {
    return {
      configured: false,
      reason: 'メール送信サービスが未設定 (SENDGRID_API_KEY または SMTP_HOST/SMTP_USER が必要)',
    }
  }

  return { configured: true, reason: '' }
}

/**
 * メール通知を送信する
 *
 * 現在はメール送信サービス (SendGrid / SES / SMTP) が未実装のため、
 * 環境変数の設定状況に応じて適切なログを出力し false を返す。
 *
 * メール通知を有効にするには、以下の環境変数を設定してください:
 *   - ALERT_EMAIL_TO: 通知先メールアドレス (必須)
 *   - SENDGRID_API_KEY: SendGrid APIキー
 *   または SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 */
async function sendEmailNotification(payload: NotificationPayload): Promise<boolean> {
  const { configured, reason } = isEmailConfigured()

  if (!configured) {
    console.warn(
      `[NotificationRouter] メール通知は無効です: ${reason}。` +
      `対象: [${payload.severity}] ${payload.title}`
    )
    return false
  }

  // メール送信サービスが設定されているが、実際の送信ロジックは未実装
  // SendGrid / Amazon SES / SMTP クライアントをここに実装する
  console.warn(
    '[NotificationRouter] メール送信サービスのクライアント実装が必要です。' +
    `環境変数は設定済みですが、送信ロジックが未実装のため送信できません。` +
    `対象: to=${process.env.ALERT_EMAIL_TO}, subject=[${payload.severity}] ${payload.title}`
  )
  return false
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
