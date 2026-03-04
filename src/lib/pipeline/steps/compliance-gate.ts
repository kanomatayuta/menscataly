/**
 * コンプライアンスゲート パイプラインステップ
 * 記事公開前の薬機法・景表法・ステマ規制チェック
 *
 * スコア閾値:
 *   95+ → 自動公開 (auto-publish)
 *   85-94 → 条件付き (E-E-A-T チェック通過で公開)
 *   70-84 → レビューキュー (手動レビュー待ち)
 *   70未満 → 拒否 (reject) + アラート通知
 *
 * Phase 3b: キュー永続化 — 判定結果を article_review_queue テーブルに保存
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

/**
 * コンプライアンスキューエントリ
 * 判定結果を article_review_queue テーブルに永続化する際のデータ型
 */
export interface ComplianceQueueEntry {
  /** 記事スラッグ（一意キー） */
  slug: string
  /** 記事タイトル */
  title: string
  /** カテゴリ */
  category: string
  /** コンプライアンス判定 */
  decision: ComplianceDecision
  /** コンプライアンススコア */
  complianceScore: number
  /** E-E-A-T スコア */
  eeatScore?: number
  /** 違反件数 */
  violationCount: number
  /** パイプライン実行ID */
  runId: string
  /** 判定理由 */
  reason: string
  /** 記事データ（リトライ用） */
  articleData: GeneratedArticleData
  /** キューステータス (pending=publish待ち, completed=publish済, failed=publish失敗) */
  queueStatus: 'pending' | 'completed' | 'failed'
  /** リトライ回数 */
  retryCount: number
  /** 永続化日時 */
  createdAt: string
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
  /** 永続化されたキューエントリ */
  queueEntries: ComplianceQueueEntry[]
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
// キュー永続化ヘルパー
// ============================================================

/**
 * コンプライアンスキューエントリを Supabase article_review_queue テーブルに永続化する
 * Supabase 未設定時はインメモリログのみ
 */
async function persistQueueEntry(entry: ComplianceQueueEntry): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.info(`[compliance-gate] Supabase not configured — queue entry logged in memory: ${entry.slug} (${entry.decision})`)
    return
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    // article_review_queue テーブルへの upsert（slug で重複排除）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('article_review_queue')
      .upsert(
        {
          title: entry.title,
          slug: entry.slug,
          category: entry.category,
          compliance_score: entry.complianceScore,
          status: entry.decision === 'reject' ? 'rejected' : 'pending',
          author_name: entry.articleData.authorName || 'MENS CATALY 編集部',
          review_notes: JSON.stringify({
            decision: entry.decision,
            reason: entry.reason,
            eeatScore: entry.eeatScore,
            violationCount: entry.violationCount,
            runId: entry.runId,
            queueStatus: entry.queueStatus,
            retryCount: entry.retryCount,
          }),
        },
        { onConflict: 'slug' }
      )

    if (error) {
      console.error(`[compliance-gate] Failed to persist queue entry for ${entry.slug}:`, error.message)
    } else {
      console.log(`[compliance-gate] Persisted queue entry: ${entry.slug} (${entry.decision})`)
    }
  } catch (err) {
    // 永続化失敗はパイプライン全体を止めない
    console.error(`[compliance-gate] Queue persistence error for ${entry.slug}:`, err)
  }
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * コンプライアンスゲート パイプラインステップ
 * 記事コンテンツの薬機法・景表法チェックを実行し、公開可否を判定する
 * Phase 3b: 判定結果を article_review_queue テーブルに永続化
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
    const queueEntries: ComplianceQueueEntry[] = []
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

      // キューエントリを生成（全判定結果を永続化）
      const queueEntry: ComplianceQueueEntry = {
        slug: article.slug,
        title: article.title,
        category: article.category,
        decision,
        complianceScore,
        eeatScore,
        violationCount: result.violations.length,
        runId: context.runId,
        reason,
        articleData: {
          ...article,
          content: result.fixedText,
          complianceScore,
        },
        queueStatus: 'pending',
        retryCount: 0,
        createdAt: new Date().toISOString(),
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

      // キューエントリを永続化
      await persistQueueEntry(queueEntry)
      queueEntries.push(queueEntry)
    }

    const output: ComplianceGateOutput = {
      articles: passedArticles,
      results: gateResults,
      reviewQueueCount,
      rejectedCount,
      queueEntries,
    }

    // コンテキストの共有データに保存
    context.sharedData['complianceGateResults'] = gateResults
    context.sharedData['complianceQueueEntries'] = queueEntries

    console.log(
      `[compliance-gate] 完了: ${passedArticles.length}件公開可, ${reviewQueueCount}件レビュー待ち, ${rejectedCount}件拒否, ${queueEntries.length}件キュー永続化`
    )

    return output
  },
}

/**
 * キューエントリのステータスを更新する（publish成功/失敗時に呼び出し）
 */
export async function updateQueueEntryStatus(
  slug: string,
  status: 'completed' | 'failed',
  retryCount?: number
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.info(`[compliance-gate] Supabase not configured — skipping queue status update for ${slug}`)
    return
  }

  try {
    const { createServerSupabaseClient } = await import('@/lib/supabase/client')
    const supabase = createServerSupabaseClient()

    const updateData: Record<string, unknown> = {
      status: status === 'completed' ? 'approved' : 'pending',
    }

    if (status === 'completed') {
      updateData.reviewed_at = new Date().toISOString()
      updateData.reviewed_by = 'pipeline-auto'
    }

    if (retryCount !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('article_review_queue')
        .select('review_notes')
        .eq('slug', slug)
        .single()

      if (existing?.review_notes) {
        try {
          const notes = JSON.parse(existing.review_notes as string)
          notes.retryCount = retryCount
          notes.queueStatus = status
          updateData.review_notes = JSON.stringify(notes)
        } catch {
          // JSON parse failure — skip notes update
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('article_review_queue')
      .update(updateData)
      .eq('slug', slug)

    if (error) {
      console.error(`[compliance-gate] Failed to update queue status for ${slug}:`, error.message)
    }
  } catch (err) {
    console.error(`[compliance-gate] Queue status update error for ${slug}:`, err)
  }
}
