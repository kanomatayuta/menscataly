import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { draftMode } from "next/headers";
import { Badge } from "@/components/ui/Badge";
import { PRDisclosure } from "@/components/compliance/PRDisclosure";
import { ArticleBody } from "@/components/article/ArticleBody";
import { AspTrackingScripts } from "@/components/tracking/AspTrackingScripts";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { getArticleBySlug, getAllArticleSlugs } from "@/lib/microcms/client";
import {
  generateArticleStructuredData,
  extractFAQsFromContent,
} from "@/lib/seo/structured-data";
import type { MicroCMSArticle } from "@/types/microcms";
import type { ArticleCategory } from "@/components/ui/Badge";

/** thumbnail_url (Cloudinary) → thumbnail (microCMS画像) → null のフォールバック */
function getImageUrl(article: MicroCMSArticle): string | null {
  return article.thumbnail_url || article.thumbnail?.url || null;
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
  const description = article.excerpt ?? "";
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
            alt: title,
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
      <header className="mb-10">
        {/* カテゴリバッジ */}
        <div className="mb-4">
          <Badge category={category} />
        </div>

        {/* タイトル */}
        <h1 className="mb-5 text-2xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl">
          {article.title}
        </h1>

        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
          <time dateTime={article.publishedAt} className="inline-flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(article.publishedAt)}
          </time>
          {article.updatedAt && article.updatedAt !== article.publishedAt && (
            <time dateTime={article.updatedAt} className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {formatDate(article.updatedAt)}
            </time>
          )}
          {article.reading_time && (
            <span className="inline-flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {article.reading_time}分で読めます
            </span>
          )}
        </div>

        {/* 監修者情報 (E-E-A-T対応) — 監修者ページへリンク */}
        {(article.supervisor_name || article.author_name) && (
          <div
            className="mt-6 flex items-center gap-3 rounded-lg border p-4"
            style={{
              borderColor: "var(--color-primary-100, #ccd8ec)",
              backgroundColor: "var(--color-primary-50, #eef2f8)",
            }}
          >
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
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
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-neutral-500">
                {article.supervisor_name ? "医師監修" : "執筆"}
              </p>
              <p className="text-sm font-semibold text-neutral-800">
                {article.supervisor_name ?? article.author_name}
              </p>
              {article.supervisor_creds && (
                <p className="text-xs text-neutral-500">
                  {article.supervisor_creds}
                </p>
              )}
            </div>
            <Link
              href={`/supervisors#${category}`}
              className="flex-shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-white hover:text-neutral-900"
              style={{ borderColor: "var(--color-primary-200, #99b1d9)" }}
            >
              監修者一覧
            </Link>
          </div>
        )}
      </header>

      {/* PR表記 (景表法・ステマ規制対応) */}
      {article.is_pr && <PRDisclosure variant="default" className="mb-8" />}

      {/* 記事リード文 */}
      {article.excerpt && (
        <div
          className="mb-10 rounded-lg border-l-4 p-5"
          style={{
            borderColor: "var(--color-primary-500, #1a365d)",
            backgroundColor: "var(--color-primary-50, #eef2f8)",
          }}
        >
          <p className="text-base leading-relaxed text-neutral-700 sm:text-lg sm:leading-relaxed">
            {article.excerpt}
          </p>
        </div>
      )}

      {/* 記事本文 */}
      <article className="max-w-none">
        <ArticleBody content={article.content} />
      </article>

      {/* タグ */}
      {article.tags && article.tags.length > 0 && (
        <div className="mt-10 border-t border-neutral-200 pt-6">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-sm font-medium text-neutral-600">タグ</p>
          </div>
          <ul className="flex flex-wrap gap-2" role="list">
            {article.tags.map((tag) => (
              <li key={tag.id}>
                <span
                  className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                  style={{ borderColor: "var(--color-neutral-200, #e0e0e0)" }}
                >
                  #{tag.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 免責事項 (YMYL対応) */}
      <aside
        className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-5"
        aria-label="免責事項"
      >
        <div className="flex items-center gap-2 mb-2">
          <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="text-sm font-semibold text-neutral-800">
            免責事項
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-neutral-600">
          本記事は情報提供を目的としており、医療診断・治療の代替となるものではありません。
          症状や治療についてのご判断は、必ず医師・薬剤師等の専門家にご相談ください。
          本記事の内容は公開時点の情報に基づいており、最新情報と異なる場合があります。
        </p>
      </aside>

      {/* ナビゲーション */}
      <nav
        aria-label="記事ナビゲーション"
        className="mt-10 flex items-center justify-between border-t border-neutral-200 pt-6 pb-2"
      >
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
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
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
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
    <div className="min-h-screen bg-neutral-50 py-8 sm:py-12">
      {/* Draft Mode バナー (動的、Suspense でラップ) */}
      <Suspense fallback={null}>
        <DraftModeBanner />
      </Suspense>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-white px-6 py-8 shadow-sm ring-1 ring-neutral-100 sm:px-10 sm:py-10 lg:px-12">
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
    </div>
  );
}
