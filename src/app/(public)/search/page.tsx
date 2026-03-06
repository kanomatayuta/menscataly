import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchResults } from "./SearchResults";

type SearchParams = Promise<{ q?: string }>;

type Props = {
  searchParams: SearchParams;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  const keyword = params.q?.trim();

  if (keyword) {
    return {
      title: `「${keyword}」の検索結果`,
      description: `メンズカタリで「${keyword}」に関する記事を検索した結果です。`,
      robots: { index: false, follow: true },
    };
  }

  return {
    title: "記事検索",
    description:
      "メンズカタリの記事を検索できます。AGA治療・医療脱毛・スキンケア・ED治療に関する情報を見つけましょう。",
    robots: { index: false, follow: true },
  };
}

/** Skeleton loading UI for search results */
function SearchSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-64 rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-32 rounded bg-neutral-100" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
          >
            <div className="h-40 bg-neutral-200" />
            <div className="p-4">
              <div className="mb-2 h-3 w-16 rounded bg-neutral-100" />
              <div className="mb-2 h-5 w-full rounded bg-neutral-200" />
              <div className="h-5 w-3/4 rounded bg-neutral-200" />
              <div className="mt-3 h-3 w-24 rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage({ searchParams }: Props) {
  return (
    <div className="bg-neutral-50 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* 検索入力フォーム */}
        <div className="mb-8 max-w-xl">
          <Suspense fallback={null}>
            <SearchBox autoFocus />
          </Suspense>
        </div>

        {/* 検索結果 */}
        <Suspense fallback={<SearchSkeleton />}>
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
