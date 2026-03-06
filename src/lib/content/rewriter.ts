/**
 * 記事リライトエンジン
 * 既存記事を Claude Sonnet 4.6 で改善リライトするパイプライン
 *
 * 1. 既存記事 + リライト理由を受け取る
 * 2. generateRewritePrompt() でプロンプトを生成
 * 3. Claude API に送信
 * 4. レスポンスをパース（JSON / Markdownフォールバック）
 * 5. ComplianceChecker でチェック + 自動修正
 * 6. 修正済み記事データを返却
 *
 * 薬機法第66条・67条 / 景表法 / ステマ規制 準拠
 */

import { createArticleGenerationClient, type ClaudeClient } from '@/lib/ai/client'
import { ComplianceChecker } from '@/lib/compliance/checker'
import { insertPRDisclosure } from '@/lib/compliance/templates/pr-disclosure'
import {
  generateRewritePrompt,
  getRewriteReasonLabel,
  type RewriteReason,
  type RewritePromptOptions,
} from '@/lib/content/rewrite-prompts'
import { calculateReadingTime } from '@/lib/content/utils/reading-time'
import type {
  Article,
  ArticleSection,
  ContentCategory,
  HeadingLevel,
} from '@/types/content'
import type { ComplianceResult } from '@/lib/compliance/types'

// ============================================================
// 定数
// ============================================================

/** コンプライアンス合格ラインのスコア */
const COMPLIANCE_PASS_SCORE = 95

// ============================================================
// 型定義
// ============================================================

/** リライトリクエスト */
export interface RewriteRequest {
  /** 対象記事 */
  article: Article
  /** リライト理由 */
  reason: RewriteReason
  /** リライトオプション（ターゲットKW、違反箇所等） */
  options?: RewritePromptOptions
}

/** リライト結果 */
export interface RewriteResult {
  /** リライト後の記事 */
  article: Article
  /** コンプライアンスチェック結果 */
  compliance: ComplianceResult
  /** 元の記事ID（バックアップ参照用） */
  originalArticleId: string | undefined
  /** 元の記事スラッグ */
  originalSlug: string
  /** リライト理由 */
  reason: RewriteReason
  /** 変更点サマリー */
  changes: string[]
  /** 使用したモデル */
  model: string
  /** リライト日時（ISO 8601） */
  rewrittenAt: string
  /** 処理時間（ms） */
  processingTimeMs: number
}

/** Claude API リライトレスポンスの中間型 */
interface RawRewriteJSON {
  title?: string
  lead?: string
  sections?: Array<{
    heading?: string
    level?: string
    content?: string
    subsections?: Array<{
      heading?: string
      level?: string
      content?: string
    }>
  }>
  tags?: string[]
  changes?: string[]
}

// ============================================================
// レスポンスパーサー
// ============================================================

/**
 * Claude API リライトレスポンスのJSONをパースする
 * generator.ts の parseArticleResponse パターンを踏襲
 */
function parseRewriteResponse(
  content: string,
  originalArticle: Article,
  now: string
): { article: Partial<Article>; changes: string[] } {
  // JSONコードブロックを抽出
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/)
  let jsonStr = jsonMatch ? jsonMatch[1] : content

  let raw: RawRewriteJSON
  try {
    raw = JSON.parse(jsonStr) as RawRewriteJSON
  } catch {
    // 2回目の試行: コンテンツ内の最初の { ... } ブロックを抽出
    console.warn('[ArticleRewriter] First JSON parse failed. Trying to extract JSON object...')
    const braceStart = content.indexOf('{')
    const braceEnd = content.lastIndexOf('}')
    if (braceStart >= 0 && braceEnd > braceStart) {
      jsonStr = content.slice(braceStart, braceEnd + 1)
      try {
        raw = JSON.parse(jsonStr) as RawRewriteJSON
        console.info('[ArticleRewriter] Successfully extracted JSON from response.')
      } catch {
        // 3回目の試行: Markdownとして解釈
        console.warn('[ArticleRewriter] All JSON parse attempts failed. Treating as Markdown.')
        raw = parseAsMarkdown(content, originalArticle)
      }
    } else {
      console.warn('[ArticleRewriter] No JSON object found. Treating as plain text.')
      raw = parseAsMarkdown(content, originalArticle)
    }
  }

  // セクション変換
  const sections: ArticleSection[] = (raw.sections ?? []).map((s) => ({
    heading: s.heading ?? '',
    level: (['h2', 'h3', 'h4'].includes(s.level ?? '') ? s.level : 'h2') as HeadingLevel,
    content: s.content ?? '',
    subsections: s.subsections?.map((sub) => ({
      heading: sub.heading ?? '',
      level: (['h2', 'h3', 'h4'].includes(sub.level ?? '') ? sub.level : 'h3') as HeadingLevel,
      content: sub.content ?? '',
    })),
  }))

  // フルコンテンツ組み立て
  const fullContent = sections
    .map(
      (s) =>
        `## ${s.heading}\n\n${s.content}${
          s.subsections
            ? '\n\n' +
              s.subsections
                .map((sub) => `### ${sub.heading}\n\n${sub.content}`)
                .join('\n\n')
            : ''
        }`
    )
    .join('\n\n')

  const readingTime = calculateReadingTime(fullContent)

  return {
    article: {
      title: raw.title ?? originalArticle.title,
      lead: raw.lead ?? originalArticle.lead,
      content: fullContent || originalArticle.content,
      sections: sections.length > 0 ? sections : originalArticle.sections,
      tags: raw.tags ?? originalArticle.tags,
      readingTime: readingTime.minutes,
      updatedAt: now,
    },
    changes: raw.changes ?? [],
  }
}

/**
 * Markdown テキストを RawRewriteJSON に変換するフォールバック
 */
function parseAsMarkdown(content: string, originalArticle: Article): RawRewriteJSON {
  const lines = content.split('\n')
  const sections: RawRewriteJSON['sections'] = []
  let currentSection: { heading: string; level: string; content: string } | null = null

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(.+)/)
    const h3Match = line.match(/^###\s+(.+)/)
    if (h2Match) {
      if (currentSection) sections.push(currentSection)
      currentSection = { heading: h2Match[1], level: 'h2', content: '' }
    } else if (h3Match && currentSection) {
      currentSection.content += `\n### ${h3Match[1]}`
    } else if (currentSection && line.trim()) {
      currentSection.content += `\n${line.trim()}`
    }
  }
  if (currentSection) sections.push(currentSection)

  return {
    title: originalArticle.title,
    lead: originalArticle.lead,
    sections: sections.length > 0 ? sections : undefined,
    tags: originalArticle.tags,
    changes: ['Markdownフォールバックパースのため変更点不明'],
  }
}

// ============================================================
// ダミーリライト記事生成（dry-run用）
// ============================================================

/**
 * ANTHROPIC_API_KEY 未設定時のダミーリライト結果を生成する
 */
function generateDummyRewrite(
  article: Article,
  reason: RewriteReason,
  now: string
): { article: Partial<Article>; changes: string[] } {
  const reasonLabel = getRewriteReasonLabel(reason)

  return {
    article: {
      title: `[リライト済] ${article.title}`,
      lead: `※ ダミーリライト（${reasonLabel}）。ANTHROPIC_API_KEY を設定すると実際のリライトが行われます。\n\n${article.lead}`,
      content: article.content,
      sections: article.sections,
      tags: article.tags,
      updatedAt: now,
    },
    changes: [
      `ダミーリライト（${reasonLabel}）: ANTHROPIC_API_KEY 未設定のため実行されませんでした`,
    ],
  }
}

// ============================================================
// ArticleRewriter クラス
// ============================================================

/**
 * 記事リライトエンジン
 *
 * @example
 * ```ts
 * const rewriter = new ArticleRewriter();
 * const result = await rewriter.rewrite({
 *   article: existingArticle,
 *   reason: 'seo_improvement',
 *   options: { targetKeywords: ['AGA 費用', 'AGA オンライン'] },
 * });
 * console.log(result.article.title);
 * console.log(result.compliance.score); // 95以上で合格
 * console.log(result.changes);          // ["見出しにキーワードを追加", ...]
 * ```
 */
export class ArticleRewriter {
  private readonly aiClient: ClaudeClient
  private readonly checker: ComplianceChecker

  constructor() {
    this.aiClient = createArticleGenerationClient()
    this.checker = new ComplianceChecker({ autoFix: false, strictMode: false })
  }

  /**
   * 記事をリライトする
   *
   * @param request リライトリクエスト（記事、理由、オプション）
   * @returns リライト結果
   */
  async rewrite(request: RewriteRequest): Promise<RewriteResult> {
    const startTime = Date.now()
    const now = new Date().toISOString()
    const { article, reason, options } = request
    const reasonLabel = getRewriteReasonLabel(reason)

    console.info(
      `[ArticleRewriter] Rewriting article: "${article.title}" (reason: ${reasonLabel})`
    )

    // ----------------------------------------------------------------
    // ANTHROPIC_API_KEY 未設定時: ダミーリライトを返す
    // ----------------------------------------------------------------
    if (this.aiClient.isDryRun) {
      console.info('[ArticleRewriter] Dry-run mode: returning dummy rewrite.')
      const dummy = generateDummyRewrite(article, reason, now)
      const rewrittenArticle = this.mergeArticle(article, dummy.article, now)

      const complianceResult = this.runComplianceCheck(rewrittenArticle)
      rewrittenArticle.isCompliant = complianceResult.isCompliant
      rewrittenArticle.complianceScore = complianceResult.score
      rewrittenArticle.hasPRDisclosure = complianceResult.hasPRDisclosure

      return {
        article: rewrittenArticle,
        compliance: complianceResult,
        originalArticleId: article.id,
        originalSlug: article.slug,
        reason,
        changes: dummy.changes,
        model: 'dry-run (no API key)',
        rewrittenAt: now,
        processingTimeMs: Date.now() - startTime,
      }
    }

    // ----------------------------------------------------------------
    // 1. リライトプロンプト生成
    // ----------------------------------------------------------------
    const promptResult = generateRewritePrompt(article, reason, options)

    console.info(
      `[ArticleRewriter] Prompt generated (estimated tokens: ${promptResult.estimatedTokens})`
    )

    // ----------------------------------------------------------------
    // 2. Claude Sonnet 4.6 API 呼び出し
    // ----------------------------------------------------------------
    const aiResponse = await this.aiClient.generate({
      systemPrompt: promptResult.systemPrompt,
      userMessage: promptResult.userMessage,
      modelConfig: {
        maxTokens: 8192,
        temperature: 0.5, // リライトは生成より保守的に
      },
    })

    // ----------------------------------------------------------------
    // 3. レスポンスをパース
    // ----------------------------------------------------------------
    const parsed = parseRewriteResponse(aiResponse.content, article, now)
    const rewrittenArticle = this.mergeArticle(article, parsed.article, now)

    // ----------------------------------------------------------------
    // 4. 薬機法チェッカーで自動チェック
    // ----------------------------------------------------------------
    const categoryKey = this.mapCategory(article.category)
    let complianceResult = this.checker.check(rewrittenArticle.content, {
      categories: [categoryKey, 'common'],
    })

    // ----------------------------------------------------------------
    // 5. NG表現があれば自動修正
    // ----------------------------------------------------------------
    if (!complianceResult.isCompliant || !complianceResult.hasPRDisclosure) {
      console.info(
        `[ArticleRewriter] Compliance check failed (score: ${complianceResult.score}). Applying auto-fix...`
      )

      // NG表現を修正
      let fixedContent = complianceResult.fixedText

      // PR表記が未挿入なら先頭に追加
      if (!complianceResult.hasPRDisclosure) {
        fixedContent = insertPRDisclosure(fixedContent, 'affiliate_standard')
      }

      rewrittenArticle.content = fixedContent

      // 修正後の最終チェック
      complianceResult = this.checker.check(rewrittenArticle.content, {
        categories: [categoryKey, 'common'],
      })
    }

    // ----------------------------------------------------------------
    // 6. スコア95以上で合格 / 未達の場合は警告ログ
    // ----------------------------------------------------------------
    if (complianceResult.score < COMPLIANCE_PASS_SCORE) {
      console.warn(
        `[ArticleRewriter] Compliance score (${complianceResult.score}) is below threshold (${COMPLIANCE_PASS_SCORE}). Manual review required.`
      )
    } else {
      console.info(
        `[ArticleRewriter] Compliance check passed (score: ${complianceResult.score}).`
      )
    }

    // ----------------------------------------------------------------
    // 7. 記事にコンプライアンス結果を反映
    // ----------------------------------------------------------------
    rewrittenArticle.isCompliant = complianceResult.score >= COMPLIANCE_PASS_SCORE
    rewrittenArticle.complianceScore = complianceResult.score
    rewrittenArticle.hasPRDisclosure = complianceResult.hasPRDisclosure

    // ----------------------------------------------------------------
    // 8. コスト記録
    // ----------------------------------------------------------------
    this.recordRewriteCost(
      aiResponse.tokenUsage,
      aiResponse.model,
      article.id ?? null
    ).catch((err) =>
      console.error('[ArticleRewriter] Failed to record cost:', err)
    )

    const processingTimeMs = Date.now() - startTime
    console.info(
      `[ArticleRewriter] Rewrite completed in ${processingTimeMs}ms (model: ${aiResponse.model})`
    )

    return {
      article: rewrittenArticle,
      compliance: complianceResult,
      originalArticleId: article.id,
      originalSlug: article.slug,
      reason,
      changes: parsed.changes,
      model: aiResponse.model,
      rewrittenAt: now,
      processingTimeMs,
    }
  }

  // ============================================================
  // ヘルパーメソッド
  // ============================================================

  /**
   * 元の記事データとリライト結果をマージして完全な Article を返す
   * 元の記事のメタ情報（id, slug, category, author, supervisor, references 等）を保持し、
   * リライトされた内容フィールド（title, lead, content, sections, tags）を上書き
   */
  private mergeArticle(
    original: Article,
    partial: Partial<Article>,
    now: string
  ): Article {
    return {
      ...original,
      ...partial,
      // 元のメタ情報を保持
      id: original.id,
      slug: original.slug,
      category: original.category,
      author: original.author,
      supervisor: original.supervisor,
      references: original.references,
      seo: {
        ...original.seo,
        title: partial.title ?? original.seo.title,
      },
      publishedAt: original.publishedAt,
      updatedAt: now,
    }
  }

  /**
   * コンプライアンスチェックを実行する（カテゴリ自動判定）
   */
  private runComplianceCheck(article: Article): ComplianceResult {
    const categoryKey = this.mapCategory(article.category)
    return this.checker.check(article.content, {
      categories: [categoryKey, 'common'],
    })
  }

  /**
   * ContentCategory を ComplianceChecker の Category 型にマップする
   * generator.ts と同じマッピング
   */
  private mapCategory(
    category: ContentCategory
  ): 'aga' | 'hair_removal' | 'skincare' | 'ed' | 'column' {
    const map: Record<
      ContentCategory,
      'aga' | 'hair_removal' | 'skincare' | 'ed' | 'column'
    > = {
      aga: 'aga',
      'hair-removal': 'hair_removal',
      skincare: 'skincare',
      ed: 'ed',
      column: 'column',
    }
    return map[category]
  }

  /**
   * リライトコストを CostTracker に記録する（動的インポート）
   */
  private async recordRewriteCost(
    tokenUsage: {
      inputTokens: number
      outputTokens: number
      estimatedCostUsd?: number
    },
    model: string,
    articleId: string | null
  ): Promise<void> {
    try {
      const { CostTracker } = await import('@/lib/batch/cost-tracker')
      const tracker = new CostTracker()
      await tracker.recordCost({
        articleId,
        costType: 'article_generation',
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        costUsd: tokenUsage.estimatedCostUsd ?? 0,
        model,
      })
    } catch (err) {
      console.error('[ArticleRewriter] CostTracker error:', err)
    }
  }
}
