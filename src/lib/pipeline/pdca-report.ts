/**
 * PDCAパイプライン実行結果 → Slack Block Kit レポート生成
 *
 * パイプライン完了後の sharedData を読み取り、
 * ヘルススコア・パフォーマンスアラート・自動非公開・リライト・収益を
 * 1つのSlackメッセージにまとめる。
 */

import type { SlackBlock } from '@/lib/notification/slack'
import type { PipelineResult, AspRevenueData } from './types'
import type { HealthScoreStepOutput } from './steps/calculate-health-scores'
import type { AutoDepublishStepOutput } from './steps/auto-depublish'
import type {
  PerformanceAlertsStepOutput,
  ImprovementTarget,
} from './steps/performance-alerts'

// ============================================================
// 公開インターフェース
// ============================================================

export interface PDCAReportData {
  result: PipelineResult
  sharedData: Record<string, unknown>
}

// ============================================================
// ユーティリティ
// ============================================================

/** 数値をカンマ区切りにフォーマット */
function formatNumber(n: number): string {
  return n.toLocaleString('ja-JP')
}

/** 数値を小数点1桁でフォーマット */
function formatDecimal(n: number): string {
  return n.toFixed(1)
}

/** 文字列を maxLen 文字で切り詰め */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

/** ミリ秒を「Xm Ys」形式に変換 */
function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

/** 今日の日付を YYYY-MM-DD で返す */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/** reason コードを日本語ラベルに変換 */
function reasonLabel(reason: string): string {
  const map: Record<string, string> = {
    rank_drop: '順位下降',
    ctr_low: 'CTR低下',
    bounce_rate_high: '直帰率高',
    critical_health_score: 'スコア危険',
    no_pageviews: 'PVなし',
  }
  return map[reason] ?? reason
}

// ============================================================
// Slack Block ヘルパー
// ============================================================

function headerBlock(text: string): SlackBlock {
  return {
    type: 'header',
    text: { type: 'plain_text', text, emoji: true },
  }
}

function sectionBlock(mrkdwn: string): SlackBlock {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: mrkdwn },
  }
}

function dividerBlock(): SlackBlock {
  return { type: 'divider' }
}

function contextBlock(text: string): SlackBlock {
  return {
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: { type: 'mrkdwn', text } },
    ],
  }
}

// ============================================================
// セクションビルダー
// ============================================================

function buildHealthScoreSection(
  data: HealthScoreStepOutput | undefined
): SlackBlock[] {
  if (!data) {
    return [sectionBlock('*記事ヘルススコア*\nデータなし')]
  }

  const { summary } = data
  const lines = [
    '*記事ヘルススコア*',
    `> :white_check_mark: 健全: ${formatNumber(summary.healthy)}件 | :warning: 要改善: ${formatNumber(summary.needsImprovement)}件 | :red_circle: クリティカル: ${formatNumber(summary.critical)}件`,
    `> 平均スコア: ${formatDecimal(summary.averageScore)}/100`,
  ]

  return [sectionBlock(lines.join('\n'))]
}

function buildPerformanceAlertsSection(
  data: PerformanceAlertsStepOutput | undefined
): SlackBlock[] {
  if (!data) {
    return [sectionBlock('*パフォーマンスアラート*\nデータなし')]
  }

  const { targets, summary } = data
  const lines: string[] = [
    '*パフォーマンスアラート*',
    `> :chart_with_downwards_trend: 検出: ${formatNumber(summary.alertsCreated)}件 (critical: ${formatNumber(summary.criticalCount)}件, warning: ${formatNumber(summary.needsImprovementCount)}件)`,
  ]

  // critical と needs_improvement を最大5件表示
  const notable: ImprovementTarget[] = targets
    .filter((t) => t.status === 'critical' || t.status === 'needs_improvement')
    .slice(0, 5)

  if (notable.length > 0) {
    lines.push('')
    lines.push('要注意記事:')
    for (const t of notable) {
      const reasons = t.reasons.map(reasonLabel).join(', ')
      lines.push(
        `> • 「${truncate(t.title, 30)}」 — スコア${t.healthScore}/100 (${reasons})`
      )
    }
  }

  return [sectionBlock(lines.join('\n'))]
}

function buildAutoDepublishSection(
  data: AutoDepublishStepOutput | undefined
): SlackBlock[] {
  if (!data) {
    return [sectionBlock('*自動非公開*\nデータなし')]
  }

  const { result } = data
  const lines: string[] = ['*自動非公開*']

  if (result.depublishedCount === 0) {
    lines.push(`> 対象: 0件（コンプライアンス違反なし）`)
  } else {
    lines.push(
      `> 対象: ${formatNumber(result.flaggedCount)}件 | 非公開実行: ${formatNumber(result.depublishedCount)}件 | 失敗: ${formatNumber(result.failedCount)}件`
    )
    // 非公開にした記事名を列挙（最大5件）
    const depublished = result.candidates.slice(0, 5)
    for (const c of depublished) {
      lines.push(`> • 「${truncate(c.title, 30)}」 — ${c.reason}`)
    }
    if (result.candidates.length > 5) {
      lines.push(`> ...他 ${result.candidates.length - 5}件`)
    }
  }

  return [sectionBlock(lines.join('\n'))]
}

function buildRewriteSection(
  rewriteResults: unknown
): SlackBlock[] {
  const lines: string[] = ['*自動リライト*']

  if (!rewriteResults || !Array.isArray(rewriteResults) || rewriteResults.length === 0) {
    lines.push('> 実行: 0件（対象なし or 無効）')
    return [sectionBlock(lines.join('\n'))]
  }

  lines.push(`> 実行: ${formatNumber(rewriteResults.length)}件`)
  const items = rewriteResults.slice(0, 5) as Array<{ title?: string; slug?: string }>
  for (const item of items) {
    const title = item.title ?? item.slug ?? '不明'
    lines.push(`> • 「${truncate(title, 30)}」`)
  }
  if (rewriteResults.length > 5) {
    lines.push(`> ...他 ${rewriteResults.length - 5}件`)
  }

  return [sectionBlock(lines.join('\n'))]
}

function buildRevenueSection(
  aspRevenue: AspRevenueData[] | undefined
): SlackBlock[] {
  if (!aspRevenue || aspRevenue.length === 0) {
    return [sectionBlock('*ASP収益*\nデータなし')]
  }

  let totalClicks = 0
  let totalConversions = 0
  let totalRevenue = 0

  for (const item of aspRevenue) {
    totalClicks += item.clicks
    totalConversions += item.conversions
    totalRevenue += item.revenue
  }

  const lines = [
    '*ASP収益*',
    `> 本日クリック: ${formatNumber(totalClicks)}件 | 成約: ${formatNumber(totalConversions)}件 | 収益: ¥${formatNumber(totalRevenue)}`,
  ]

  return [sectionBlock(lines.join('\n'))]
}

// ============================================================
// メインエクスポート
// ============================================================

/**
 * PDCAパイプラインの実行結果からSlack用レポートを生成する
 */
export function buildPDCAReport(data: PDCAReportData): {
  text: string
  blocks: SlackBlock[]
} {
  const { result, sharedData } = data

  // sharedData から各ステップの出力を取得
  const healthScores = sharedData.healthScores as
    | HealthScoreStepOutput
    | undefined
  const performanceAlerts = sharedData.performanceAlerts as
    | PerformanceAlertsStepOutput
    | undefined
  const autoDepublish = sharedData.autoDepublish as
    | AutoDepublishStepOutput
    | undefined
  const rewriteResults = sharedData.rewriteResults as unknown
  const aspRevenue = sharedData.aspRevenue as
    | AspRevenueData[]
    | undefined

  // ステータス絵文字
  const statusEmoji =
    result.status === 'success'
      ? ':large_green_circle:'
      : result.status === 'partial'
        ? ':large_yellow_circle:'
        : ':red_circle:'

  const dateStr = todayISO()
  const fallbackText = `PDCA分析レポート — ${dateStr} [${result.status}]`

  // Block Kit 組み立て
  const blocks: SlackBlock[] = []

  // ヘッダー
  blocks.push(headerBlock(`:bar_chart: PDCA分析レポート — ${dateStr}`))
  blocks.push(dividerBlock())

  // セクション1: ヘルススコア
  blocks.push(...buildHealthScoreSection(healthScores))
  blocks.push(dividerBlock())

  // セクション2: パフォーマンスアラート
  blocks.push(...buildPerformanceAlertsSection(performanceAlerts))
  blocks.push(dividerBlock())

  // セクション3: 自動非公開
  blocks.push(...buildAutoDepublishSection(autoDepublish))
  blocks.push(dividerBlock())

  // セクション4: リライト
  blocks.push(...buildRewriteSection(rewriteResults))
  blocks.push(dividerBlock())

  // セクション5: 収益
  blocks.push(...buildRevenueSection(aspRevenue))
  blocks.push(dividerBlock())

  // フッター
  blocks.push(
    contextBlock(
      `${statusEmoji} Run ID: \`${result.runId}\` | 実行時間: ${formatDuration(result.durationMs)} | 完了: ${result.completedAt}`
    )
  )

  return { text: fallbackText, blocks }
}
