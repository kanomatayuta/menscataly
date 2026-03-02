import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { PRDisclosure } from "@/components/compliance/PRDisclosure";
import { getArticleBySlug, MOCK_ARTICLES } from "@/lib/mock/articles";

// TODO: microCMS接続後は src/lib/microcms/ のクライアントに差し替える

type Props = {
  params: Promise<{ slug: string }>;
};

// SSG用: 全スラッグを返す
export async function generateStaticParams() {
  // TODO: microCMS接続後は全記事のスラッグを返すよう差し替える
  return MOCK_ARTICLES.map((article) => ({
    slug: article.slug,
  }));
}

// ページメタデータ
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return {
      title: "記事が見つかりません",
    };
  }

  return {
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical: `/articles/${article.slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      ...(article.eyecatch && {
        images: [
          {
            url: article.eyecatch.url,
            width: article.eyecatch.width,
            height: article.eyecatch.height,
            alt: article.eyecatch.alt ?? article.title,
          },
        ],
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

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="bg-white py-8 sm:py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
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
                href={`/articles?category=${article.category}`}
                className="hover:text-neutral-700 hover:underline"
              >
                <Badge category={article.category} />
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
            <Badge category={article.category} />
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
          {article.supervisor && (
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-neutral-50 p-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-100"
                aria-hidden="true"
                style={{ backgroundColor: "var(--color-primary-100, #ccd8ec)" }}
              >
                <svg
                  className="h-6 w-6 text-primary-600"
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
                  {article.supervisor.name}
                </p>
                <p className="text-xs text-neutral-500">
                  {article.supervisor.title}
                </p>
              </div>
            </div>
          )}
        </header>

        {/* PR表記 (景表法・ステマ規制対応) */}
        <PRDisclosure variant="default" className="mb-8" />

        {/* 記事リード文 */}
        <div className="mb-8 rounded-lg border-l-4 border-primary-500 bg-primary-50 p-4" style={{ borderColor: "var(--color-primary-500, #1a365d)", backgroundColor: "var(--color-primary-50, #eef2f8)" }}>
          <p className="text-base leading-relaxed text-neutral-700">
            {article.excerpt}
          </p>
        </div>

        {/* 記事本文 */}
        <article className="prose prose-neutral max-w-none">
          {/* TODO: microCMS接続後はリッチテキストレンダラーを使用する */}
          <div
            dangerouslySetInnerHTML={{ __html: article.content }}
            className="leading-relaxed"
          />
        </article>

        {/* タグ */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-8 border-t border-neutral-200 pt-6">
            <p className="mb-2 text-sm font-medium text-neutral-700">
              タグ:
            </p>
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
            href={`/articles?category=${article.category}`}
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
      </div>
    </div>
  );
}
