/**
 * コンプライアンスゲート パイプラインステップ
 * 記事公開前の薬機法・景表法・ステマ規制チェック
 *
 * スコア閾値:
 *   95+ → 自動公開 (auto-publish)
 *   85-94 → 条件付き (E-E-A-T チェック通過で公開)
 *   70-84 → レビューキュー (手動レビュー待ち)
 *   70未満 → 拒否 (reject) + アラート通知
 */

import { ComplianceChecker } from '@/lib/compliance/checker'
import { AlertManager } from '@/lib/monitoring/alert-manager'
import type { PipelineContext, PipelineStep, GeneratedArticleData } from '../types'
import type { Article } from '@/types/content'

// ============================================================
// コンプライアンスゲート 結果型
// ============================================================

export type ComplianceDecision = 'auto-publish' | 'conditional' | 'review-queue' | 'reject'

export interface ComplianceGateResult {
  /** 判定結果 */
  decision: ComplianceDecision
  /** コンプライアンススコア (0-100) */
  complianceScore: number
  /** E-E-A-T スコア（conditional判定時にチェック） */
  eeatScore?: number
  /** 違反件数 */
  violationCount: number
  /** 修正済みテキスト */
  fixedContent?: string
  /** 判定理由 */
  reason: string
}

export interface ComplianceGateOutput {
  /** 公開可能な記事データ（reject以外） */
  articles: GeneratedArticleData[]
  /** 各記事のコンプライアンスゲート結果 */
  results: ComplianceGateResult[]
  /** レビューキューに追加された記事数 */
  reviewQueueCount: number
  /** 拒否された記事数 */
  rejectedCount: number
}

// ============================================================
// スコア閾値
// ============================================================

const THRESHOLDS = {
  AUTO_PUBLISH: 95,    // 自動公開
  CONDITIONAL: 85,     // 条件付き（E-E-A-T チェック）
  REVIEW_QUEUE: 70,    // レビューキュー
  // 70未満 → 拒否
} as const

/** E-E-A-T スコアの最低ラインの閾値（conditional判定時に使用） */
const EEAT_MINIMUM_SCORE = 60

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * GeneratedArticleData を ComplianceChecker.checkWithArticle() で
 * 使用する Article 型に変換する（最低限のフィールドのみ）
 */
function toArticleForEEAT(article: GeneratedArticleData): Article {
  return {
    title: article.title,
    slug: article.slug,
    lead: article.excerpt,
    content: article.content,
    sections: [],
    category: article.category as Article['category'],
    seo: {
      title: article.seoTitle,
      description: article.seoDescription,
      keywords: article.tags,
    },
    author: {
      name: article.authorName,
      credentials: '',
      bio: '',
    },
    references: [],
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hasPRDisclosure: article.isPr,
    isCompliant: article.complianceScore >= THRESHOLDS.REVIEW_QUEUE,
    complianceScore: article.complianceScore,
  }
}

/**
 * スコアに基づいて判定を決定する
 */
function determineDecision(
  complianceScore: number,
  eeatScore?: number
): { decision: ComplianceDecision; reason: string } {
  if (complianceScore >= THRESHOLDS.AUTO_PUBLISH) {
    return {
      decision: 'auto-publish',
      reason: `コンプライアンススコア ${complianceScore} ≥ ${THRESHOLDS.AUTO_PUBLISH}: 自動公開`,
    }
  }

  if (complianceScore >= THRESHOLDS.CONDITIONAL) {
    if (eeatScore !== undefined && eeatScore >= EEAT_MINIMUM_SCORE) {
      return {
        decision: 'conditional',
        reason: `コンプライアンススコア ${complianceScore} (${THRESHOLDS.CONDITIONAL}-${THRESHOLDS.AUTO_PUBLISH - 1}), E-E-A-T スコア ${eeatScore} ≥ ${EEAT_MINIMUM_SCORE}: 条件付き公開`,
      }
    }
    return {
      decision: 'review-queue',
      reason: `コンプライアンススコア ${complianceScore} (${THRESHOLDS.CONDITIONAL}-${THRESHOLDS.AUTO_PUBLISH - 1}), E-E-A-T スコア ${eeatScore ?? '未評価'} < ${EEAT_MINIMUM_SCORE}: レビューキューへ`,
    }
  }

  if (complianceScore >= THRESHOLDS.REVIEW_QUEUE) {
    return {
      decision: 'review-queue',
      reason: `コンプライアンススコア ${complianceScore} (${THRESHOLDS.REVIEW_QUEUE}-${THRESHOLDS.CONDITIONAL - 1}): レビューキューへ`,
    }
  }

  return {
    decision: 'reject',
    reason: `コンプライアンススコア ${complianceScore} < ${THRESHOLDS.REVIEW_QUEUE}: 拒否（薬機法違反の可能性）`,
  }
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * コンプライアンスゲート パイプラインステップ
 * 記事コンテンツの薬機法・景表法チェックを実行し、公開可否を判定する
 */
export const complianceGateStep: PipelineStep<GeneratedArticleData[], ComplianceGateOutput> = {
  name: 'compliance-gate',
  description: '記事コンテンツの薬機法・景表法・ステマ規制チェックを実行し、公開可否を判定する',
  maxRetries: 1,

  async execute(
    input: GeneratedArticleData[],
    context: PipelineContext
  ): Promise<ComplianceGateOutput> {
    console.log(`[compliance-gate] コンプライアンスチェック開始 (run: ${context.runId}, 記事数: ${input.length})`)

    const checker = new ComplianceChecker({ strictMode: true })
    const alertManager = new AlertManager()

    const passedArticles: GeneratedArticleData[] = []
    const gateResults: ComplianceGateResult[] = []
    let reviewQueueCount = 0
    let rejectedCount = 0

    for (const article of input) {
      console.log(`[compliance-gate] チェック中: ${article.title}`)

      // コンプライアンスチェック実行
      const articleData = toArticleForEEAT(article)
      const result = checker.checkWithArticle(article.content, articleData)

      const complianceScore = result.score
      const eeatScore = result.eeatScore?.total

      // 判定
      const { decision, reason } = determineDecision(complianceScore, eeatScore)

      const gateResult: ComplianceGateResult = {
        decision,
        complianceScore,
        eeatScore,
        violationCount: result.violations.length,
        reason,
      }

      // 判定に基づく処理
      switch (decision) {
        case 'auto-publish':
          console.log(`[compliance-gate] ✓ 自動公開: ${article.title} (スコア: ${complianceScore})`)
          // 自動修正されたテキストで上書き
          passedArticles.push({
            ...article,
            content: result.fixedText,
            complianceScore,
          })
          break

        case 'conditional':
          console.log(`[compliance-gate] △ 条件付き公開: ${article.title} (スコア: ${complianceScore}, E-E-A-T: ${eeatScore})`)
          passedArticles.push({
            ...article,
            content: result.fixedText,
            complianceScore,
          })
          break

        case 'review-queue':
          console.log(`[compliance-gate] ▽ レビューキュー: ${article.title} (スコア: ${complianceScore})`)
          reviewQueueCount++
          gateResult.fixedContent = result.fixedText

          // レビューキューアラートを作成
          await alertManager.createAlert({
            type: 'compliance_violation',
            severity: 'warning',
            title: `レビュー要求: ${article.title}`,
            message: `コンプライアンススコア ${complianceScore} — 手動レビューが必要です (違反 ${result.violations.length} 件)`,
            metadata: {
              articleSlug: article.slug,
              complianceScore,
              violationCount: result.violations.length,
              decision,
              runId: context.runId,
            },
          })
          break

        case 'reject':
          console.log(`[compliance-gate] ✗ 拒否: ${article.title} (スコア: ${complianceScore})`)
          rejectedCount++
          gateResult.fixedContent = result.fixedText

          // 拒否アラートを作成（critical）
          await alertManager.createAlert({
            type: 'compliance_violation',
            severity: 'critical',
            title: `記事拒否（薬機法違反の可能性）: ${article.title}`,
            message: `コンプライアンススコア ${complianceScore} — 自動非公開処理 (違反 ${result.violations.length} 件)`,
            metadata: {
              articleSlug: article.slug,
              complianceScore,
              violationCount: result.violations.length,
              violations: result.violations.slice(0, 5).map((v) => ({
                type: v.type,
                severity: v.severity,
                ngText: v.ngText,
                suggestedText: v.suggestedText,
              })),
              decision,
              runId: context.runId,
            },
          })
          break
      }

      gateResults.push(gateResult)
    }

    const output: ComplianceGateOutput = {
      articles: passedArticles,
      results: gateResults,
      reviewQueueCount,
      rejectedCount,
    }

    // コンテキストの共有データに保存
    context.sharedData['complianceGateResults'] = gateResults

    console.log(
      `[compliance-gate] 完了: ${passedArticles.length}件公開可, ${reviewQueueCount}件レビュー待ち, ${rejectedCount}件拒否`
    )

    return output
  },
}
