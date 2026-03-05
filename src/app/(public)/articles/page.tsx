import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleListContent } from "./ArticleListContent";

export const metadata: Metadata = {
  title: "記事一覧",
  description:
    "メンズカタリの記事一覧です。AGA治療・医療脱毛・スキンケア・ED治療に関する情報を専門医監修のもとお届けします。",
};

type SearchParams = Promise<{
  category?: string;
  page?: string;
}>;

type Props = {
  searchParams: SearchParams;
};

export default function ArticlesPage({ searchParams }: Props) {
  return (
    <div className="bg-neutral-50 py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <span className="text-sm text-neutral-500">読み込み中...</span>
            </div>
          }
        >
          <ArticleListContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
