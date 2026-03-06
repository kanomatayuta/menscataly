import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { draftMode } from "next/headers";
import { Badge } from "@/components/ui/Badge";
import { PRDisclosure } from "@/components/compliance/PRDisclosure";
import { AspTrackingScripts } from "@/components/tracking/AspTrackingScripts";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { getArticleBySlug, getAllArticleSlugs, getArticles } from "@/lib/microcms/client";
import {
  generateArticleStructuredData,
  extractFAQsFromContent,
} from "@/lib/seo/structured-data";
import type { MicroCMSArticle } from "@/types/microcms";
import type { ArticleCategory } from "@/components/ui/Badge";
import { ArticleBody } from "@/components/article/ArticleBody";
import { TableOfContents } from "@/components/article/TableOfContents";
import { RelatedArticles } from "@/components/article/RelatedArticles";
import { enrichContentWithAffiliateLinks } from "@/lib/asp/enrich-content";
import { enrichContentWithInternalLinks } from "@/lib/content/enrich-internal-links";
import { HeatmapTracker } from "@/components/HeatmapTracker";
import type { ContentCategory } from "@/types/content";
import { getSupervisorsByCategory } from "@/lib/seo/supervisors-data";

/** thumbnail_url (Cloudinary) → thumbnail (microCMS画像) → null のフォールバック */
function getImageUrl(article: MicroCMSArticle): string | null {
  const url = article.thumbnail_url || article.thumbnail?.url || null;
  if (!url) return null;
  // Cloudinary URL の場合、自動フォーマット・品質最適化・幅指定を付与
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_1200/');
  }
  return url;
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ draftKey?: string }>;
};

// SSG用: microCMSから全スラッグ取得（フォールバック: モック）
export async function generateStaticParams() {
  const slugs = await getAllArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

// ページメタデータ (microCMSデータから動的生成)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: "記事が見つかりません",
    };
  }

  const title = article.seo_title ?? article.title;
  const description = article.seo_description ?? article.excerpt ?? `${article.title} - メンズカタリ`;
  const articleSlug = article.slug ?? article.id;

  return {
    title,
    description,
    alternates: {
      canonical: `/articles/${articleSlug}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      ...(getImageUrl(article) && {
        images: [
          {
            url: getImageUrl(article)!,
            width: article.thumbnail?.width ?? 1200,
            height: article.thumbnail?.height ?? 630,
            alt: article.title,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(getImageUrl(article) && {
        images: [getImageUrl(article)!],
      }),
    },
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * 構造化データ (JSON-LD)
 *
 * MedicalWebPage / Article + BreadcrumbList + FAQPage (自動検出) を
 * @graph で統合出力する。AI Overview 引用対策対応。
 */
function ArticleJsonLd({
  article,
}: {
  article: MicroCMSArticle;
}) {
  // 記事 HTML から FAQ を自動抽出
  const faqs = extractFAQsFromContent(article.content);

  const jsonLd = generateArticleStructuredData(
    article,
    faqs.length > 0 ? faqs : undefined
  );

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
    />
  );
}

/**
 * Draft Mode バナー (動的コンポーネント)
 * draftMode() はダイナミックAPIのため Suspense 内でレンダリング
 */
async function DraftModeBanner() {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
      プレビュー中 (下書き)
      <a
        href="/api/draft-disable"
        className="ml-3 underline hover:no-underline"
      >
        終了
      </a>
    </div>
  );
}

/**
 * 記事コンテンツ部分
 * Suspense でラップして動的フェッチ・searchParams をキャッシュ境界内に隔離
 */
async function ArticleContent({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: Promise<{ draftKey?: string }>;
}) {
  const { draftKey } = await searchParams;
  const article = await getArticleBySlug(slug, draftKey);

  if (!article) {
    notFound();
  }

  const category = (article.category?.slug ?? "aga") as ArticleCategory;

  // カテゴリに対応する監修者を取得（監修者詳細ページへのリンク用）
  const supervisors = getSupervisorsByCategory(category);
  const supervisor = supervisors[0] ?? null;

  // ASPアフィリエイトリンクを動的注入（最新のSupabaseデータを使用）
  const validCategories: ContentCategory[] = ['aga', 'hair-removal', 'skincare', 'ed', 'column']
  const contentCategory = validCategories.includes(category as ContentCategory)
    ? (category as ContentCategory)
    : null
  const afterAffiliateContent = contentCategory
    ? await enrichContentWithAffiliateLinks(article.content, contentCategory)
    : article.content

  // 内部リンクを注入（同カテゴリ + クロスカテゴリの公開済み記事を取得）
  // RelatedArticles コンポーネントと同じデータソースを利用
  let enrichedContent = afterAffiliateContent
  try {
    const relatedResult = await getArticles({
      category,
      limit: 20,
      orders: '-publishedAt',
    })
    const relatedArticles = relatedResult.contents.filter(
      (a) => (a.slug ?? a.id) !== (article.slug ?? article.id)
    )
    if (relatedArticles.length > 0) {
      enrichedContent = enrichContentWithInternalLinks(
        afterAffiliateContent,
        article,
        relatedArticles,
        5
      )
    }
  } catch {
    // 内部リンク注入失敗時はアフィリエイトリンクのみのコンテンツを返す
  }

  return (
    <>
      {/* 構造化データ (JSON-LD) — MedicalWebPage/Article + BreadcrumbList + FAQPage */}
      <ArticleJsonLd article={article} />

      {/* パンくずリスト */}
      <Breadcrumb
        items={[
          { label: "ホーム", href: "/" },
          { label: "記事一覧", href: "/articles" },
          ...(article.category
            ? [
                {
                  label: article.category.name,
                  href: `/articles?category=${category}`,
                },
              ]
            : []),
          { label: article.title },
        ]}
      />

      {/* 記事ヘッダー */}
      <header className="mb-8">
        {/* カテゴリバッジ */}
        <div className="mb-3">
          <Badge category={category} />
        </div>

        {/* タイトル */}
        <h1 className="mb-4 text-2xl font-bold leading-snug text-neutral-900 sm:text-3xl">
          {article.title}
        </h1>

        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
          <time dateTime={article.publishedAt}>
            公開日: {formatDate(article.publishedAt)}
          </time>
          {article.updatedAt && article.updatedAt !== article.publishedAt && (
            <time dateTime={article.updatedAt}>
              最終更新: {formatDate(article.updatedAt)}
            </time>
          )}
        </div>

        {/* 監修者情報 (E-E-A-T対応) — 監修者ページへリンク */}
        {(article.supervisor_name || article.author_name) && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
              aria-hidden="true"
              style={{
                backgroundColor: "var(--color-primary-100, #ccd8ec)",
              }}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                style={{ color: "var(--color-primary-500, #1a365d)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs text-neutral-500">
                {article.supervisor_name ? "監修者" : "執筆"}
              </p>
              <p className="text-sm font-medium text-neutral-800">
                {article.supervisor_name ?? article.author_name}
              </p>
              {article.supervisor_creds && (
                <p className="text-xs text-neutral-500">
                  {article.supervisor_creds}
                </p>
              )}
            </div>
            <Link
              href={supervisor ? `/supervisors/${supervisor.id}` : `/supervisors#${category}`}
              className="ml-auto text-xs text-neutral-500 hover:text-neutral-700 hover:underline"
            >
              {supervisor ? "監修者プロフィール" : "監修者一覧"}
            </Link>
          </div>
        )}
      </header>

      {/* PR表記 (景表法・ステマ規制対応) */}
      {article.is_pr && <PRDisclosure variant="default" className="mb-8" />}

      {/* 記事リード文 */}
      {article.excerpt && (
        <div
          className="mb-8 rounded-lg border-l-4 p-4"
          style={{
            borderColor: "var(--color-primary-500, #1a365d)",
            backgroundColor: "var(--color-primary-50, #eef2f8)",
          }}
        >
          <p className="text-base leading-relaxed text-neutral-700">
            {article.excerpt}
          </p>
        </div>
      )}

      {/* 目次 (TOC) — クライアントサイドでDOMから見出しを読み取りスクロール処理 */}
      <TableOfContents />

      {/* 記事本文 (ASPリンク動的注入済み) */}
      <article>
        <ArticleBody content={enrichedContent} className="max-w-none" />
      </article>

      {/* タグ */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-8 border-t border-neutral-200 pt-6">
          <p className="mb-2 text-sm font-medium text-neutral-700">タグ:</p>
          <ul className="flex flex-wrap gap-2" role="list">
            {article.tags.map((tag) => (
              <li key={tag.id}>
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                  #{tag.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 関連記事 (同カテゴリ) */}
      <Suspense fallback={null}>
        <RelatedArticles
          currentSlug={article.slug ?? article.id}
          category={category}
        />
      </Suspense>

      {/* 免責事項 (YMYL対応) */}
      <aside
        className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
        aria-label="免責事項"
      >
        <h2 className="mb-2 text-sm font-semibold text-neutral-800">
          免責事項
        </h2>
        <p className="text-xs leading-relaxed text-neutral-600">
          本記事は情報提供を目的としており、医療診断・治療の代替となるものではありません。
          症状や治療についてのご判断は、必ず医師・薬剤師等の専門家にご相談ください。
          本記事の内容は公開時点の情報に基づいており、最新情報と異なる場合があります。
        </p>
      </aside>

      {/* ナビゲーション */}
      <nav
        aria-label="記事ナビゲーション"
        className="mt-10 flex items-center justify-between border-t border-neutral-200 pt-6"
      >
        <Link
          href="/articles"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          記事一覧に戻る
        </Link>
        <Link
          href={`/articles?category=${category}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          同カテゴリの記事
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </nav>

      {/* ASP Tracking Scripts (ITP対応) */}
      <Suspense fallback={null}>
        <AspTrackingScripts aspNames={["a8"]} category={category} />
      </Suspense>
    </>
  );
}

export default async function ArticleDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;

  return (
    <div className="bg-white py-8 sm:py-12">
      {/* Heatmap tracker (非表示、クリック/スクロール記録) */}
      <HeatmapTracker articleSlug={slug} />

      {/* Draft Mode バナー (動的、Suspense でラップ) */}
      <Suspense fallback={null}>
        <DraftModeBanner />
      </Suspense>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* 記事コンテンツ (Suspense でラップ — searchParams含む動的処理を隔離) */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <span className="text-sm text-neutral-500">読み込み中...</span>
            </div>
          }
        >
          <ArticleContent slug={slug} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
