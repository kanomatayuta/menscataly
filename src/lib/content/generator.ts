/**
 * 記事生成エンジン
 * Claude Sonnet 4.6 を使ったプロンプト → API → 薬機法チェック → 修正 → 完成記事のパイプライン
 */

import { createArticleGenerationClient } from "@/lib/ai/client";
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
  "dermatologist" | "urologist" | "pharmacist"
> = {
  aga: "dermatologist",
  "hair-removal": "dermatologist",
  skincare: "dermatologist",
  ed: "urologist",
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
  // JSONコードブロックを抽出
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : content;

  let raw: RawArticleJSON;
  try {
    raw = JSON.parse(jsonStr) as RawArticleJSON;
  } catch {
    // JSONパース失敗時はコンテンツをそのまま使用
    console.warn("[ArticleGenerator] Failed to parse JSON response. Using raw content.");
    raw = {
      title: `${request.keyword} 完全ガイド`,
      lead: content.slice(0, 300),
      sections: [],
      tags: [request.keyword],
      references: [],
    };
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
    // 2. Claude Sonnet 4.6 API 呼び出し
    // ----------------------------------------------------------------
    console.info(`[ArticleGenerator] Generating article for keyword: "${request.keyword}"`);
    const aiResponse = await this.aiClient.generate({
      systemPrompt,
      userMessage,
      modelConfig: {
        maxTokens: 8192,
        temperature: 0.7,
      },
    });

    // ----------------------------------------------------------------
    // 3. レスポンスをArticle型にパース
    // ----------------------------------------------------------------
    let article = parseArticleResponse(aiResponse.content, request, now);

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

    return {
      article,
      seo: article.seo,
      compliance: complianceResult,
      model: aiResponse.model,
      generatedAt: now,
      processingTimeMs: Date.now() - startTime,
    };
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

    return [basePrompt, categoryPrompt, seoPrompt, eeatPrompt].join("\n\n---\n\n");
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

    parts.push("前述のJSONフォーマットで出力してください。");

    return parts.join("\n\n");
  }

  /**
   * ContentCategory を ComplianceChecker の Category 型にマップする
   */
  private mapCategory(
    category: ContentCategory
  ): "aga" | "hair_removal" | "skincare" | "ed" {
    const map: Record<ContentCategory, "aga" | "hair_removal" | "skincare" | "ed"> = {
      aga: "aga",
      "hair-removal": "hair_removal",
      skincare: "skincare",
      ed: "ed",
    };
    return map[category];
  }

  /**
   * アフィリエイトリンクを記事コンテンツに注入する（アンカーテキスト挿入）
   */
  private injectAffiliateLinks(
    article: Article,
    request: ContentGenerationRequest
  ): Article {
    if (!request.affiliateLinks) return article;

    let content = article.content;

    for (const link of request.affiliateLinks) {
      // アンカーテキストが既にコンテンツに含まれていれば、リンク化
      if (content.includes(link.anchorText)) {
        // rel="sponsored" 付きで置換（既にリンク化されていない場合のみ）
        const linkPattern = new RegExp(
          `(?<!\\[)${link.anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\])`,
          "g"
        );
        content = content.replace(
          linkPattern,
          `[${link.anchorText}](${link.url}){rel="sponsored noopener"}`
        );
      }
    }

    return { ...article, content };
  }
}
