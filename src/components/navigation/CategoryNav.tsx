"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const CATEGORIES = [
  { label: "すべて", slug: "" },
  { label: "AGA治療", slug: "aga" },
  { label: "ED治療", slug: "ed" },
  { label: "医療脱毛", slug: "hair-removal" },
  { label: "スキンケア", slug: "skincare" },
  { label: "コラム", slug: "column" },
] as const;

type CategoryNavProps = {
  className?: string;
};

/**
 * カテゴリナビゲーションバー
 *
 * 記事一覧・記事詳細ページのサブヘッダーとして表示。
 * 現在のカテゴリを searchParams から読み取りアクティブ表示する。
 */
export function CategoryNav({ className = "" }: CategoryNavProps) {
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") ?? "";

  return (
    <nav
      aria-label="カテゴリナビゲーション"
      className={`border-b border-neutral-200 bg-neutral-50 ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ul
          className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide"
          role="list"
        >
          {CATEGORIES.map((cat) => {
            const isActive = cat.slug === currentCategory;
            const href = cat.slug
              ? `/articles?category=${cat.slug}`
              : "/articles";

            return (
              <li key={cat.slug}>
                <Link
                  href={href}
                  className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {cat.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
