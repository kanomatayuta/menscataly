/**
 * 記事公開ヘルパー
 * 生成済み記事を microCMS に投稿し、公開ステータスを管理する
 * 環境変数未設定時はドライラン（コンソール出力のみ）
 */

import type { Article, ContentCategory } from "@/types/content";
import type { MicroCMSArticle } from "@/types/microcms";

// ============================================================
// microCMS スキーママッピング
// ============================================================

/** microCMS API のベースURL */
const MICROCMS_API_BASE = "https://content.microcms.io/api/v1";

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

/** ContentCategory を microCMS カテゴリIDにマップ */
const CATEGORY_ID_MAP: Record<ContentCategory, string> = {
  aga: "aga",
  "hair-removal": "hair-removal",
  skincare: "skincare",
  ed: "ed",
  column: "column",
};

/**
 * Article 型を microCMS のリクエストボディに変換する
 */
function articleToMicroCMSBody(
  article: Article,
  status: PublishStatus
): Partial<MicroCMSArticle> & Record<string, unknown> {
  // セクションを HTML に変換（microCMS はリッチテキストHTMLを受け付ける）
  const sectionsHtml = article.sections
    .map((section) => {
      const levelTag = section.level; // h2, h3, h4
      const subsectionsHtml =
        section.subsections
          ?.map(
            (sub) =>
              `<${sub.level}>${sub.heading}</${sub.level}>\n<p>${sub.content.replace(/\n/g, "</p><p>")}</p>`
          )
          .join("\n") ?? "";

      return `<${levelTag}>${section.heading}</${levelTag}>\n<p>${section.content.replace(/\n/g, "</p><p>")}</p>\n${subsectionsHtml}`;
    })
    .join("\n");

  // PR表記をリード文の先頭に付加
  const prDisclosure = article.hasPRDisclosure
    ? '<p class="pr-disclosure">※本記事はアフィリエイト広告を含みます。</p>\n'
    : "";

  const fullHtml = `${prDisclosure}<p>${article.lead}</p>\n\n${sectionsHtml}`;

  return {
    title: article.title,
    slug: article.slug,
    content: fullHtml,
    excerpt: article.lead,
    seo_title: article.seo.title,
    author_name: article.author.name,
    // tags は microCMS 複数コンテンツ参照 — 投稿時はタグIDの配列が必要
    // TODO: タグ名→タグID変換ロジックを実装 (getTags() でID解決)
    // 現時点ではタグフィールドは投稿時に除外し、管理画面で設定する運用
    status,
    is_pr: article.hasPRDisclosure,
    // カテゴリは参照フィールドのためIDで渡す
    category: CATEGORY_ID_MAP[article.category] as unknown as undefined,
  };
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
  console.info("------------------------------------------------------------");
  console.info("SEO:");
  console.info(`  タイトル      : ${article.seo.title}`);
  console.info(`  ディスクリプション: ${article.seo.description}`);
  console.info(`  キーワード    : ${article.seo.keywords.join(", ")}`);
  console.info("============================================================");
}

// ============================================================
// ArticlePublisher クラス
// ============================================================

/**
 * 記事公開ヘルパー
 *
 * @example
 * ```ts
 * const publisher = new ArticlePublisher();
 *
 * // draft として投稿
 * const result = await publisher.publishToMicroCMS(article, { status: "draft" });
 * console.log(result.contentId); // microCMS コンテンツID
 *
 * // 環境変数未設定時はドライランとなりコンソール出力のみ
 * console.log(result.isDryRun); // true
 * ```
 */
export class ArticlePublisher {
  private readonly isDryRun: boolean;
  private readonly serviceDomain: string | undefined;
  private readonly apiKey: string | undefined;

  constructor() {
    this.serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
    this.apiKey = process.env.MICROCMS_API_KEY;
    this.isDryRun = !this.serviceDomain || !this.apiKey;
  }

  /**
   * 記事を microCMS に投稿する
   * 環境変数が未設定の場合はドライラン（コンソール出力のみ）
   *
   * @param article 投稿する記事データ
   * @param options 公開オプション
   * @returns 公開結果（コンテンツIDなど）
   */
  async publishToMicroCMS(
    article: Article,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    const status: PublishStatus = options.status ?? "draft";
    const now = new Date().toISOString();

    // ----------------------------------------------------------------
    // ドライランモード: コンソール出力のみ
    // ----------------------------------------------------------------
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
    // microCMS API へ投稿
    // ----------------------------------------------------------------
    const body = articleToMicroCMSBody(article, status);
    const endpoint = `${MICROCMS_API_BASE}/articles`;

    console.info(
      `[ArticlePublisher] Posting article to microCMS: "${article.title}" (status: ${status})`
    );

    // スラッグをコンテンツIDとして使用するか、新規作成するかを判定
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

    // ----------------------------------------------------------------
    // 公開スケジュールが指定されている場合のみステータス更新
    // ----------------------------------------------------------------
    if (status === "published" && options.scheduledAt) {
      console.info(
        `[ArticlePublisher] Scheduling publication for: ${options.scheduledAt}`
      );
      // microCMS の予約公開はダッシュボードUIから設定するため、ここではログのみ
    }

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
   *
   * @param contentId microCMS コンテンツID
   * @param status 新しいステータス
   */
  async updateStatus(contentId: string, status: PublishStatus): Promise<void> {
    if (this.isDryRun) {
      console.info(
        `[ArticlePublisher] DRY RUN — Would update status of contentId "${contentId}" to "${status}"`
      );
      return;
    }

    const response = await fetch(
      `${MICROCMS_API_BASE}/articles/${contentId}`,
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
   *
   * @param contentId 削除する microCMS コンテンツID
   */
  async deleteArticle(contentId: string): Promise<void> {
    if (this.isDryRun) {
      console.info(
        `[ArticlePublisher] DRY RUN — Would delete contentId "${contentId}"`
      );
      return;
    }

    const response = await fetch(
      `${MICROCMS_API_BASE}/articles/${contentId}`,
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
