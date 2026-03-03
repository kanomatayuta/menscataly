import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { draftMode } from "next/headers";
import { Badge } from "@/components/ui/Badge";
import { PRDisclosure } from "@/components/compliance/PRDisclosure";
import { AspTrackingScripts } from "@/components/tracking/AspTrackingScripts";
import { getArticleBySlug, getAllArticleSlugs } from "@/lib/microcms/client";
import type { MicroCMSArticle } from "@/types/microcms";
import type { ArticleCategory } from "@/components/ui/Badge";

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
  const description = article.seo_description ?? article.excerpt ?? "";
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
      ...(article.thumbnail && {
        images: [
          {
            url: article.thumbnail.url,
            width: article.thumbnail.width,
            height: article.thumbnail.height,
            alt: title,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(article.thumbnail && {
        images: [article.thumbnail.url],
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
 * Article schema + BreadcrumbList の JSON-LD 構造化データ
 */
function ArticleJsonLd({
  article,
  slug,
}: {
  article: MicroCMSArticle;
  slug: string;
}) {
  const baseUrl = "https://menscataly.com";
  const articleUrl = `${baseUrl}/articles/${slug}`;
  const categorySlug = article.category?.slug ?? "";
  const categoryName = article.category?.name ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": articleUrl,
        headline: article.title,
        description: article.excerpt ?? "",
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        url: articleUrl,
        author: {
          "@type": "Organization",
          name: article.author_name ?? "メンズカタリ編集部",
          url: baseUrl,
        },
        publisher: {
          "@type": "Organization",
          name: "メンズカタリ",
          url: baseUrl,
          logo: {
            "@type": "ImageObject",
            url: `${baseUrl}/logo.png`,
          },
        },
        ...(article.thumbnail && {
          image: {
            "@type": "ImageObject",
            url: article.thumbnail.url,
            width: article.thumbnail.width,
            height: article.thumbnail.height,
          },
        }),
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": articleUrl,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "ホーム",
            item: baseUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "記事一覧",
            item: `${baseUrl}/articles`,
          },
          ...(categorySlug
            ? [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: categoryName,
                  item: `${baseUrl}/articles?category=${categorySlug}`,
                },
                {
                  "@type": "ListItem",
                  position: 4,
                  name: article.title,
                  item: articleUrl,
                },
              ]
            : [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: article.title,
                  item: articleUrl,
                },
              ]),
        ],
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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

  const articleSlug = article.slug ?? article.id;
  const category = (article.category?.slug ?? "aga") as ArticleCategory;

  return (
    <>
      {/* 構造化データ (JSON-LD) */}
      <ArticleJsonLd article={article} slug={articleSlug} />

      {/* パンくずリスト */}
      <nav aria-label="パンくずリスト" className="mb-6">
        <ol
          className="flex flex-wrap items-center gap-1 text-sm text-neutral-500"
          role="list"
        >
          <li>
            <Link href="/" className="hover:text-neutral-700 hover:underline">
              ホーム
            </Link>
          </li>
          <li aria-hidden="true">
            <span>/</span>
          </li>
          <li>
            <Link
              href="/articles"
              className="hover:text-neutral-700 hover:underline"
            >
              記事一覧
            </Link>
          </li>
          <li aria-hidden="true">
            <span>/</span>
          </li>
          <li>
            <Link
              href={`/articles?category=${category}`}
              className="hover:text-neutral-700 hover:underline"
            >
              <Badge category={category} />
            </Link>
          </li>
          <li aria-hidden="true">
            <span>/</span>
          </li>
          <li>
            <span className="text-neutral-700" aria-current="page">
              {article.title}
            </span>
          </li>
        </ol>
      </nav>

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

        {/* 監修者情報 (E-E-A-T対応) */}
        {article.author_name && (
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
              <p className="text-xs text-neutral-500">監修者</p>
              <p className="text-sm font-medium text-neutral-800">
                {article.author_name}
              </p>
            </div>
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

      {/* 記事本文 */}
      <article className="prose prose-neutral max-w-none">
        <div
          dangerouslySetInnerHTML={{ __html: article.content }}
          className="leading-relaxed"
        />
      </article>

      {/* タグ */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-8 border-t border-neutral-200 pt-6">
          <p className="mb-2 text-sm font-medium text-neutral-700">タグ:</p>
          <ul className="flex flex-wrap gap-2" role="list">
            {article.tags.map((tag) => (
              <li key={tag}>
                <span className="inline-flex items-center rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
                  #{tag}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        <AspTrackingScripts aspNames={["afb", "a8"]} category={category} />
      </Suspense>
    </>
  );
}

export default async function ArticleDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;

  return (
    <div className="bg-white py-8 sm:py-12">
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
