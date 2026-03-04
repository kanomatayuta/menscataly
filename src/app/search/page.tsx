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
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <span className="text-sm text-neutral-500">検索中...</span>
            </div>
          }
        >
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
