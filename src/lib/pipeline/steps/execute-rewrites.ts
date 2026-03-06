/**
 * 記事リライト実行ステップ
 * PDCA パイプラインの一部として、改善候補記事を ArticleRewriter で自動リライトする
 *
 * 1. コンテキストの sharedData から改善候補を取得
 * 2. 各候補について microCMS から記事を取得
 * 3. ヘルススコアのサブスコアからリライト理由を決定
 * 4. ArticleRewriter.rewrite() でリライト実行
 * 5. コンプライアンス合格なら ArticlePublisher で microCMS 更新
 * 6. 結果をログ出力
 *
 * maxRewrites: デフォルト 2（コスト管理のため）
 */

import type { PipelineContext, PipelineStep } from '../types'
import type { RewriteReason } from '@/lib/content/rewrite-prompts'
import type { HealthScore } from '@/lib/content/health-score'
import type { RewriteResult } from '@/lib/content/rewriter'
import type { Article, ContentCategory } from '@/types/content'
import type { MicroCMSArticle } from '@/types/microcms'

// ============================================================
// 型定義
// ============================================================

/** 改善候補（ArticlePlanner や前のステップから渡される） */
export interface RewriteCandidate {
  /** microCMS 記事ID */
  articleId: string
  /** 記事タイトル */
  title: string
  /** 改善理由 */
  reason: string
  /** ヘルススコア */
  healthScore: HealthScore
  /** 推奨アクション */
  recommendedActions: string[]
}

/** ステップ実行結果 */
export interface ExecuteRewritesOutput {
  /** リライト成功件数 */
  rewrittenCount: number
  /** スキップ件数 */
  skippedCount: number
  /** 失敗件数 */
  failedCount: number
  /** 個別結果 */
  results: RewriteStepResult[]
}

/** 個別リライト結果 */
interface RewriteStepResult {
  articleId: string
  title: string
  reason: RewriteReason
  status: 'success' | 'skipped' | 'failed'
  complianceScore?: number
  updatedInMicroCMS: boolean
  error?: string
}

// ============================================================
// コンプライアンス合格閾値
// ============================================================

const COMPLIANCE_PASS_SCORE = 95

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * ヘルススコアのサブスコアからリライト理由を決定する
 *
 * - SEOスコアが最も低い → seo_improvement
 * - UXスコアが最も低い → eeat_enhancement (コンテンツ品質改善)
 * - 収益スコアが最も低い → internal_linking (内部リンクで回遊性向上)
 * - recommendedActions にコンプライアンス関連がある → compliance_fix
 * - デフォルト → content_update
 */
function determineRewriteReason(
  healthScore: HealthScore,
  recommendedActions: string[]
): RewriteReason {
  // コンプライアンス関連のアクションがある場合
  const hasComplianceAction = recommendedActions.some(
    (action) =>
      action.includes('コンプライアンス') ||
      action.includes('薬機法') ||
      action.includes('PR表記') ||
      action.includes('NG表現')
  )
  if (hasComplianceAction) {
    return 'compliance_fix'
  }

  const { seoScore, uxScore, revenueScore } = healthScore

  // 最も低いサブスコアに基づいてリライト理由を決定
  // SEOスコアの最大値: 40, UXスコアの最大値: 30, 収益スコアの最大値: 30
  // 正規化して比較
  const normalizedSeo = seoScore / 40
  const normalizedUx = uxScore / 30
  const normalizedRevenue = revenueScore / 30

  const minScore = Math.min(normalizedSeo, normalizedUx, normalizedRevenue)

  if (minScore === normalizedSeo) {
    return 'seo_improvement'
  }
  if (minScore === normalizedUx) {
    return 'eeat_enhancement'
  }
  if (minScore === normalizedRevenue) {
    return 'internal_linking'
  }

  return 'content_update'
}

/**
 * microCMS の記事データを Article 型に変換する
 */
function microCMSArticleToArticle(mcArticle: MicroCMSArticle): Article {
  // HTMLコンテンツからセクションを簡易抽出
  const sections = extractSectionsFromHTML(mcArticle.content)

  const category = (mcArticle.category?.slug ?? 'column') as ContentCategory

  return {
    id: mcArticle.id,
    title: mcArticle.title,
    slug: mcArticle.slug ?? mcArticle.id,
    lead: mcArticle.excerpt ?? '',
    content: mcArticle.content,
    sections,
    category,
    seo: {
      title: mcArticle.seo_title ?? mcArticle.title,
      description: mcArticle.seo_description ?? mcArticle.excerpt ?? '',
      keywords: mcArticle.target_keyword ? [mcArticle.target_keyword] : [],
    },
    author: {
      name: mcArticle.author_name ?? 'MENS CATALY 編集部',
      credentials: 'メンズ医療・美容メディア編集スタッフ',
      bio: '男性向け医療・美容情報を専門に扱うメディア編集部。',
    },
    supervisor: mcArticle.supervisor_name
      ? {
          name: mcArticle.supervisor_name,
          credentials: mcArticle.supervisor_creds ?? '',
          bio: mcArticle.supervisor_bio ?? '',
        }
      : undefined,
    references: (mcArticle.references ?? []).map((ref) => ({
      title: ref.ref_title ?? '',
      url: ref.ref_url ?? '',
      author: ref.ref_publisher,
      source: ref.ref_publisher,
    })),
    publishedAt: mcArticle.publishedAt,
    updatedAt: mcArticle.updatedAt,
    readingTime: mcArticle.reading_time,
    tags: mcArticle.tags?.map((t) => t.name) ?? [],
    hasPRDisclosure: mcArticle.is_pr ?? false,
    isCompliant: (mcArticle.compliance_score ?? 0) >= COMPLIANCE_PASS_SCORE,
    complianceScore: mcArticle.compliance_score,
  }
}

/**
 * HTML コンテンツからセクションを簡易抽出する
 */
function extractSectionsFromHTML(html: string): Article['sections'] {
  const sections: Article['sections'] = []
  // h2/h3 タグを簡易抽出
  const headingRegex = /<(h[2-4])>(.*?)<\/\1>/g
  let match: RegExpExecArray | null
  let currentH2: (typeof sections)[number] | null = null

  // 各タグとその後のコンテンツを抽出
  const parts: Array<{ level: string; heading: string; content: string }> = []
  let lastIndex = 0

  while ((match = headingRegex.exec(html)) !== null) {
    if (parts.length > 0) {
      // 前のパートにコンテンツを設定
      const contentSlice = html.slice(lastIndex, match.index)
      parts[parts.length - 1].content = stripHTMLTags(contentSlice)
    }
    parts.push({
      level: match[1],
      heading: stripHTMLTags(match[2]),
      content: '',
    })
    lastIndex = match.index + match[0].length
  }
  // 最後のパートにコンテンツを設定
  if (parts.length > 0) {
    parts[parts.length - 1].content = stripHTMLTags(html.slice(lastIndex))
  }

  for (const part of parts) {
    if (part.level === 'h2') {
      if (currentH2) sections.push(currentH2)
      currentH2 = {
        heading: part.heading,
        level: 'h2',
        content: part.content,
        subsections: [],
      }
    } else if ((part.level === 'h3' || part.level === 'h4') && currentH2) {
      currentH2.subsections = currentH2.subsections ?? []
      currentH2.subsections.push({
        heading: part.heading,
        level: part.level as 'h3' | 'h4',
        content: part.content,
      })
    }
  }
  if (currentH2) sections.push(currentH2)

  return sections
}

/**
 * HTML タグを除去する
 */
function stripHTMLTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

// ============================================================
// パイプラインステップ
// ============================================================

/**
 * 記事リライト実行ステップ
 *
 * context.sharedData['improvementCandidates'] から改善候補を取得し、
 * 各記事をリライト → コンプライアンスチェック → microCMS 更新を行う。
 *
 * context.sharedData['maxRewrites'] で上限を指定可能（デフォルト: 2）
 */
export const executeRewritesStep: PipelineStep<unknown, ExecuteRewritesOutput> = {
  name: 'execute-rewrites',
  description: '改善候補記事を AI でリライトし、コンプライアンスチェック後に microCMS を更新する',
  maxRetries: 1, // リライトは高コストなのでリトライは1回まで

  async execute(
    _input: unknown,
    context: PipelineContext
  ): Promise<ExecuteRewritesOutput> {
    console.log(`[execute-rewrites] Starting rewrite execution (run: ${context.runId})`)

    // ----------------------------------------------------------------
    // 1. 改善候補を取得
    // ----------------------------------------------------------------
    const candidates = (context.sharedData['improvementCandidates'] ?? []) as RewriteCandidate[]
    const maxRewrites = (context.sharedData['maxRewrites'] as number) ?? 2

    if (candidates.length === 0) {
      console.log('[execute-rewrites] No improvement candidates found. Skipping.')
      return {
        rewrittenCount: 0,
        skippedCount: 0,
        failedCount: 0,
        results: [],
      }
    }

    console.log(
      `[execute-rewrites] Found ${candidates.length} candidates, processing up to ${maxRewrites}`
    )

    // 上限を適用
    const targetCandidates = candidates.slice(0, maxRewrites)

    // ----------------------------------------------------------------
    // 2. 動的インポート（ツリーシェイキング対応）
    // ----------------------------------------------------------------
    const { ArticleRewriter } = await import('@/lib/content/rewriter')
    const { ArticlePublisher } = await import('@/lib/content/publisher')
    const { getArticleById } = await import('@/lib/microcms/client')

    const rewriter = new ArticleRewriter()
    const publisher = new ArticlePublisher()

    const results: RewriteStepResult[] = []
    let rewrittenCount = 0
    let skippedCount = 0
    let failedCount = 0

    // ----------------------------------------------------------------
    // 3. 各候補をリライト
    // ----------------------------------------------------------------
    for (let i = 0; i < targetCandidates.length; i++) {
      const candidate = targetCandidates[i]
      const progress = `${i + 1}/${targetCandidates.length}`

      try {
        // 3a. microCMS から記事を取得
        console.log(
          `[execute-rewrites] Rewriting article ${progress}: "${candidate.title}" (id: ${candidate.articleId})`
        )

        let mcArticle: MicroCMSArticle
        try {
          mcArticle = await getArticleById(candidate.articleId)
        } catch (fetchError) {
          console.warn(
            `[execute-rewrites] Failed to fetch article "${candidate.articleId}" from microCMS:`,
            fetchError
          )
          results.push({
            articleId: candidate.articleId,
            title: candidate.title,
            reason: 'content_update',
            status: 'failed',
            updatedInMicroCMS: false,
            error: `microCMS fetch failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
          })
          failedCount++
          continue
        }

        // 3b. Article 型に変換
        const article = microCMSArticleToArticle(mcArticle)

        // 3c. リライト理由を決定
        const reason = determineRewriteReason(
          candidate.healthScore,
          candidate.recommendedActions
        )

        console.log(
          `[execute-rewrites] Rewriting article ${progress}: "${candidate.title}" (reason: ${reason})`
        )

        // 3d. リライト実行
        let rewriteResult: RewriteResult
        try {
          rewriteResult = await rewriter.rewrite({
            article,
            reason,
          })
        } catch (rewriteError) {
          console.error(
            `[execute-rewrites] Rewrite failed for "${candidate.title}":`,
            rewriteError
          )
          results.push({
            articleId: candidate.articleId,
            title: candidate.title,
            reason,
            status: 'failed',
            updatedInMicroCMS: false,
            error: `Rewrite failed: ${rewriteError instanceof Error ? rewriteError.message : String(rewriteError)}`,
          })
          failedCount++
          continue
        }

        // 3e. コンプライアンスチェック結果を確認
        if (rewriteResult.compliance.score < COMPLIANCE_PASS_SCORE) {
          console.warn(
            `[execute-rewrites] Skipping microCMS update for "${candidate.title}" ` +
              `(compliance score: ${rewriteResult.compliance.score} < ${COMPLIANCE_PASS_SCORE})`
          )
          results.push({
            articleId: candidate.articleId,
            title: candidate.title,
            reason,
            status: 'skipped',
            complianceScore: rewriteResult.compliance.score,
            updatedInMicroCMS: false,
            error: `Compliance score ${rewriteResult.compliance.score} below threshold ${COMPLIANCE_PASS_SCORE}`,
          })
          skippedCount++
          continue
        }

        // 3f. コンプライアンス合格 → microCMS 更新
        try {
          await publisher.publishToMicroCMS(rewriteResult.article, {
            status: 'published',
          })

          console.info(
            `[execute-rewrites] Successfully updated article "${candidate.title}" in microCMS ` +
              `(compliance: ${rewriteResult.compliance.score}, changes: ${rewriteResult.changes.length})`
          )

          results.push({
            articleId: candidate.articleId,
            title: candidate.title,
            reason,
            status: 'success',
            complianceScore: rewriteResult.compliance.score,
            updatedInMicroCMS: true,
          })
          rewrittenCount++
        } catch (publishError) {
          console.error(
            `[execute-rewrites] Failed to update article "${candidate.title}" in microCMS:`,
            publishError
          )
          results.push({
            articleId: candidate.articleId,
            title: candidate.title,
            reason,
            status: 'failed',
            complianceScore: rewriteResult.compliance.score,
            updatedInMicroCMS: false,
            error: `microCMS update failed: ${publishError instanceof Error ? publishError.message : String(publishError)}`,
          })
          failedCount++
        }
      } catch (unexpectedError) {
        console.error(
          `[execute-rewrites] Unexpected error for "${candidate.title}":`,
          unexpectedError
        )
        results.push({
          articleId: candidate.articleId,
          title: candidate.title,
          reason: 'content_update',
          status: 'failed',
          updatedInMicroCMS: false,
          error: `Unexpected error: ${unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError)}`,
        })
        failedCount++
      }
    }

    // ----------------------------------------------------------------
    // 4. サマリーログ
    // ----------------------------------------------------------------
    const skippedFromLimit = candidates.length - targetCandidates.length
    console.log(
      `[execute-rewrites] Completed: ${rewrittenCount} rewritten, ${skippedCount} skipped (compliance), ` +
        `${failedCount} failed, ${skippedFromLimit} skipped (maxRewrites limit)`
    )

    // コンテキストの共有データに結果を保存
    context.sharedData['rewriteResults'] = {
      rewrittenCount,
      skippedCount,
      failedCount,
      results,
    }

    return {
      rewrittenCount,
      skippedCount,
      failedCount,
      results,
    }
  },
}
