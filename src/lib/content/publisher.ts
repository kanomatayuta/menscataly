/**
 * 記事公開ヘルパー
 * 生成済み記事を microCMS に投稿し、公開ステータスを管理する
 * 環境変数未設定時はドライラン（コンソール出力のみ）
 */

import type { Article, ContentCategory, Reference } from "@/types/content";
import { ImagePipeline } from "@/lib/image/pipeline";

// ============================================================
// microCMS スキーママッピング
// ============================================================

/** microCMS API のベースURL を生成する */
function getMicroCMSApiBase(serviceDomain: string): string {
  return `https://${serviceDomain}.microcms.io/api/v1`;
}

/** 公開ステータス */
export type PublishStatus = "draft" | "published";

/** 公開オプション */
export interface PublishOptions {
  /** 公開ステータス（デフォルト: draft） */
  status?: PublishStatus;
  /** 公開日時（ISO 8601形式、省略時は即時公開） */
  scheduledAt?: string;
}

/** 公開結果 */
export interface PublishResult {
  /** microCMS コンテンツID */
  contentId: string;
  /** 公開URL（スラッグベース） */
  url: string;
  /** 公開ステータス */
  status: PublishStatus;
  /** 投稿日時（ISO 8601形式） */
  publishedAt: string;
  /** ドライランかどうか */
  isDryRun: boolean;
}

// ============================================================
// 変換ヘルパー
// ============================================================

/** ContentCategory → デフォルト article_type マッピング */
const CATEGORY_ARTICLE_TYPE_MAP: Record<ContentCategory, string> = {
  aga: "クリニック比較",
  "hair-removal": "クリニック比較",
  skincare: "ロングテール",
  ed: "クリニック比較",
  column: "コラム",
};

/** ContentCategory → デフォルト disclaimer_type マッピング */
const CATEGORY_DISCLAIMER_MAP: Record<ContentCategory, string> = {
  aga: "医療行為に関する免責",
  "hair-removal": "医療行為に関する免責",
  skincare: "化粧品・効果の免責",
  ed: "医療行為に関する免責",
  column: "免責なし",
};

/** ContentCategory → microCMS カテゴリスラッグ */
const CATEGORY_SLUG_MAP: Record<ContentCategory, string> = {
  aga: "aga",
  "hair-removal": "hair-removal",
  skincare: "skincare",
  ed: "ed",
  column: "column",
};

/**
 * PR表記プレースホルダーをクリーンアップする
 */
function cleanPRPlaceholder(text: string): string {
  return text
    .replace(/\{\{PR_DISCLOSURE\}\}/g, "")
    .replace(/^\s*\n/gm, "")
    .trim();
}

/**
 * 参考文献を microCMS 繰り返しフィールド形式に変換する
 */
function referencesToMicroCMS(refs: Reference[]): Record<string, unknown>[] {
  return refs.map((ref) => ({
    fieldId: "references",
    ref_title: ref.title,
    ref_url: ref.url || "",
    ref_publisher: ref.source || ref.author || "",
    ref_year: ref.year ? String(ref.year) : "",
  }));
}

/**
 * セクションの content を改行で <p> タグに分割する
 * 空の <p></p> を生成しないよう、空行をフィルタリングする
 */
function contentToParagraphs(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${line}</p>`)
    .join("\n");
}

/**
 * Article 型を microCMS のリクエストボディに変換する
 */
function articleToMicroCMSBody(article: Article): Record<string, unknown> {
  // セクションを HTML に変換（microCMS はリッチテキストHTMLを受け付ける）
  let sectionsHtml: string;

  if (article.sections.length > 0) {
    sectionsHtml = article.sections
      .map((section) => {
        const levelTag = section.level;
        const subsectionsHtml =
          section.subsections
            ?.map(
              (sub) =>
                `<${sub.level}>${sub.heading}</${sub.level}>\n${contentToParagraphs(sub.content)}`
            )
            .join("\n") ?? "";

        return `<${levelTag}>${section.heading}</${levelTag}>\n${contentToParagraphs(section.content)}\n${subsectionsHtml}`;
      })
      .join("\n");
  } else if (article.content) {
    // sections が空の場合は article.content (Markdown) をフォールバックとして使用
    console.warn("[ArticlePublisher] sections is empty, using article.content as fallback");
    // Markdown を基本的な HTML に変換
    sectionsHtml = article.content
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        if (trimmed.startsWith("## ")) return `<h2>${trimmed.slice(3)}</h2>`;
        if (trimmed.startsWith("### ")) return `<h3>${trimmed.slice(4)}</h3>`;
        if (trimmed.startsWith("#### ")) return `<h4>${trimmed.slice(5)}</h4>`;
        return `<p>${trimmed}</p>`;
      })
      .filter((line) => line.length > 0)
      .join("\n");
  } else {
    console.error("[ArticlePublisher] Both sections and content are empty!");
    sectionsHtml = "";
  }

  // PR表記をリード文の先頭に付加
  const prDisclosure = article.hasPRDisclosure
    ? '<p class="pr-disclosure">※本記事はアフィリエイト広告を含みます。</p>\n'
    : "";

  // リード文から {{PR_DISCLOSURE}} プレースホルダーを除去
  const cleanLead = cleanPRPlaceholder(article.lead);
  const cleanExcerpt = cleanPRPlaceholder(cleanLead).slice(0, 160);

  const fullHtml = `${prDisclosure}<p>${cleanLead}</p>\n\n${sectionsHtml}`;

  const body: Record<string, unknown> = {
    title: article.title,
    slug: article.slug,
    content: fullHtml,
    excerpt: cleanExcerpt,
    seo_title: article.seo.title,
    author_name: article.author.name,
    article_type: [CATEGORY_ARTICLE_TYPE_MAP[article.category]],
    disclaimer_type: [CATEGORY_DISCLAIMER_MAP[article.category]],
    is_pr: article.hasPRDisclosure,
    compliance_score: article.complianceScore ?? 0,
    reading_time: article.readingTime ?? 0,
    // ターゲットキーワード
    target_keyword: article.seo.keywords[0] ?? "",
    // 監修者情報
    ...(article.supervisor && {
      supervisor_name: article.supervisor.name,
      supervisor_creds: article.supervisor.credentials,
      supervisor_bio: article.supervisor.bio,
    }),
  };

  // 参考文献 (繰り返しフィールド)
  if (article.references.length > 0) {
    body.references = referencesToMicroCMS(article.references);
  }

  return body;
}

// ============================================================
// ドライランロガー
// ============================================================

function logDryRun(article: Article, status: PublishStatus): void {
  console.info("============================================================");
  console.info("[ArticlePublisher] DRY RUN — microCMS への投稿はスキップされました");
  console.info("============================================================");
  console.info(`タイトル    : ${article.title}`);
  console.info(`スラッグ    : ${article.slug}`);
  console.info(`カテゴリ    : ${article.category}`);
  console.info(`ステータス  : ${status}`);
  console.info(`PR表記      : ${article.hasPRDisclosure ? "あり" : "なし"}`);
  console.info(`準拠スコア  : ${article.complianceScore ?? "N/A"}`);
  console.info(`公開日      : ${article.publishedAt}`);
  console.info(`読了時間    : ${article.readingTime ?? "N/A"}分`);
  console.info(`著者        : ${article.author.name}`);
  console.info(`監修者      : ${article.supervisor?.name ?? "未設定"}`);
  console.info(`参考文献数  : ${article.references.length}件`);
  console.info("============================================================");
}

// ============================================================
// ArticlePublisher クラス
// ============================================================

export class ArticlePublisher {
  private readonly isDryRun: boolean;
  private readonly serviceDomain: string | undefined;
  private readonly apiKey: string | undefined;
  private readonly imagePipeline: ImagePipeline;

  constructor() {
    this.serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
    this.apiKey = process.env.MICROCMS_API_KEY;
    this.isDryRun = !this.serviceDomain || !this.apiKey;
    this.imagePipeline = new ImagePipeline();
  }

  /**
   * 記事のサムネイル画像を AI で自動生成する
   * Ideogram API → Cloudinary → OG画像URL を返す
   * API未設定時はプレースホルダーURLを返す
   */
  async generateThumbnail(article: Article): Promise<string | null> {
    try {
      console.info(`[ArticlePublisher] Generating thumbnail for: "${article.title}"`);
      const images = await this.imagePipeline.processArticleImage({
        title: article.title,
        category: article.category,
        slug: article.slug,
      });
      console.info(`[ArticlePublisher] Thumbnail generated: ${images.og.url}`);
      return images.og.url;
    } catch (error) {
      console.warn("[ArticlePublisher] Thumbnail generation failed, no thumbnail will be set:", error);
      return null;
    }
  }

  /**
   * microCMS のカテゴリAPIからスラッグでカテゴリIDを検索する
   */
  private async findCategoryId(categorySlug: string): Promise<string | null> {
    const apiBase = getMicroCMSApiBase(this.serviceDomain!);
    try {
      const res = await fetch(
        `${apiBase}/categories?filters=slug[equals]${categorySlug}&limit=1&fields=id`,
        { headers: { "X-MICROCMS-API-KEY": this.apiKey! } }
      );
      if (!res.ok) return null;
      const data = await res.json() as { contents: { id: string }[] };
      return data.contents[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * microCMS のタグAPIでタグを検索し、なければ作成する
   * @returns タグIDの配列
   */
  private async resolveTagIds(tagNames: string[]): Promise<string[]> {
    if (tagNames.length === 0) return [];
    const apiBase = getMicroCMSApiBase(this.serviceDomain!);
    const ids: string[] = [];

    // 上位5つのタグのみ処理（API負荷軽減）
    const tagsToProcess = tagNames.slice(0, 5);

    for (const name of tagsToProcess) {
      try {
        // 既存タグを検索
        const searchRes = await fetch(
          `${apiBase}/tags?filters=name[equals]${encodeURIComponent(name)}&limit=1&fields=id`,
          { headers: { "X-MICROCMS-API-KEY": this.apiKey! } }
        );
        if (searchRes.ok) {
          const data = await searchRes.json() as { contents: { id: string }[] };
          if (data.contents[0]) {
            ids.push(data.contents[0].id);
            continue;
          }
        }

        // タグが見つからない場合は新規作成
        const slug = name
          .toLowerCase()
          .replace(/[\s　]+/g, "-")
          .replace(/[^a-z0-9\u3000-\u9fff\uff00-\uffef-]/g, "")
          .slice(0, 50);

        const createRes = await fetch(`${apiBase}/tags`, {
          method: "POST",
          headers: {
            "X-MICROCMS-API-KEY": this.apiKey!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, slug }),
        });
        if (createRes.ok) {
          const created = await createRes.json() as { id: string };
          ids.push(created.id);
          console.info(`[ArticlePublisher] Created tag: "${name}" (${created.id})`);
        }
      } catch (err) {
        console.warn(`[ArticlePublisher] Failed to resolve tag "${name}":`, err);
      }
    }

    return ids;
  }

  /**
   * 記事を microCMS に投稿する
   */
  async publishToMicroCMS(
    article: Article,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    const status: PublishStatus = options.status ?? "draft";
    const now = new Date().toISOString();

    if (this.isDryRun) {
      logDryRun(article, status);
      return {
        contentId: `dry-run-${Date.now()}`,
        url: `https://menscataly.com/articles/${article.slug}`,
        status,
        publishedAt: now,
        isDryRun: true,
      };
    }

    // ----------------------------------------------------------------
    // サムネイル自動生成 (Ideogram → Cloudinary)
    // ----------------------------------------------------------------
    const thumbnailUrl = await this.generateThumbnail(article);

    // ----------------------------------------------------------------
    // カテゴリID検索
    // ----------------------------------------------------------------
    const categorySlug = CATEGORY_SLUG_MAP[article.category];
    const categoryId = await this.findCategoryId(categorySlug);
    if (categoryId) {
      console.info(`[ArticlePublisher] Category resolved: ${categorySlug} → ${categoryId}`);
    }

    // ----------------------------------------------------------------
    // タグID解決（検索 or 新規作成）
    // ----------------------------------------------------------------
    const tagIds = await this.resolveTagIds(article.tags ?? []);

    // ----------------------------------------------------------------
    // microCMS API へ投稿
    // ----------------------------------------------------------------
    const body = articleToMicroCMSBody(article);

    // thumbnail_url フィールドに画像URL を設定
    if (thumbnailUrl) {
      body.thumbnail_url = thumbnailUrl;
    }

    // カテゴリ（コンテンツ参照フィールド — IDで渡す）
    if (categoryId) {
      body.category = categoryId;
    }

    // タグ（複数コンテンツ参照 — ID配列で渡す）
    if (tagIds.length > 0) {
      body.tags = tagIds;
    }

    const apiBase = getMicroCMSApiBase(this.serviceDomain!);
    const endpoint = `${apiBase}/articles`;

    console.info(
      `[ArticlePublisher] Posting article to microCMS: "${article.title}" (status: ${status})`
    );

    const isUpdate = Boolean(article.id);
    const method = isUpdate ? "PATCH" : "POST";
    const url = isUpdate ? `${endpoint}/${article.id}` : endpoint;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-MICROCMS-API-KEY": this.apiKey!,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[ArticlePublisher] microCMS API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const responseData = await response.json() as { id?: string };
    const contentId = responseData.id ?? article.id ?? article.slug;

    console.info(
      `[ArticlePublisher] Successfully posted article. contentId: ${contentId}`
    );

    return {
      contentId,
      url: `https://menscataly.com/articles/${article.slug}`,
      status,
      publishedAt: now,
      isDryRun: false,
    };
  }

  /**
   * 記事のステータスを更新する（draft → published など）
   */
  async updateStatus(contentId: string, status: PublishStatus): Promise<void> {
    if (this.isDryRun) {
      console.info(
        `[ArticlePublisher] DRY RUN — Would update status of contentId "${contentId}" to "${status}"`
      );
      return;
    }

    const apiBase = getMicroCMSApiBase(this.serviceDomain!);
    const response = await fetch(
      `${apiBase}/articles/${contentId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-MICROCMS-API-KEY": this.apiKey!,
        },
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[ArticlePublisher] Failed to update status: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    console.info(
      `[ArticlePublisher] Updated status of contentId "${contentId}" to "${status}"`
    );
  }

  /**
   * 記事を削除する
   */
  async deleteArticle(contentId: string): Promise<void> {
    if (this.isDryRun) {
      console.info(
        `[ArticlePublisher] DRY RUN — Would delete contentId "${contentId}"`
      );
      return;
    }

    const apiBase = getMicroCMSApiBase(this.serviceDomain!);
    const response = await fetch(
      `${apiBase}/articles/${contentId}`,
      {
        method: "DELETE",
        headers: {
          "X-MICROCMS-API-KEY": this.apiKey!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[ArticlePublisher] Failed to delete article: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    console.info(
      `[ArticlePublisher] Deleted contentId "${contentId}" from microCMS`
    );
  }
}
