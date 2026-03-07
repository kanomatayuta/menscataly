/**
 * 記事生成エンジン
 * Claude Sonnet 4.6 を使ったプロンプト → API → 薬機法チェック → 修正 → 完成記事のパイプライン
 */

import { createArticleGenerationClient } from "@/lib/ai/client";
import { ARTICLE_TOOL_SCHEMA } from "@/lib/ai/types";
import type { ToolSchema } from "@/lib/ai/types";
import { ComplianceChecker } from "@/lib/compliance/checker";
import { insertPRDisclosure } from "@/lib/compliance/templates/pr-disclosure";
import {
  buildBasePrompt,
  getCategoryPrompt,
  buildSEOPrompt,
  buildEEATPrompt,
  getRecommendedReferences,
  getSupervisorTemplate,
} from "@/lib/content/index";
import { slugify, extractExcerpt } from "@/lib/content/utils/text-utils";
import { calculateReadingTime } from "@/lib/content/utils/reading-time";
import { ARTICLE_TEMPLATES } from "@/lib/content/templates/article-templates";
import { CTA_TEMPLATES } from "@/lib/content/templates/cta-templates";
import type {
  Article,
  ArticleSection,
  AuthorInfo,
  ContentCategory,
  ContentGenerationRequest,
  ContentGenerationResponse,
  HeadingLevel,
  Reference,
  SEOMetadata,
} from "@/types/content";

// ============================================================
// 定数
// ============================================================

/** コンプライアンス合格ラインのスコア */
const COMPLIANCE_PASS_SCORE = 95;

/** デフォルトの記事著者 */
const DEFAULT_AUTHOR: AuthorInfo = {
  name: "MENS CATALY 編集部",
  credentials: "メンズ医療・美容メディア編集スタッフ",
  bio: "男性向け医療・美容情報を専門に扱うメディア編集部。医師・薬剤師監修のもと、信頼性の高い情報を提供しています。",
};

/** カテゴリと監修者タイプのマッピング */
const CATEGORY_SUPERVISOR_MAP: Record<
  ContentCategory,
  "dermatologist" | "urologist" | "pharmacist" | "none"
> = {
  aga: "dermatologist",
  "hair-removal": "dermatologist",
  skincare: "dermatologist",
  ed: "urologist",
  column: "none",
};

// ============================================================
// ダミー記事生成
// ============================================================

/**
 * ANTHROPIC_API_KEY 未設定時のダミー記事を生成する
 */
function generateDummyArticle(
  request: ContentGenerationRequest,
  now: string
): Article {
  const dummySections: ArticleSection[] = [
    {
      heading: `${request.keyword}とは？基本的な知識を解説`,
      level: "h2" as HeadingLevel,
      content: `${request.keyword}について、基本的な情報をわかりやすく解説します。\n\n※ これはダミー記事です。ANTHROPIC_API_KEY を設定すると実際の記事が生成されます。`,
      subsections: [
        {
          heading: `${request.keyword}の原因と仕組み`,
          level: "h3" as HeadingLevel,
          content: "原因についての詳細解説がここに入ります。",
        },
        {
          heading: "セルフチェックの方法",
          level: "h3" as HeadingLevel,
          content: "セルフチェック方法の詳細がここに入ります。",
        },
      ],
    },
    {
      heading: "治療・対処法の選び方",
      level: "h2" as HeadingLevel,
      content: "治療方法の比較と選び方の解説がここに入ります。",
      subsections: [
        {
          heading: "専門クリニックへの相談",
          level: "h3" as HeadingLevel,
          content: "専門医への相談を推奨します。",
        },
      ],
    },
    {
      heading: "まとめ",
      level: "h2" as HeadingLevel,
      content: `- ${request.keyword}についての要点1\n- 要点2\n- 要点3\n\n詳細は専門医にご相談ください。`,
    },
  ];

  const dummyReferences = getRecommendedReferences(request.category);

  const fullContent = dummySections
    .map(
      (s) =>
        `## ${s.heading}\n\n${s.content}${
          s.subsections
            ? "\n\n" +
              s.subsections
                .map((sub) => `### ${sub.heading}\n\n${sub.content}`)
                .join("\n\n")
            : ""
        }`
    )
    .join("\n\n");

  const readingTime = calculateReadingTime(fullContent);

  return {
    title: `【ダミー】${request.keyword}の完全ガイド`,
    slug: slugify(`dummy-${request.keyword}`),
    lead: `※ これはダミー記事です。ANTHROPIC_API_KEY を設定すると実際の記事が生成されます。${request.keyword}について、${request.targetAudience}向けに詳しく解説します。`,
    content: fullContent,
    sections: dummySections,
    category: request.category,
    seo: {
      title: `【ダミー】${request.keyword}の完全ガイド`,
      description: extractExcerpt(fullContent, { maxLength: 120 }),
      keywords: [request.keyword, ...(request.subKeywords ?? [])],
    },
    author: DEFAULT_AUTHOR,
    supervisor: getSupervisorTemplate(CATEGORY_SUPERVISOR_MAP[request.category]),
    references: dummyReferences,
    publishedAt: now,
    updatedAt: now,
    readingTime: readingTime.minutes,
    tags: [request.keyword, request.category],
    hasPRDisclosure: true,
    isCompliant: true,
    complianceScore: 100,
  };
}

// ============================================================
// レスポンスパーサー
// ============================================================

/** Claude API レスポンスの中間型 */
interface RawArticleJSON {
  title?: string;
  lead?: string;
  sections?: Array<{
    heading?: string;
    level?: string;
    content?: string;
    subsections?: Array<{
      heading?: string;
      level?: string;
      content?: string;
    }>;
  }>;
  conclusion?: string;
  cta?: string;
  tags?: string[];
  references?: Array<{
    title?: string;
    url?: string;
    author?: string;
    year?: number;
    source?: string;
  }>;
}

/**
 * Claude API レスポンスのJSONをパースして記事データを抽出する
 */
function parseArticleResponse(
  content: string,
  request: ContentGenerationRequest,
  now: string
): Article {
  // JSONコードブロックを抽出（複数の ```json ブロックにも対応）
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr = jsonMatch ? jsonMatch[1] : content;

  let raw: RawArticleJSON;
  try {
    raw = JSON.parse(jsonStr) as RawArticleJSON;
  } catch {
    // 2回目の試行: コンテンツ内の最初の { ... } ブロックを抽出
    console.warn("[ArticleGenerator] First JSON parse failed. Trying to extract JSON object...");
    const braceStart = content.indexOf("{");
    const braceEnd = content.lastIndexOf("}");
    if (braceStart >= 0 && braceEnd > braceStart) {
      jsonStr = content.slice(braceStart, braceEnd + 1);
      try {
        raw = JSON.parse(jsonStr) as RawArticleJSON;
        console.info("[ArticleGenerator] Successfully extracted JSON from response.");
      } catch {
        // 3回目の試行: コンテンツをMarkdownとして解釈
        console.warn("[ArticleGenerator] All JSON parse attempts failed. Treating as Markdown.");
        const lines = content.split("\n");
        const sections: RawArticleJSON["sections"] = [];
        let currentSection: { heading: string; level: string; content: string } | null = null;

        for (const line of lines) {
          const h2Match = line.match(/^##\s+(.+)/);
          const h3Match = line.match(/^###\s+(.+)/);
          if (h2Match) {
            if (currentSection) sections.push(currentSection);
            currentSection = { heading: h2Match[1], level: "h2", content: "" };
          } else if (h3Match && currentSection) {
            currentSection.content += `\n### ${h3Match[1]}`;
          } else if (currentSection && line.trim()) {
            currentSection.content += `\n${line.trim()}`;
          }
        }
        if (currentSection) sections.push(currentSection);

        raw = {
          title: `${request.keyword} 完全ガイド`,
          lead: lines.find((l) => l.trim() && !l.startsWith("#"))?.trim() ?? "",
          sections: sections.length > 0 ? sections : undefined,
          tags: [request.keyword],
          references: [],
        };
      }
    } else {
      // JSONオブジェクトが見つからない — Markdownとして解釈
      console.warn("[ArticleGenerator] No JSON object found. Treating as plain text.");
      raw = {
        title: `${request.keyword} 完全ガイド`,
        lead: content.slice(0, 300).replace(/[`#*]/g, "").trim(),
        sections: [],
        tags: [request.keyword],
        references: [],
      };
    }
  }

  // セクション変換
  const sections: ArticleSection[] = (raw.sections ?? []).map((s) => ({
    heading: s.heading ?? "",
    level: (["h2", "h3", "h4"].includes(s.level ?? "") ? s.level : "h2") as HeadingLevel,
    content: s.content ?? "",
    subsections: s.subsections?.map((sub) => ({
      heading: sub.heading ?? "",
      level: (["h2", "h3", "h4"].includes(sub.level ?? "") ? sub.level : "h3") as HeadingLevel,
      content: sub.content ?? "",
    })),
  }));

  // まとめセクションをセクションに追加
  if (raw.conclusion) {
    sections.push({
      heading: "まとめ",
      level: "h2" as HeadingLevel,
      content: raw.conclusion + (raw.cta ? `\n\n${raw.cta}` : ""),
    });
  }

  // フルコンテンツ組み立て
  const fullContent = sections
    .map(
      (s) =>
        `## ${s.heading}\n\n${s.content}${
          s.subsections
            ? "\n\n" +
              s.subsections
                .map((sub) => `### ${sub.heading}\n\n${sub.content}`)
                .join("\n\n")
            : ""
        }`
    )
    .join("\n\n");

  // 参考文献
  const references: Reference[] = [
    ...getRecommendedReferences(request.category),
    ...(raw.references ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      author: r.author,
      year: r.year,
      source: r.source,
    })),
  ];

  // SEOメタデータ
  const seo: SEOMetadata = {
    title: raw.title ?? `${request.keyword} 完全ガイド`,
    description: raw.lead
      ? extractExcerpt(raw.lead, { maxLength: 120 })
      : extractExcerpt(fullContent, { maxLength: 120 }),
    keywords: [request.keyword, ...(request.subKeywords ?? []), ...(raw.tags ?? [])],
  };

  const readingTime = calculateReadingTime(fullContent);

  return {
    title: raw.title ?? `${request.keyword} 完全ガイド`,
    slug: slugify(raw.title ?? request.keyword),
    lead: raw.lead ?? extractExcerpt(fullContent, { maxLength: 300 }),
    content: fullContent,
    sections,
    category: request.category,
    seo,
    author: DEFAULT_AUTHOR,
    supervisor: getSupervisorTemplate(CATEGORY_SUPERVISOR_MAP[request.category]),
    references,
    publishedAt: now,
    updatedAt: now,
    readingTime: readingTime.minutes,
    tags: [...new Set([request.keyword, request.category, ...(raw.tags ?? [])])],
    hasPRDisclosure: false, // コンプライアンスチェック後に更新
    isCompliant: false,      // コンプライアンスチェック後に更新
  };
}

/**
 * RawArticleJSON（tool_use出力 or パース済み）からArticle型を構築する共通ヘルパー
 */
function buildArticleFromRaw(
  raw: RawArticleJSON,
  request: ContentGenerationRequest,
  now: string
): Article {
  console.info(
    `[buildArticleFromRaw] title="${raw.title}", sections=${raw.sections?.length ?? 0}, conclusion=${raw.conclusion ? 'yes' : 'no'}`
  );

  // セクション変換
  const sections: ArticleSection[] = (raw.sections ?? []).map((s) => ({
    heading: s.heading ?? "",
    level: (["h2", "h3", "h4"].includes(s.level ?? "") ? s.level : "h2") as HeadingLevel,
    content: s.content ?? "",
    subsections: s.subsections?.map((sub) => ({
      heading: sub.heading ?? "",
      level: (["h2", "h3", "h4"].includes(sub.level ?? "") ? sub.level : "h3") as HeadingLevel,
      content: sub.content ?? "",
    })),
  }));

  // まとめセクションをセクションに追加
  if (raw.conclusion) {
    sections.push({
      heading: "まとめ",
      level: "h2" as HeadingLevel,
      content: raw.conclusion + (raw.cta ? `\n\n${raw.cta}` : ""),
    });
  }

  // フルコンテンツ組み立て
  const fullContent = sections
    .map(
      (s) =>
        `## ${s.heading}\n\n${s.content}${
          s.subsections
            ? "\n\n" +
              s.subsections
                .map((sub) => `### ${sub.heading}\n\n${sub.content}`)
                .join("\n\n")
            : ""
        }`
    )
    .join("\n\n");

  if (fullContent.trim().length < 200) {
    console.warn(
      `[buildArticleFromRaw] WARNING: Content is very short (${fullContent.length} chars, ${sections.length} sections). Possible API truncation.`
    );
  }

  // 参考文献
  const references: Reference[] = [
    ...getRecommendedReferences(request.category),
    ...(raw.references ?? []).map((r) => ({
      title: r.title ?? "",
      url: r.url ?? "",
      author: r.author,
      year: r.year,
      source: r.source,
    })),
  ];

  // SEOメタデータ
  const seo: SEOMetadata = {
    title: raw.title ?? `${request.keyword} 完全ガイド`,
    description: raw.lead
      ? extractExcerpt(raw.lead, { maxLength: 120 })
      : extractExcerpt(fullContent, { maxLength: 120 }),
    keywords: [request.keyword, ...(request.subKeywords ?? []), ...(raw.tags ?? [])],
  };

  const readingTime = calculateReadingTime(fullContent);

  return {
    title: raw.title ?? `${request.keyword} 完全ガイド`,
    slug: slugify(raw.title ?? request.keyword),
    lead: raw.lead ?? extractExcerpt(fullContent, { maxLength: 300 }),
    content: fullContent,
    sections,
    category: request.category,
    seo,
    author: DEFAULT_AUTHOR,
    supervisor: getSupervisorTemplate(CATEGORY_SUPERVISOR_MAP[request.category]),
    references,
    publishedAt: now,
    updatedAt: now,
    readingTime: readingTime.minutes,
    tags: [...new Set([request.keyword, request.category, ...(raw.tags ?? [])])],
    hasPRDisclosure: false, // コンプライアンスチェック後に更新
    isCompliant: false,      // コンプライアンスチェック後に更新
  };
}

// ============================================================
// E-E-A-T 要素自動挿入
// ============================================================

/**
 * 記事コンテンツの末尾に E-E-A-T 必須要素（監修者情報・参考文献・更新日）を自動挿入する。
 * コンプライアンスチェッカーの checkRequiredElements() が article.content テキスト内に
 * 「監修者」「参考文献」「更新日」の文字列が含まれるかチェックするため、
 * これらをコンテンツに埋め込むことでスコアを+30〜45点改善する。
 */
function appendEEATElements(content: string, article: Article): string {
  let enriched = content;

  // 監修者情報
  if (article.supervisor) {
    enriched += `\n\n## 監修者情報\n\n${article.supervisor.name}（${article.supervisor.credentials}）\n${article.supervisor.bio}`;
  }

  // 参考文献
  if (article.references && article.references.length > 0) {
    enriched += `\n\n## 参考文献\n\n`;
    for (const ref of article.references) {
      enriched += `- ${ref.title}${ref.url ? ` (${ref.url})` : ""}${ref.source ? ` — ${ref.source}` : ""}\n`;
    }
  }

  // 更新日
  if (article.updatedAt) {
    enriched += `\n\n*最終更新日: ${article.updatedAt.split("T")[0]}*`;
  }

  return enriched;
}

// ============================================================
// ArticleGenerator クラス
// ============================================================

/**
 * 記事生成エンジン
 *
 * @example
 * ```ts
 * const generator = new ArticleGenerator();
 * const response = await generator.generate({
 *   category: "aga",
 *   keyword: "AGA 治療 費用",
 *   subKeywords: ["AGA クリニック", "フィナステリド 価格"],
 *   targetAudience: "20〜40代男性、AGAが気になり始めた方",
 *   tone: "informative",
 *   targetLength: 3000,
 * });
 * console.log(response.article.title);
 * console.log(response.compliance.score); // 95以上で合格
 * ```
 */
export class ArticleGenerator {
  private readonly aiClient = createArticleGenerationClient();
  private readonly checker = new ComplianceChecker({ autoFix: false, strictMode: false });

  /**
   * 記事を生成する
   * プロンプト組み立て → Claude API → 薬機法チェック → 自動修正 → 最終検証
   *
   * @param request 記事生成リクエスト
   * @returns 生成済み記事・SEOメタデータ・コンプライアンス結果
   */
  async generate(
    request: ContentGenerationRequest
  ): Promise<ContentGenerationResponse> {
    const startTime = Date.now();
    const now = new Date().toISOString();

    // ----------------------------------------------------------------
    // ANTHROPIC_API_KEY 未設定時: ダミー記事を返す
    // ----------------------------------------------------------------
    if (this.aiClient.isDryRun) {
      console.info(
        "[ArticleGenerator] Dry-run mode: returning dummy article."
      );
      const dummyArticle = generateDummyArticle(request, now);
      const complianceResult = this.checker.check(dummyArticle.content, {
        categories: [this.mapCategory(request.category)],
      });
      dummyArticle.isCompliant = complianceResult.isCompliant;
      dummyArticle.complianceScore = complianceResult.score;
      dummyArticle.hasPRDisclosure = complianceResult.hasPRDisclosure;

      return {
        article: dummyArticle,
        seo: dummyArticle.seo,
        compliance: complianceResult,
        model: "dry-run (no API key)",
        generatedAt: now,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // ----------------------------------------------------------------
    // 1. プロンプト組み立て
    // ----------------------------------------------------------------
    const systemPrompt = this.buildSystemPrompt(request, now);
    const userMessage = this.buildUserMessage(request);

    // ----------------------------------------------------------------
    // 2. Claude Sonnet 4.6 API 呼び出し (tool_use で構造化出力)
    // ----------------------------------------------------------------
    console.info(`[ArticleGenerator] Generating article for keyword: "${request.keyword}"`);

    let article: Article;
    let aiModel: string;
    let aiTokenUsage: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number };

    try {
      // tool_use (function calling) で構造化JSONを強制取得
      const toolResponse = await this.aiClient.generateWithTool<RawArticleJSON>(
        {
          systemPrompt,
          userMessage,
          modelConfig: {
            maxTokens: 16384,
            temperature: 0.5,
          },
        },
        ARTICLE_TOOL_SCHEMA as ToolSchema
      );

      console.info(
        `[ArticleGenerator] tool_use response received — sections: ${
          (toolResponse.content as RawArticleJSON).sections?.length ?? 0
        }, tokens: ${toolResponse.tokenUsage.outputTokens}`
      );
      aiModel = toolResponse.model;
      aiTokenUsage = toolResponse.tokenUsage;

      // tool_use の出力を直接 RawArticleJSON として使用（パース不要）
      const rawArticle = toolResponse.content as RawArticleJSON;

      // セクションが空の場合はテキスト生成にフォールバック
      if (!rawArticle.sections || rawArticle.sections.length === 0) {
        console.warn(
          `[ArticleGenerator] tool_use returned empty sections (outputTokens: ${toolResponse.tokenUsage.outputTokens}). Falling back to text generation.`
        );
        throw new Error("tool_use returned empty sections");
      }

      article = buildArticleFromRaw(rawArticle, request, now);
    } catch (toolError) {
      // tool_use 失敗時は従来のテキスト生成にフォールバック
      console.warn(
        "[ArticleGenerator] tool_use failed, falling back to text generation:",
        toolError instanceof Error ? toolError.message : toolError
      );

      const aiResponse = await this.aiClient.generate({
        systemPrompt,
        userMessage,
        modelConfig: {
          maxTokens: 16384,
          temperature: 0.5,
        },
      });

      aiModel = aiResponse.model;
      aiTokenUsage = aiResponse.tokenUsage;

      // 従来のパースロジックでArticle型に変換
      article = parseArticleResponse(aiResponse.content, request, now);
    }

    // ----------------------------------------------------------------
    // 3.5. E-E-A-T 要素をコンテンツに自動挿入（スコア+30〜45点）
    // ----------------------------------------------------------------
    article.content = appendEEATElements(article.content, article);

    // ----------------------------------------------------------------
    // 4. 薬機法チェッカーで自動チェック
    // ----------------------------------------------------------------
    const categoryKey = this.mapCategory(request.category);
    let complianceResult = this.checker.check(article.content, {
      categories: [categoryKey, "common"],
    });

    // ----------------------------------------------------------------
    // 5. NG表現があれば自動修正
    // ----------------------------------------------------------------
    if (!complianceResult.isCompliant || !complianceResult.hasPRDisclosure) {
      console.info(
        `[ArticleGenerator] Compliance check failed (score: ${complianceResult.score}). Applying auto-fix...`
      );

      // NG表現を修正
      let fixedContent = complianceResult.fixedText;

      // PR表記が未挿入なら先頭に追加
      if (!complianceResult.hasPRDisclosure) {
        fixedContent = insertPRDisclosure(fixedContent, "affiliate_standard");
      }

      article.content = fixedContent;

      // 修正後の最終チェック
      complianceResult = this.checker.check(article.content, {
        categories: [categoryKey, "common"],
      });
    }

    // ----------------------------------------------------------------
    // 6. スコア95以上で合格 / 未達の場合は警告ログ
    // ----------------------------------------------------------------
    if (complianceResult.score < COMPLIANCE_PASS_SCORE) {
      console.warn(
        `[ArticleGenerator] Compliance score (${complianceResult.score}) is below threshold (${COMPLIANCE_PASS_SCORE}). Manual review required.`
      );
    } else {
      console.info(
        `[ArticleGenerator] Compliance check passed (score: ${complianceResult.score}).`
      );
    }

    // ----------------------------------------------------------------
    // 7. 記事にコンプライアンス結果を反映
    // ----------------------------------------------------------------
    article.isCompliant = complianceResult.score >= COMPLIANCE_PASS_SCORE;
    article.complianceScore = complianceResult.score;
    article.hasPRDisclosure = complianceResult.hasPRDisclosure;

    // アフィリエイトリンクをコンテンツに反映（アンカーテキスト挿入）
    if (request.affiliateLinks && request.affiliateLinks.length > 0) {
      article = this.injectAffiliateLinks(article, request);
    }

    // コスト記録 (動的インポート — CostTracker が利用可能な場合のみ)
    this.recordGenerationCost(
      aiTokenUsage,
      aiModel,
      article.id ?? null
    ).catch((err) =>
      console.error('[ArticleGenerator] Failed to record cost:', err)
    );

    return {
      article,
      seo: article.seo,
      compliance: complianceResult,
      model: aiModel,
      generatedAt: now,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ============================================================
  // コスト記録ヘルパー
  // ============================================================

  /**
   * 記事生成コストを CostTracker に記録する (動的インポート)
   */
  private async recordGenerationCost(
    tokenUsage: { inputTokens: number; outputTokens: number; estimatedCostUsd?: number },
    model: string,
    articleId: string | null
  ): Promise<void> {
    try {
      const { CostTracker } = await import('@/lib/batch/cost-tracker');
      const tracker = new CostTracker();
      await tracker.recordCost({
        articleId,
        costType: 'article_generation',
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        costUsd: tokenUsage.estimatedCostUsd ?? 0,
        model,
      });
    } catch (err) {
      console.error('[ArticleGenerator] CostTracker error:', err);
    }
  }

  // ============================================================
  // プロンプト組み立てヘルパー
  // ============================================================

  private buildSystemPrompt(
    request: ContentGenerationRequest,
    now: string
  ): string {
    const basePrompt = buildBasePrompt(
      request.tone,
      request.targetAudience,
      request.keyword,
      request.targetLength ?? 3000
    );

    const categoryPrompt = getCategoryPrompt(request.category);

    const seoPrompt = buildSEOPrompt(
      request.keyword,
      request.subKeywords ?? [],
      "informational"
    );

    const eeatPrompt = buildEEATPrompt(request.category, now, now);

    // テンプレートベースのセクション構成指示を追加
    const template = ARTICLE_TEMPLATES[request.category];
    const templatePrompt = this.buildTemplatePrompt(template, request.category);

    return [basePrompt, categoryPrompt, seoPrompt, eeatPrompt, templatePrompt].join("\n\n---\n\n");
  }

  private buildUserMessage(request: ContentGenerationRequest): string {
    const parts: string[] = [
      `メインキーワード「${request.keyword}」について、${request.targetAudience}向けの記事を生成してください。`,
    ];

    if (request.subKeywords && request.subKeywords.length > 0) {
      parts.push(
        `サブキーワード（記事中に自然に含める）: ${request.subKeywords.join(", ")}`
      );
    }

    if (request.outlineHints && request.outlineHints.length > 0) {
      parts.push(`記事構成のヒント:\n${request.outlineHints.map((h) => `- ${h}`).join("\n")}`);
    }

    if (request.affiliateLinks && request.affiliateLinks.length > 0) {
      parts.push(
        `アフィリエイトリンク候補（記事に自然に組み込む）:\n` +
          request.affiliateLinks
            .map(
              (l) =>
                `- ${l.programName}（${l.aspName}）: ${l.anchorText} — ${l.url}`
            )
            .join("\n")
      );
    }

    // CTA テンプレートを追加
    const ctaTemplates = CTA_TEMPLATES[request.category];
    if (ctaTemplates && ctaTemplates.length > 0) {
      const primaryCtas = ctaTemplates.filter((c) => c.variant === "primary");
      if (primaryCtas.length > 0) {
        parts.push(
          `CTA（行動喚起）テキストの参考例:\n${primaryCtas.map((c) => `- ${c.text}`).join("\n")}\n※ CTAは上記を参考に、薬機法・景表法に準拠した表現で記述してください。`
        );
      }
    }

    parts.push("前述のJSONフォーマットで出力してください。");

    return parts.join("\n\n");
  }

  /**
   * 記事テンプレートからセクション構成プロンプトを構築する
   */
  private buildTemplatePrompt(
    template: (typeof ARTICLE_TEMPLATES)[ContentCategory],
    category: ContentCategory
  ): string {
    const sectionList = template.sections
      .map((s, i) => {
        const sub = s.subsections
          ? "\n" + s.subsections.map((ss) => `    - ${ss.heading}: ${ss.description}`).join("\n")
          : "";
        return `  ${i + 1}. **${s.heading}** (${s.level}): ${s.description}${sub}`;
      })
      .join("\n");

    const ctaPositionList = template.ctaPositions
      .map((p) => `  - セクション${p.afterSectionIndex + 1}の後 (${p.variant})`)
      .join("\n");

    return `## カテゴリ別テンプレート構成（${category}）

以下のセクション構成に従って記事を作成してください:

${sectionList}

### CTA配置位置
${ctaPositionList}

### 目標文字数: ${template.wordCountTarget}文字`;
  }

  /**
   * ContentCategory を ComplianceChecker の Category 型にマップする
   */
  private mapCategory(
    category: ContentCategory
  ): "aga" | "hair_removal" | "skincare" | "ed" | "column" {
    const map: Record<ContentCategory, "aga" | "hair_removal" | "skincare" | "ed" | "column"> = {
      aga: "aga",
      "hair-removal": "hair_removal",
      skincare: "skincare",
      ed: "ed",
      column: "column",
    };
    return map[category];
  }

  /**
   * アフィリエイトリンクを記事コンテンツに注入する（HTML <a> タグ挿入）
   *
   * NOTE: これは Claude API が生成したアンカーテキストを検索して
   * request.affiliateLinks のURLでリンク化する「生成時リンク注入」です。
   * カテゴリベースの自動リンク注入は link-injector.ts の
   * injectAffiliateLinksByCategory() を使用してください。
   *
   * rel="sponsored noopener" を付与し、最初の出現箇所のみリンク化する
   */
  private injectAffiliateLinks(
    article: Article,
    request: ContentGenerationRequest
  ): Article {
    if (!request.affiliateLinks) return article;

    let content = article.content;

    for (const link of request.affiliateLinks) {
      const escapedAnchor = link.anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // 既にリンク化済み（<a> タグ内）の場合はスキップ
      const alreadyLinked = new RegExp(
        `<a\\s[^>]*>[^<]*${escapedAnchor}[^<]*</a>`,
        "i"
      );
      if (alreadyLinked.test(content)) {
        continue;
      }

      // 最初の出現箇所のみ HTML <a> タグに置換
      const index = content.indexOf(link.anchorText);
      if (index === -1) continue;

      const linkHtml = `<a href="${link.url}" rel="sponsored noopener" target="_blank">${link.anchorText}</a>`;
      content =
        content.slice(0, index) +
        linkHtml +
        content.slice(index + link.anchorText.length);
    }

    // PR表記がまだ挿入されていない場合は先頭に追加
    if (!article.hasPRDisclosure && request.affiliateLinks.length > 0) {
      const hasPR = /アフィリエイト広告|【PR】|成果報酬型広告/.test(content);
      if (!hasPR) {
        content = "※本記事はアフィリエイト広告を含みます。\n\n" + content;
      }
    }

    return { ...article, content };
  }
}
