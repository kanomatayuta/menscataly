/**
 * バッチコンプライアンスレポーター
 * 複数記事のコンプライアンスチェック結果をレポート化する
 */

import type { ComplianceResult, Severity, ViolationType } from './types'

// ============================================================
// 型定義
// ============================================================

/** 単一記事のレポート */
export interface SingleArticleReport {
  title: string
  score: number
  isCompliant: boolean
  hasPRDisclosure: boolean
  violationCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  missingItems: string[]
  eeatTotal: number | null
  topViolations: Array<{ ngText: string; severity: Severity; reason: string }>
}

/** バッチレポートサマリ */
export interface BatchReportSummary {
  /** レポート生成日時 */
  generatedAt: string
  /** チェック記事数 */
  totalArticles: number
  /** 合格記事数 */
  compliantCount: number
  /** 不合格記事数 */
  nonCompliantCount: number
  /** 合格率 (%) */
  complianceRate: number
  /** 平均スコア */
  averageScore: number
  /** 全違反数 */
  totalViolations: number
  /** severity別違反数 */
  violationsBySeverity: Record<Severity, number>
  /** 違反タイプ別件数 */
  violationsByType: Array<{ type: ViolationType; count: number }>
  /** PR表記あり記事数 */
  prDisclosureCount: number
  /** E-E-A-T 平均スコア (null = 評価なし) */
  averageEeatScore: number | null
}

/** バッチレポート */
export interface BatchReport {
  summary: BatchReportSummary
  details: SingleArticleReport[]
}

// ============================================================
// レポーター
// ============================================================

/**
 * バッチコンプライアンスレポーター
 *
 * @example
 * ```ts
 * const reporter = new BatchComplianceReporter();
 *
 * const report = reporter.generateBatchReport([
 *   { title: '記事1', result: complianceResult1 },
 *   { title: '記事2', result: complianceResult2 },
 * ]);
 * const markdown = reporter.exportToMarkdown(report);
 * ```
 */
export class BatchComplianceReporter {
  /**
   * 単一記事のレポートを生成する
   * @param title 記事タイトル
   * @param result コンプライアンスチェック結果
   */
  generateSingleReport(title: string, result: ComplianceResult): SingleArticleReport {
    const highCount = result.violations.filter((v) => v.severity === 'high').length
    const mediumCount = result.violations.filter((v) => v.severity === 'medium').length
    const lowCount = result.violations.filter((v) => v.severity === 'low').length

    const topViolations = result.violations
      .filter((v) => v.ngText !== '(PR表記なし)')
      .sort((a, b) => {
        const severityOrder: Record<Severity, number> = { high: 3, medium: 2, low: 1 }
        return severityOrder[b.severity] - severityOrder[a.severity]
      })
      .slice(0, 5)
      .map((v) => ({
        ngText: v.ngText,
        severity: v.severity,
        reason: v.reason,
      }))

    return {
      title,
      score: result.score,
      isCompliant: result.isCompliant,
      hasPRDisclosure: result.hasPRDisclosure,
      violationCount: result.violations.length,
      highCount,
      mediumCount,
      lowCount,
      missingItems: [...result.missingItems],
      eeatTotal: result.eeatScore?.total ?? null,
      topViolations,
    }
  }

  /**
   * 複数記事のバッチレポートを生成する
   * @param results 記事タイトルとコンプライアンス結果のペア配列
   */
  generateBatchReport(
    results: Array<{ title: string; result: ComplianceResult }>
  ): BatchReport {
    const now = new Date().toISOString()
    const details = results.map((r) => this.generateSingleReport(r.title, r.result))

    const totalArticles = details.length
    const compliantCount = details.filter((d) => d.isCompliant).length
    const nonCompliantCount = totalArticles - compliantCount
    const complianceRate = totalArticles > 0
      ? Math.round((compliantCount / totalArticles) * 100)
      : 100

    const averageScore = totalArticles > 0
      ? Math.round(details.reduce((sum, d) => sum + d.score, 0) / totalArticles)
      : 100

    const totalViolations = details.reduce((sum, d) => sum + d.violationCount, 0)

    const violationsBySeverity: Record<Severity, number> = {
      high: details.reduce((sum, d) => sum + d.highCount, 0),
      medium: details.reduce((sum, d) => sum + d.mediumCount, 0),
      low: details.reduce((sum, d) => sum + d.lowCount, 0),
    }

    // 違反タイプ別集計
    const typeCountMap = new Map<ViolationType, number>()
    for (const r of results) {
      for (const v of r.result.violations) {
        typeCountMap.set(v.type, (typeCountMap.get(v.type) ?? 0) + 1)
      }
    }
    const violationsByType = Array.from(typeCountMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)

    const prDisclosureCount = details.filter((d) => d.hasPRDisclosure).length

    // E-E-A-T 平均スコア
    const eeatScores = details.filter((d) => d.eeatTotal !== null).map((d) => d.eeatTotal as number)
    const averageEeatScore = eeatScores.length > 0
      ? Math.round(eeatScores.reduce((sum, s) => sum + s, 0) / eeatScores.length)
      : null

    return {
      summary: {
        generatedAt: now,
        totalArticles,
        compliantCount,
        nonCompliantCount,
        complianceRate,
        averageScore,
        totalViolations,
        violationsBySeverity,
        violationsByType,
        prDisclosureCount,
        averageEeatScore,
      },
      details,
    }
  }

  /**
   * バッチレポートをMarkdown形式に変換する
   * @param report バッチレポート
   */
  exportToMarkdown(report: BatchReport): string {
    const s = report.summary
    const lines: string[] = []

    // ヘッダー
    lines.push('# コンプライアンスチェックレポート')
    lines.push('')
    lines.push(`生成日時: ${s.generatedAt}`)
    lines.push('')

    // サマリ
    lines.push('## サマリ')
    lines.push('')
    lines.push('| 項目 | 値 |')
    lines.push('|------|-----|')
    lines.push(`| チェック記事数 | ${s.totalArticles} |`)
    lines.push(`| 合格記事数 | ${s.compliantCount} |`)
    lines.push(`| 不合格記事数 | ${s.nonCompliantCount} |`)
    lines.push(`| 合格率 | ${s.complianceRate}% |`)
    lines.push(`| 平均スコア | ${s.averageScore} |`)
    lines.push(`| 違反総数 | ${s.totalViolations} |`)
    lines.push(`| PR表記あり | ${s.prDisclosureCount}/${s.totalArticles} |`)
    if (s.averageEeatScore !== null) {
      lines.push(`| E-E-A-T平均スコア | ${s.averageEeatScore}/100 |`)
    }
    lines.push('')

    // 重要度別違反
    lines.push('### 重要度別違反数')
    lines.push('')
    lines.push('| 重要度 | 件数 |')
    lines.push('|--------|------|')
    lines.push(`| High (高) | ${s.violationsBySeverity.high} |`)
    lines.push(`| Medium (中) | ${s.violationsBySeverity.medium} |`)
    lines.push(`| Low (低) | ${s.violationsBySeverity.low} |`)
    lines.push('')

    // 違反タイプ別
    if (s.violationsByType.length > 0) {
      lines.push('### 違反タイプ別件数')
      lines.push('')
      lines.push('| タイプ | 件数 |')
      lines.push('|--------|------|')
      for (const vt of s.violationsByType) {
        lines.push(`| ${this.formatViolationType(vt.type)} | ${vt.count} |`)
      }
      lines.push('')
    }

    // 各記事の詳細
    lines.push('## 記事別詳細')
    lines.push('')

    for (const detail of report.details) {
      const statusIcon = detail.isCompliant ? '[PASS]' : '[FAIL]'
      lines.push(`### ${statusIcon} ${detail.title}`)
      lines.push('')
      lines.push(`- スコア: ${detail.score}/100`)
      lines.push(`- 違反数: ${detail.violationCount} (高: ${detail.highCount}, 中: ${detail.mediumCount}, 低: ${detail.lowCount})`)
      lines.push(`- PR表記: ${detail.hasPRDisclosure ? 'あり' : 'なし'}`)
      if (detail.eeatTotal !== null) {
        lines.push(`- E-E-A-Tスコア: ${detail.eeatTotal}/100`)
      }

      if (detail.missingItems.length > 0) {
        lines.push(`- 未記載必須項目: ${detail.missingItems.join(', ')}`)
      }

      if (detail.topViolations.length > 0) {
        lines.push('')
        lines.push('主な違反:')
        for (const v of detail.topViolations) {
          lines.push(`  - [${v.severity.toUpperCase()}] "${v.ngText}" — ${v.reason}`)
        }
      }

      lines.push('')
    }

    return lines.join('\n')
  }

  /** 違反タイプを日本語表示名に変換 */
  private formatViolationType(type: ViolationType): string {
    const labels: Record<ViolationType, string> = {
      pharmaceutical_law: '薬機法',
      representation_law: '景表法',
      stealth_marketing: 'ステマ規制',
      superlative: '最大級表現',
      missing_pr_disclosure: 'PR表記欠如',
    }
    return labels[type] ?? type
  }
}
