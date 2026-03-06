import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
import { ArticleSidebar } from "@/components/article/ArticleSidebar";
import { AdSidebar } from "@/components/article/AdSidebar";
import { ShareButtons } from "@/components/article/ShareButtons";
import { formatDate, getImageUrl, hasAffiliateLinks, estimateReadingTime } from "@/lib/utils/article";

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
      {/* 構造化データ (JSON-LD) */}
      <ArticleJsonLd article={article} />

      {/* PR表記 (景表法・ステマ規制対応) — is_prフラグ OR コンテンツ内にアフィリエイトリンク存在で表示 */}
      {(article.is_pr || hasAffiliateLinks(enrichedContent)) && (
        <PRDisclosure variant="default" className="mb-6" />
      )}

      {/* 目次 (TOC) — モバイルのみ表示 */}
      <div className="lg:hidden">
        <TableOfContents />
      </div>

      {/* 記事本文 (ASPリンク動的注入済み) */}
      <article>
        <ArticleBody content={enrichedContent} className="max-w-none" />
      </article>

      {/* 関連記事 (同カテゴリ) */}
      <Suspense fallback={null}>
        <RelatedArticles
          currentSlug={article.slug ?? article.id}
          category={category}
        />
      </Suspense>

      {/* 免責事項 (YMYL対応) */}
      <aside
        className="mt-10 rounded-r-lg border-l-4 border-amber-500 bg-amber-50 p-4"
        aria-label="免責事項"
      >
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-800">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          免責事項
        </h2>
        <p className="text-sm leading-relaxed text-amber-900/80">
          本記事は情報提供を目的としており、医療診断・治療の代替となるものではありません。
          症状や治療についてのご判断は、必ず医師・薬剤師等の専門家にご相談ください。
          本記事の内容は公開時点の情報に基づいており、最新情報と異なる場合があります。
        </p>
      </aside>

      {/* ナビゲーション */}
      <nav
        aria-label="記事ナビゲーション"
        className="mt-10 flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:flex-row sm:items-center sm:justify-between"
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

  const article = await getArticleBySlug(slug);
  const category = (article?.category?.slug ?? "aga") as string;
  const supervisors = getSupervisorsByCategory(category);
  const supervisor = supervisors[0] ?? null;

  return (
    <div className="bg-white py-8 sm:py-12">
      <HeatmapTracker articleSlug={slug} />

      <Suspense fallback={null}>
        <DraftModeBanner />
      </Suspense>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-screen-2xl">
        {/* パンくずリスト */}
        {article && (
          <Breadcrumb
            items={[
              { label: "ホーム", href: "/" },
              { label: "記事一覧", href: "/articles" },
              ...(article.category
                ? [{ label: article.category.name, href: `/articles?category=${category}` }]
                : []),
              { label: article.title },
            ]}
          />
        )}

        {/* ヒーロー: サムネイル左 + メタ情報右 (グリッドの上、フルワイド) */}
        {article && (
          <header className="mb-8">
            <div className="article-hero">
              {getImageUrl(article) && (
                <div className="article-hero-image">
                  <Image
                    src={getImageUrl(article)!}
                    alt={article.title}
                    width={article.thumbnail?.width ?? 1200}
                    height={article.thumbnail?.height ?? 630}
                    className="w-full h-full object-cover rounded-lg"
                    priority
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 720px"
                  />
                </div>
              )}
              <div className="article-hero-meta">
                <div className="mb-2">
                  <Badge category={category as ArticleCategory} />
                </div>
                <h1 className="mb-2 text-lg font-bold leading-snug text-neutral-900 sm:text-xl lg:text-2xl">
                  {article.title}
                </h1>
                {article.tags && article.tags.length > 0 && (
                  <ul className="mb-3 flex flex-wrap gap-1.5" role="list">
                    {article.tags.map((tag) => (
                      <li key={tag.id}>
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600">
                          #{tag.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500 mb-3">
                  <time dateTime={article.publishedAt}>
                    公開日: {formatDate(article.publishedAt)}
                  </time>
                  {article.updatedAt && article.updatedAt !== article.publishedAt && (
                    <time dateTime={article.updatedAt}>
                      最終更新: {formatDate(article.updatedAt)}
                    </time>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    約{estimateReadingTime(article)}分で読めます
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-wrap">
                  {(article.supervisor_name || article.author_name) && (
                    <div className="flex items-center gap-3 rounded-lg bg-neutral-50 p-2.5">
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                        aria-hidden="true"
                        style={{ backgroundColor: "var(--color-primary-100, #ccd8ec)" }}
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: "var(--color-primary-500, #1a365d)" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.65rem] text-neutral-500">
                          {article.supervisor_name ? "監修者" : "執筆"}
                        </p>
                        <Link
                          href={supervisor ? `/supervisors/${supervisor.id}` : `/supervisors#${category}`}
                          className="text-sm font-medium text-neutral-800 hover:text-primary-600 hover:underline"
                        >
                          {article.supervisor_name ?? article.author_name}
                        </Link>
                        {article.supervisor_creds && (
                          <p className="text-[0.65rem] text-neutral-500">{article.supervisor_creds}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* SNSシェアボタン */}
                  <ShareButtons title={article.title} />
                </div>
              </div>
            </div>
          </header>
        )}

        {/* 3カラム: 左TOC + 記事本文 + 右広告 */}
        <div className="article-layout">
          <Suspense fallback={null}>
            <ArticleSidebar
              category={category}
              supervisorName={article?.supervisor_name}
              supervisorCreds={article?.supervisor_creds}
            />
          </Suspense>

          <div className="min-w-0">
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

          <Suspense fallback={null}>
            <AdSidebar category={category} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
