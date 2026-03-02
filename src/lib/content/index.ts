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
