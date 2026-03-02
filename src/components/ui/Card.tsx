import Image from "next/image";
import Link from "next/link";
import { Badge } from "./Badge";
import type { ArticleCategory } from "./Badge";

export type ArticleCardData = {
  slug: string;
  title: string;
  excerpt: string;
  category: ArticleCategory;
  publishedAt: string;
  updatedAt?: string;
  eyecatch?: {
    url: string;
    width: number;
    height: number;
    alt?: string;
  };
};

type CardProps = {
  article: ArticleCardData;
  className?: string;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function Card({ article, className = "" }: CardProps) {
  const { slug, title, excerpt, category, publishedAt, updatedAt, eyecatch } =
    article;

  return (
    <article
      className={`group overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      <Link
        href={`/articles/${slug}`}
        className="block focus-visible:outline-offset-2"
        aria-label={`${title} の記事を読む`}
      >
        {/* サムネイル画像 */}
        <div className="relative aspect-video w-full overflow-hidden bg-neutral-100">
          {eyecatch ? (
            <Image
              src={eyecatch.url}
              alt={eyecatch.alt ?? title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className="flex h-full items-center justify-center"
              aria-hidden="true"
            >
              <svg
                className="h-16 w-16 text-neutral-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* カード本文 */}
        <div className="p-4">
          {/* カテゴリバッジ */}
          <div className="mb-2">
            <Badge category={category} />
          </div>

          {/* タイトル */}
          <h2 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-neutral-900 group-hover:text-primary-600">
            {title}
          </h2>

          {/* 概要 */}
          <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-neutral-600">
            {excerpt}
          </p>

          {/* 日付 */}
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <time dateTime={publishedAt}>
              <span className="sr-only">公開日: </span>
              {formatDate(publishedAt)}
            </time>
            {updatedAt && updatedAt !== publishedAt && (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={updatedAt}>
                  <span className="sr-only">更新日: </span>
                  更新: {formatDate(updatedAt)}
                </time>
              </>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
