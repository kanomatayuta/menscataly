/**
 * 自動非公開ステップ (パイプラインラッパー)
 * PDCAパイプライン (23:00 JST) で実行される
 *
 * scanAndDepublish() を呼び出し、コンプライアンス違反記事を自動非公開化する
 * パイプラインのコンテキスト/ログに結果を統合する
 */

import type { PipelineContext, PipelineStep } from '../types'
import type { DepublishResult } from '@/lib/content/auto-depublish'

// ============================================================
// 型定義
// ============================================================

/** ステップ出力 */
export interface AutoDepublishStepOutput {
  result: DepublishResult
  summary: string
}

// ============================================================
// ステップ実装
// ============================================================

export const autoDepublishStep: PipelineStep<unknown, AutoDepublishStepOutput> = {
  name: 'auto-depublish',
  description: 'コンプライアンス違反記事の自動非公開化',
  maxRetries: 1,

  async execute(_input: unknown, context: PipelineContext): Promise<AutoDepublishStepOutput> {
    console.log(`[auto-depublish] Starting compliance scan and auto-depublish (run: ${context.runId})`)

    // ドライランモードはパイプラインのdryRun設定に従う
    const isDryRun = context.config.dryRun

    // scanAndDepublish を動的インポート（循環参照回避）
    const { scanAndDepublish } = await import('@/lib/content/auto-depublish')

    const result = await scanAndDepublish({
      dryRun: isDryRun,
      scoreThreshold: 70,
      maxArticlesPerBatch: 100,
      addToReviewQueue: true,
    })

    // サマリー文字列を構築
    const summary = [
      `スキャン: ${result.totalScanned}件`,
      `フラグ: ${result.flaggedCount}件`,
      `非公開: ${result.depublishedCount}件`,
      `失敗: ${result.failedCount}件`,
      `処理時間: ${result.processingTimeMs}ms`,
      isDryRun ? '(ドライラン)' : '',
    ]
      .filter(Boolean)
      .join(', ')

    console.log(`[auto-depublish] ${summary}`)

    // 共有データにフラグ記事情報を保存（後続ステップで参照可能）
    context.sharedData['depublishResult'] = result

    // 非公開にした記事があればログ
    if (result.flaggedCount > 0) {
      for (const candidate of result.candidates) {
        console.log(
          `[auto-depublish] Flagged: "${candidate.title}" (${candidate.contentId}) — ${candidate.reason}`
        )
      }
    }

    const output: AutoDepublishStepOutput = {
      result,
      summary,
    }

    return output
  },
}
