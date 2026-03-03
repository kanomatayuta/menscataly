/**
 * コンテンツ生成モジュール エントリポイント
 * 記事生成パイプライン基盤 — プロンプト / ユーティリティ の re-export
 */

// ============================================================
// プロンプトテンプレート
// ============================================================

export {
  buildBasePrompt,
  getComplianceInstructions,
  getArticleStructureTemplate,
} from "./prompts/base-prompt";

export {
  getCategoryPrompt,
  getAllCategoryPrompts,
  getCategoryAffiliateGuide,
} from "./prompts/category-prompts";

export {
  getSEOPrompt,
  getSearchIntentPattern,
  buildSEOPrompt,
} from "./prompts/seo-prompt";
export type { SearchIntent } from "./prompts/seo-prompt";

export {
  getEEATPrompt,
  getSupervisorTemplate,
  getRecommendedReferences,
  buildEEATPrompt,
} from "./prompts/eeat-prompt";

// ============================================================
// コンテンツユーティリティ
// ============================================================

export {
  calculateReadingTime,
  charCountToMinutes,
} from "./utils/reading-time";
export type { ReadingTimeOptions, ReadingTimeResult } from "./utils/reading-time";

export {
  generateToc,
  tocToMarkdown,
  flattenToc,
} from "./utils/toc-generator";
export type { TocGeneratorOptions } from "./utils/toc-generator";

export {
  countChars,
  countLines,
  extractExcerpt,
  normalizeFullWidth,
  normalizeWhitespace,
  slugify,
  stripMarkdownSyntax,
  isWithinLength,
  isValidMetaDescription,
  isValidSEOTitle,
} from "./utils/text-utils";
export type { CharCountOptions, ExcerptOptions } from "./utils/text-utils";

// ============================================================
// キーワードターゲット
// ============================================================

export {
  KEYWORD_TARGETS,
  getAllKeywords,
  getKeywordsByCategory,
  getKeywordsByPriority,
  getKeywordById,
} from "./keywords/index";

// ============================================================
// テンプレート
// ============================================================

export { ARTICLE_TEMPLATES } from "./templates/article-templates";
export type {
  ArticleTemplate,
  TemplateSectionDef,
  CtaPosition,
  AffiliateInsertionPoint,
} from "./templates/article-templates";

export { CTA_TEMPLATES } from "./templates/cta-templates";
export type {
  CtaTemplate,
  CtaPlacement,
  CtaVariant,
} from "./templates/cta-templates";

// ============================================================
// ASPコンテンツガイド
// ============================================================

export {
  ASP_CONTENT_GUIDES,
  getContentGuide,
  getSafeCTAs,
} from "./asp-content-guide";
export type { AspContentGuide } from "./asp-content-guide";

// ============================================================
// 記事生成エンジン
// ============================================================

export { ArticleGenerator } from "./generator";

// ============================================================
// 記事公開ヘルパー
// ============================================================

export { ArticlePublisher } from "./publisher";
export type { PublishOptions, PublishResult, PublishStatus } from "./publisher";
