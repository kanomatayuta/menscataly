/**
 * 構造化データ生成ユーティリティ (Schema.org JSON-LD)
 *
 * AI Overview引用対策として、各種構造化データを生成する。
 * - MedicalWebPage: 医療コンテンツ (AGA, ED)
 * - FAQPage: FAQ セクション
 * - BreadcrumbList: パンくずリスト
 * - HowTo: 治療ガイド記事
 * - Person: 監修者情報
 *
 * 全スキーマは Schema.org 仕様に準拠。
 */

import type { MicroCMSArticle } from "@/types/microcms";

// ============================================================
// 定数
// ============================================================

const BASE_URL = "https://menscataly.com";

const PUBLISHER = {
  "@type": "Organization" as const,
  name: "メンズカタリ",
  url: BASE_URL,
  logo: {
    "@type": "ImageObject" as const,
    url: `${BASE_URL}/logo.svg`,
  },
};

/** 医療系カテゴリ (MedicalWebPage を適用するカテゴリ) */
const MEDICAL_CATEGORIES = new Set(["aga", "ed"]);

// ============================================================
// 型定義
// ============================================================

/** FAQ アイテム */
export interface FAQItem {
  question: string;
  answer: string;
}

/** HowTo ステップ */
export interface HowToStep {
  name: string;
  text: string;
  url?: string;
  image?: string;
}

/** パンくず要素 */
export interface BreadcrumbItem {
  name: string;
  url: string;
}

// ============================================================
// MedicalWebPage スキーマ生成
// ============================================================

/**
 * MedicalWebPage 構造化データを生成する
 *
 * 医療コンテンツ (AGA, ED) 向けの拡張 Article スキーマ。
 * reviewedBy (監修者) や lastReviewed なども含む。
 *
 * @param article microCMS 記事データ
 * @returns MedicalWebPage JSON-LD オブジェクト
 */
export function generateMedicalWebPageSchema(
  article: MicroCMSArticle
): Record<string, unknown> {
  const slug = article.slug ?? article.id;
  const articleUrl = `${BASE_URL}/articles/${slug}`;
  const categorySlug = article.category?.slug ?? "";
  const isMedical = MEDICAL_CATEGORIES.has(categorySlug);

  const imageObject = getImageObject(article);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": isMedical ? "MedicalWebPage" : "Article",
    "@id": articleUrl,
    headline: article.title,
    description: article.excerpt ?? "",
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    url: articleUrl,
    author: {
      "@type": "Organization",
      name: article.author_name ?? "メンズカタリ編集部",
      url: BASE_URL,
    },
    publisher: PUBLISHER,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
  };

  // 画像
  if (imageObject) {
    schema.image = imageObject;
  }

  // 監修者情報 (reviewedBy)
  if (article.supervisor_name) {
    const reviewer: Record<string, unknown> = {
      "@type": "Person",
      name: article.supervisor_name,
    };
    if (article.supervisor_creds) {
      reviewer.jobTitle = article.supervisor_creds;
    }
    if (article.supervisor_bio) {
      reviewer.description = article.supervisor_bio;
    }
    if (article.supervisor_image?.url) {
      reviewer.image = article.supervisor_image.url;
    }
    schema.reviewedBy = reviewer;
    schema.lastReviewed = article.updatedAt;
  }

  // 医療カテゴリの場合、追加フィールド
  if (isMedical) {
    schema.about = {
      "@type": "MedicalCondition",
      name: categorySlug === "aga" ? "男性型脱毛症（AGA）" : "勃起不全（ED）",
    };
    schema.medicalAudience = {
      "@type": "MedicalAudience",
      audienceType: "患者",
    };
  }

  return schema;
}

// ============================================================
// FAQPage スキーマ生成
// ============================================================

/**
 * FAQPage 構造化データを生成する
 *
 * 記事内の FAQ セクション用。Google 検索のリッチリザルトに対応。
 *
 * @param faqs FAQ アイテムの配列
 * @returns FAQPage JSON-LD オブジェクト
 */
export function generateFAQSchema(
  faqs: FAQItem[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// ============================================================
// BreadcrumbList スキーマ生成
// ============================================================

/**
 * BreadcrumbList 構造化データを生成する
 *
 * @param categorySlug カテゴリスラッグ (例: "aga")
 * @param categoryName カテゴリ表示名 (例: "AGA・薄毛")
 * @param articleTitle 記事タイトル
 * @param articleSlug 記事スラッグ
 * @returns BreadcrumbList JSON-LD オブジェクト
 */
export function generateBreadcrumbSchema(
  categorySlug: string | undefined,
  categoryName: string | undefined,
  articleTitle: string,
  articleSlug: string
): Record<string, unknown> {
  const articleUrl = `${BASE_URL}/articles/${articleSlug}`;
  const items: Record<string, unknown>[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: "ホーム",
      item: BASE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "記事一覧",
      item: `${BASE_URL}/articles`,
    },
  ];

  if (categorySlug && categoryName) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: categoryName,
      item: `${BASE_URL}/articles?category=${categorySlug}`,
    });
    items.push({
      "@type": "ListItem",
      position: 4,
      name: articleTitle,
      item: articleUrl,
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: articleTitle,
      item: articleUrl,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

// ============================================================
// HowTo スキーマ生成
// ============================================================

/**
 * HowTo 構造化データを生成する
 *
 * 治療ガイド記事用。ステップバイステップの手順を構造化。
 *
 * @param title HowTo タイトル
 * @param description HowTo 説明
 * @param steps ステップの配列
 * @returns HowTo JSON-LD オブジェクト
 */
export function generateHowToSchema(
  title: string,
  description: string,
  steps: HowToStep[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: title,
    description,
    step: steps.map((step, index) => {
      const stepSchema: Record<string, unknown> = {
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.text,
      };
      if (step.url) {
        stepSchema.url = step.url;
      }
      if (step.image) {
        stepSchema.image = step.image;
      }
      return stepSchema;
    }),
  };
}

// ============================================================
// Person スキーマ生成
// ============================================================

/**
 * 監修者 (Person) 構造化データを生成する
 *
 * @param name 監修者名
 * @param jobTitle 資格・役職
 * @param description プロフィール
 * @param affiliations 所属組織名の配列
 * @param imageUrl プロフィール画像 URL
 * @returns Person JSON-LD オブジェクト
 */
export function generatePersonSchema(
  name: string,
  jobTitle: string,
  description?: string,
  affiliations?: string[],
  imageUrl?: string
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle,
  };

  if (description) {
    schema.description = description;
  }

  if (imageUrl) {
    schema.image = imageUrl;
  }

  if (affiliations && affiliations.length > 0) {
    schema.memberOf = affiliations.map((org) => ({
      "@type": "Organization",
      name: org,
    }));
  }

  return schema;
}

// ============================================================
// Organization スキーマ生成
// ============================================================

/**
 * Organization 構造化データを生成する (サイト全体)
 *
 * メンズカタリのサイト情報を Organization スキーマとして出力。
 * @graph に含めることで検索エンジンにサイト情報を伝達する。
 *
 * @returns Organization JSON-LD オブジェクト
 */
export function generateOrganizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "メンズカタリ",
    url: BASE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${BASE_URL}/icon`,
    },
    sameAs: [],
  };
}

// ============================================================
// 記事用統合 JSON-LD 生成
// ============================================================

/**
 * 記事用の統合 JSON-LD @graph を生成する
 *
 * MedicalWebPage/Article + BreadcrumbList + Organization を @graph で統合。
 * FAQPage, HowTo は記事コンテンツから自動検出時に追加。
 *
 * @param article microCMS 記事データ
 * @param faqs FAQ アイテム (オプション)
 * @param howToSteps HowTo ステップ (オプション)
 * @returns JSON-LD @graph オブジェクト
 */
export function generateArticleStructuredData(
  article: MicroCMSArticle,
  faqs?: FAQItem[],
  howToSteps?: HowToStep[]
): Record<string, unknown> {
  const slug = article.slug ?? article.id;
  const categorySlug = article.category?.slug;
  const categoryName = article.category?.name;

  const graph: Record<string, unknown>[] = [
    // メインの記事スキーマ (@context は @graph 外で指定)
    stripContext(generateMedicalWebPageSchema(article)),
    // パンくずリスト
    stripContext(
      generateBreadcrumbSchema(categorySlug, categoryName, article.title, slug)
    ),
    // Organization (サイト情報)
    stripContext(generateOrganizationSchema()),
  ];

  // FAQ がある場合
  if (faqs && faqs.length > 0) {
    graph.push(stripContext(generateFAQSchema(faqs)));
  }

  // HowTo ステップがある場合 (治療ガイド記事)
  if (howToSteps && howToSteps.length > 0) {
    const articleType = article.article_type ?? "";
    const isGuide =
      articleType.includes("ガイド") || articleType.includes("まとめ");
    if (isGuide || howToSteps.length > 0) {
      graph.push(
        stripContext(
          generateHowToSchema(
            article.title,
            article.excerpt ?? "",
            howToSteps
          )
        )
      );
    }
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

// ============================================================
// 記事コンテンツからの FAQ 自動抽出
// ============================================================

/**
 * 記事 HTML コンテンツから FAQ を自動抽出する
 *
 * FAQ セクション (h2/h3 で「よくある質問」「Q&A」等のパターン) を検出し、
 * Q&A ペアを抽出する。
 *
 * @param htmlContent 記事 HTML コンテンツ
 * @returns 抽出された FAQ アイテムの配列
 */
export function extractFAQsFromContent(htmlContent: string): FAQItem[] {
  const faqs: FAQItem[] = [];

  // パターン1: <h3>Q. 質問</h3> <p>回答</p>
  const qPattern = /<h[23][^>]*>(?:Q[\.\s:：]?\s*|質問[\s:：]?\s*)(.+?)<\/h[23]>\s*(?:<p[^>]*>(.+?)<\/p>)/gi;
  let match: RegExpExecArray | null;
  while ((match = qPattern.exec(htmlContent)) !== null) {
    const question = stripHtmlTags(match[1]).trim();
    const answer = stripHtmlTags(match[2]).trim();
    if (question && answer) {
      faqs.push({ question, answer });
    }
  }

  // パターン2: <dt>質問</dt><dd>回答</dd> (定義リスト形式)
  if (faqs.length === 0) {
    const dlPattern = /<dt[^>]*>(.+?)<\/dt>\s*<dd[^>]*>(.+?)<\/dd>/gi;
    while ((match = dlPattern.exec(htmlContent)) !== null) {
      const question = stripHtmlTags(match[1]).trim();
      const answer = stripHtmlTags(match[2]).trim();
      if (question && answer) {
        faqs.push({ question, answer });
      }
    }
  }

  return faqs;
}

// ============================================================
// ヘルパー
// ============================================================

/** HTMLタグを除去する */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/** @context キーを除去する (graph 統合時に外側で一度だけ指定するため) */
function stripContext(
  schema: Record<string, unknown>
): Record<string, unknown> {
  const { "@context": _, ...rest } = schema;
  return rest;
}

/** 記事の画像オブジェクトを取得する */
function getImageObject(
  article: MicroCMSArticle
): Record<string, unknown> | null {
  const imageUrl =
    article.thumbnail_url || article.thumbnail?.url || null;
  if (!imageUrl) return null;

  return {
    "@type": "ImageObject",
    url: imageUrl,
    width: article.thumbnail?.width ?? 1200,
    height: article.thumbnail?.height ?? 630,
  };
}
