/**
 * 記事生成パイプラインステップ
 * fetch-analytics の出力（AnalyticsData[]）を受け取り、
 * ArticlePlanner でキーワード選定 → ArticleGenerator で記事生成 →
 * ASPリンク・内部リンク注入を行い、GeneratedArticleData[] を出力する。
 *
 * compliance-gate が期待する GeneratedArticleData[] 形式にブリッジする
 * 重要な中間ステップ。
 */

import { ArticlePlanner, type TrendDataInput } from '@/lib/content/article-planner'
import { ArticleGenerator } from '@/lib/content/generator'
import { enrichContentWithAffiliateLinks } from '@/lib/asp/enrich-content'
import { enrichContentWithInternalLinks } from '@/lib/content/enrich-internal-links'
import { getArticles } from '@/lib/microcms/client'
import type { ContentCategory, ContentGenerationRequest } from '@/types/content'
import type { MicroCMSArticle } from '@/types/microcms'
import type {
  AnalyticsData,
  GeneratedArticleData,
  PipelineContext,
  PipelineStep,
  TrendData,
} from '../types'

// ============================================================
// 設定
// ============================================================

/** デフォルトの最大新規記事数（コスト管理のため1件） */
const DEFAULT_MAX_NEW_ARTICLES = 1

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * パイプラインの TrendData[] を ArticlePlanner の TrendDataInput[] に変換する
 */
function toTrendDataInputs(trends: TrendData[]): TrendDataInput[] {
  return trends.map((t) => ({
    keyword: t.keyword,
    trendScore: t.relativeValue,
    isRising: t.relativeValue >= 70, // 70以上をトレンド上昇と見なす
  }))
}

/**
 * microCMS から既存記事のスラッグ一覧を取得する
 * 重複記事の生成を防ぐために使用
 */
async function fetchExistingSlugs(): Promise<Set<string>> {
  try {
    // 全記事のスラッグを取得（最大100件 — 通常はこれで十分）
    const response = await getArticles({ limit: 100 })
    const slugs = new Set<string>()
    for (const article of response.contents) {
      const slug = article.slug ?? article.id
      slugs.add(slug.toLowerCase())
    }
    return slugs
  } catch (err) {
    console.warn('[generate-articles] Failed to fetch existing articles from microCMS:', err)
    // microCMS 取得失敗時は空セットを返す（重複チェックなしで続行）
    return new Set()
  }
}

/**
 * microCMS から同カテゴリの公開済み記事を取得する（内部リンク注入用）
 */
async function fetchRelatedArticles(category: string): Promise<MicroCMSArticle[]> {
  try {
    const response = await getArticles({
      category,
      limit: 20,
    })
    return response.contents
  } catch (err) {
    console.warn(`[generate-articles] Failed to fetch related articles for category=${category}:`, err)
    return []
  }
}

/**
 * Article 型の生成結果を GeneratedArticleData 型に変換する
 */
function toGeneratedArticleData(
  article: {
    title: string
    slug: string
    content: string
    lead: string
    category: ContentCategory
    seo: { title: string; description: string; keywords: string[] }
    author: { name: string }
    tags?: string[]
    hasPRDisclosure: boolean
    complianceScore?: number
  },
  microcmsId: string | null = null
): GeneratedArticleData {
  return {
    microcmsId,
    slug: article.slug,
    title: article.title,
    content: article.content,
    excerpt: article.lead,
    category: article.category,
    seoTitle: article.seo.title,
    seoDescription: article.seo.description,
    authorName: article.author.name,
    tags: article.tags ?? [],
    isPr: article.hasPRDisclosure,
    qualityScore: article.complianceScore ?? 0,
    complianceScore: article.complianceScore ?? 0,
  }
}

// ============================================================
// ステップ実装
// ============================================================

/**
 * 記事生成パイプラインステップ
 *
 * 入力: AnalyticsData[]（fetch-analytics の出力）
 * 出力: GeneratedArticleData[]（compliance-gate の入力）
 *
 * 処理フロー:
 * 1. context.sharedData から TrendData を取得
 * 2. microCMS から既存記事スラッグを取得（重複防止）
 * 3. ArticlePlanner でキーワード選定（最大 maxNewArticles 件）
 * 4. 各キーワードに対して ArticleGenerator.generate() を実行
 * 5. ASPアフィリエイトリンクを注入
 * 6. 内部リンクを注入
 * 7. GeneratedArticleData[] を返す
 */
export const generateArticlesStep: PipelineStep<AnalyticsData[], GeneratedArticleData[]> = {
  name: 'generate-articles',
  description: 'AIによる記事生成（キーワード選定 → 記事生成 → ASP/内部リンク注入）',
  maxRetries: 1, // 記事生成は冪等だがコストがかかるため、リトライは1回に制限
  timeoutMs: 300_000, // 5分 — Claude API呼び出しを含むため長めに設定

  async execute(
    input: AnalyticsData[],
    context: PipelineContext
  ): Promise<GeneratedArticleData[]> {
    const maxNewArticles = (context.sharedData['maxArticles'] as number | undefined) ?? DEFAULT_MAX_NEW_ARTICLES
    console.log(
      `[generate-articles] 記事生成開始 (run: ${context.runId}, maxNewArticles: ${maxNewArticles}, analyticsRecords: ${input.length})`
    )

    // ----------------------------------------------------------------
    // 1. コンテキストからトレンドデータを取得
    // ----------------------------------------------------------------
    const rawTrends = (context.sharedData['trends'] as TrendData[] | undefined) ?? []
    const trendInputs = toTrendDataInputs(rawTrends)
    console.log(`[generate-articles] トレンドデータ: ${trendInputs.length}件`)

    // ----------------------------------------------------------------
    // 2. microCMS から既存記事スラッグを取得（重複防止）
    // ----------------------------------------------------------------
    const existingSlugs = await fetchExistingSlugs()
    console.log(`[generate-articles] 既存記事スラッグ: ${existingSlugs.size}件`)

    // ----------------------------------------------------------------
    // 3. ArticlePlanner でキーワード選定（カテゴリフィルタ対応）
    // ----------------------------------------------------------------
    const enabledCategories = context.sharedData['enabledCategories'] as string[] | undefined

    const planner = new ArticlePlanner({
      maxNewArticles,
      excludeExistingKeywords: true,
    })

    // カテゴリフィルタ: enabledCategories が指定されていればキーワードを絞り込む
    let customKeywords: import('@/types/batch-generation').KeywordTarget[] | undefined
    if (enabledCategories && enabledCategories.length > 0) {
      const { KEYWORD_TARGETS } = await import('@/lib/content/keywords/targets')
      customKeywords = KEYWORD_TARGETS.filter((kw) =>
        enabledCategories.includes(kw.category)
      )
      console.log(`[generate-articles] カテゴリフィルタ: ${enabledCategories.join(', ')} → ${customKeywords.length}キーワード`)
    }

    const plan = await planner.planDailyArticles({
      trendData: trendInputs,
      existingArticles: [],
      ...(customKeywords ? { customKeywords } : {}),
    })

    console.log(`[generate-articles] プラン作成完了: ${plan.summary}`)

    if (plan.newArticles.length === 0) {
      console.log('[generate-articles] 生成対象キーワードなし — 空配列を返します')
      context.sharedData['generatedArticles'] = []
      return []
    }

    // ----------------------------------------------------------------
    // 4. 各キーワードに対して記事を生成
    // ----------------------------------------------------------------
    const generator = new ArticleGenerator()
    const generatedArticles: GeneratedArticleData[] = []

    for (let i = 0; i < plan.newArticles.length; i++) {
      const planned = plan.newArticles[i]
      const keyword = planned.keyword
      console.log(
        `[generate-articles] [${i + 1}/${plan.newArticles.length}] 記事生成中: "${keyword.keyword}" (カテゴリ: ${keyword.category}, スコア: ${planned.priorityScore})`
      )

      // スラッグの重複チェック — 既に同じスラッグの記事が存在する場合はスキップ
      const expectedSlug = keyword.keyword
        .toLowerCase()
        .replace(/[\s　]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      if (existingSlugs.has(expectedSlug)) {
        console.log(`[generate-articles] スキップ: "${keyword.keyword}" — スラッグ "${expectedSlug}" は既に存在します`)
        continue
      }

      try {
        // 記事生成リクエストを構築
        const request: ContentGenerationRequest = {
          category: keyword.category,
          keyword: keyword.keyword,
          subKeywords: keyword.subKeywords,
          targetAudience: keyword.targetAudience,
          tone: keyword.tone,
          targetLength: keyword.targetLength,
          outlineHints: keyword.outlineHints,
        }

        // 記事生成
        const response = await generator.generate(request)
        const article = response.article

        console.log(
          `[generate-articles] 記事生成完了: "${article.title}" (コンプライアンス: ${response.compliance.score}, 処理時間: ${response.processingTimeMs}ms)`
        )

        // ----------------------------------------------------------------
        // 5. ASPアフィリエイトリンク注入
        // ----------------------------------------------------------------
        let enrichedContent = article.content
        try {
          enrichedContent = await enrichContentWithAffiliateLinks(
            enrichedContent,
            keyword.category,
            3 // 最大3リンク
          )
          console.log(`[generate-articles] ASPリンク注入完了: "${article.title}"`)
        } catch (err) {
          console.warn(`[generate-articles] ASPリンク注入失敗（続行）: "${article.title}"`, err)
          // ASPリンク注入失敗は記事生成全体を止めない
        }

        // ----------------------------------------------------------------
        // 6. 内部リンク注入
        // ----------------------------------------------------------------
        try {
          const relatedArticles = await fetchRelatedArticles(keyword.category)
          if (relatedArticles.length > 0) {
            // 現在の記事を MicroCMSArticle 形式に変換（内部リンク注入に必要な最低限のフィールド）
            const currentAsMicroCMS: MicroCMSArticle = {
              id: article.slug,
              createdAt: article.publishedAt,
              updatedAt: article.updatedAt,
              publishedAt: article.publishedAt,
              revisedAt: article.updatedAt,
              title: article.title,
              slug: article.slug,
              content: enrichedContent,
              target_keyword: keyword.keyword,
              tags: keyword.subKeywords.map((kw) => ({
                id: kw,
                name: kw,
                slug: kw,
                createdAt: article.publishedAt,
                updatedAt: article.publishedAt,
                publishedAt: article.publishedAt,
                revisedAt: article.publishedAt,
              })),
            }

            enrichedContent = enrichContentWithInternalLinks(
              enrichedContent,
              currentAsMicroCMS,
              relatedArticles,
              5 // 最大5内部リンク
            )
            console.log(`[generate-articles] 内部リンク注入完了: "${article.title}"`)
          }
        } catch (err) {
          console.warn(`[generate-articles] 内部リンク注入失敗（続行）: "${article.title}"`, err)
          // 内部リンク注入失敗は記事生成全体を止めない
        }

        // ----------------------------------------------------------------
        // 7. GeneratedArticleData に変換
        // ----------------------------------------------------------------
        const generatedData = toGeneratedArticleData({
          ...article,
          content: enrichedContent,
        })

        generatedArticles.push(generatedData)

        // 生成済みスラッグを追加（同一バッチ内での重複防止）
        existingSlugs.add(article.slug.toLowerCase())
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(
          `[generate-articles] 記事生成失敗: "${keyword.keyword}" — ${errorMsg}`
        )
        // 個別記事の生成失敗はパイプライン全体を止めない（他の記事の生成は続行）
      }
    }

    // ----------------------------------------------------------------
    // 8. 結果をコンテキストに保存して返す
    // ----------------------------------------------------------------
    context.sharedData['generatedArticles'] = generatedArticles

    console.log(
      `[generate-articles] 完了: ${generatedArticles.length}/${plan.newArticles.length}件の記事を生成しました`
    )

    return generatedArticles
  },
}
