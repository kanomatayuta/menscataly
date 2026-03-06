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
  MOSHIMO_PRODUCT_TEMPLATES,
  MOSHIMO_LINK_TEMPLATES,
  getMoshimoTemplate,
  getRandomMoshimoMention,
  getMoshimoComplianceNotes,
  getRelatedMoshimoCategories,
} from "./asp-content-guide";
export type {
  AspContentGuide,
  MoshimoProductTemplate,
  MoshimoProductCategory,
} from "./asp-content-guide";

// ============================================================
// 記事生成エンジン
// ============================================================

export { ArticleGenerator } from "./generator";

// ============================================================
// 記事リライトエンジン
// ============================================================

export { ArticleRewriter } from "./rewriter";
export type { RewriteRequest, RewriteResult } from "./rewriter";

// ============================================================
// 記事公開ヘルパー
// ============================================================

export { ArticlePublisher } from "./publisher";
export type { PublishOptions, PublishResult, PublishStatus } from "./publisher";

// ============================================================
// ヘルススコアシステム
// ============================================================

export {
  calculateHealthScore,
  calculateBatchHealthScores,
  getHealthStatusLabel,
  getHealthScoreDistribution,
  calculateEEATScore,
} from "./health-score";
export type {
  HealthScoreInput,
  HealthScore,
  EEATScoreInput,
  EEATScoreResult,
  EEATScoreBreakdown,
} from "./health-score";

// ============================================================
// AI記事プランナー
// ============================================================

export { ArticlePlanner } from "./article-planner";
export type {
  DailyArticlePlan,
  PlannedNewArticle,
  PlannedImprovementArticle,
  ExistingArticleInfo,
  TrendDataInput,
  ArticlePlannerConfig,
} from "./article-planner";

// ============================================================
// 自動非公開システム
// ============================================================

export { scanAndDepublish, checkShouldDepublish } from "./auto-depublish";
export type {
  DepublishCandidate,
  DepublishResult,
  AutoDepublishConfig,
} from "./auto-depublish";

// ============================================================
// Phase 2: ロングテールキーワード
// ============================================================

export {
  PHASE2_KEYWORDS,
  getPhase2KeywordsByCategory,
  getPhase2KeywordsByIntent,
  getPhase2KeywordsByDifficulty,
  getPhase2KeywordsByVolume,
  getPhase2KeywordById,
} from "./keywords/phase2-keywords";
export type {
  Phase2Keyword,
  SearchIntent as Phase2SearchIntent,
  ArticleType,
} from "./keywords/phase2-keywords";

// ============================================================
// Phase 2: カテゴリ別記事テンプレート
// ============================================================

export { AGA_ARTICLE_TEMPLATE } from "./templates/aga-template";
export type { AGAArticleTemplate, AGATemplateSection } from "./templates/aga-template";

export { ED_ARTICLE_TEMPLATE } from "./templates/ed-template";
export type { EDArticleTemplate, EDTemplateSection } from "./templates/ed-template";

export { HAIR_REMOVAL_ARTICLE_TEMPLATE } from "./templates/hair-removal-template";
export type { HairRemovalArticleTemplate, HairRemovalTemplateSection } from "./templates/hair-removal-template";

export { SKINCARE_ARTICLE_TEMPLATE } from "./templates/skincare-template";
export type { SkincareArticleTemplate, SkincareTemplateSection } from "./templates/skincare-template";

export { SUPPLEMENT_ARTICLE_TEMPLATE } from "./templates/supplement-template";
export type { SupplementArticleTemplate, SupplementTemplateSection } from "./templates/supplement-template";

// ============================================================
// Phase 2: 監修者・参考文献テンプレート
// ============================================================

export {
  getSupervisorTemplateForCategory,
  formatReferences,
  generateUpdateInfo,
  getRecommendedReferencesForCategory,
  getMinimumReferenceCount,
  getAllSupervisorTemplates,
} from "./templates/supervisor-info";
export type {
  SupervisorTemplate,
  FormattedReference,
  UpdateInfo,
} from "./templates/supervisor-info";

// ============================================================
// Phase 3: 免責事項・編集方針テンプレート
// ============================================================

export {
  getDisclaimerTemplate,
  getEditorialPolicyTemplate,
  getPrivacyPolicyTemplate,
  getAffiliateDisclosureTemplate,
  getAllDisclaimerCategories,
  getAllAffiliateDisclosureDepths,
} from "./templates/legal-templates";
export type {
  DisclaimerCategory,
  DisclaimerTemplate,
  EditorialPolicyTemplate,
  PrivacyPolicyTemplate,
  AffiliateDisclosureDepth,
  AffiliateDisclosureTemplate,
} from "./templates/legal-templates";

// ============================================================
// Phase 3: FAQ自動生成
// ============================================================

export {
  generateFAQsForKeyword,
  getAvailableFAQCategories,
  getFAQThemes,
} from "./faq-generator";
export type {
  FAQItem,
  FAQGenerationResult,
} from "./faq-generator";

// ============================================================
// Phase 3: 記事リライト指示テンプレート
// ============================================================

export {
  generateRewritePrompt,
  getRewriteReasonLabel,
  getAllRewriteReasons,
} from "./rewrite-prompts";
export type {
  RewriteReason,
  RewritePromptOptions,
  RewritePromptResult,
} from "./rewrite-prompts";

// ============================================================
// Phase 2: 内部リンク戦略
// ============================================================

export {
  generateInternalLinks,
  suggestRelatedArticles,
  optimizeAnchorText,
  getCategoryLinkRelations,
  analyzeLinkDensity,
} from "./internal-linking";
export type {
  ArticleMeta,
  InternalLink,
  RelatedArticleSuggestion,
  OptimizedAnchorText,
} from "./internal-linking";
