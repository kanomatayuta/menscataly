import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { getArticles } from "@/lib/microcms/client";
import { articleToCardData } from "@/lib/utils/article";
import type { ArticleCategory } from "@/components/ui/Badge";

const CATEGORIES: { value: ArticleCategory; label: string; description: string; href: string }[] = [
  {
    value: "aga",
    label: "AGA治療",
    description: "フィナステリド・ミノキシジルなど薄毛治療の最新情報",
    href: "/articles?category=aga",
  },
  {
    value: "hair-removal",
    label: "医療脱毛",
    description: "クリニック選びから施術の流れまでわかりやすく解説",
    href: "/articles?category=hair-removal",
  },
  {
    value: "skincare",
    label: "メンズスキンケア",
    description: "男性肌に合った洗顔・保湿・UVケアの正しい方法",
    href: "/articles?category=skincare",
  },
  {
    value: "ed",
    label: "ED治療",
    description: "PDE5阻害薬の種類と特徴、受診のポイントを解説",
    href: "/articles?category=ed",
  },
];

/** 最新記事を非同期取得する内部コンポーネント */
async function RecentArticles() {
  const result = await getArticles({ limit: 3 });
  const articles = result.contents;

  if (articles.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        記事はまだありません。
      </p>
    );
  }

  return (
    <ul
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      role="list"
    >
      {articles.map((article) => (
        <li key={article.id}>
          <Card article={articleToCardData(article)} />
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ヒーローセクション */}
      <section
        className="py-16 sm:py-24"
        style={{
          background: "linear-gradient(135deg, var(--color-primary-500, #1a365d) 0%, #2c4f8a 100%)",
        }}
        aria-label="ヒーローセクション"
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
            メンズ医療・美容の
            <br className="sm:hidden" />
            <span style={{ color: "var(--color-accent-400, #d8b633)" }}>
              正しい情報
            </span>
            をお届け
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-blue-100 sm:text-lg">
            AGA・ED・脱毛・スキンケアなど、メンズ医療・美容に関する情報を専門医監修のもとお届けします。
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <ButtonLink
              href="/articles"
              variant="secondary"
              size="lg"
            >
              記事を読む
            </ButtonLink>
            <ButtonLink
              href="/articles?category=aga"
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white/10"
            >
              AGA治療を知る
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* カテゴリセクション */}
      <section className="bg-neutral-50 py-12 sm:py-16" aria-labelledby="category-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2
            id="category-heading"
            className="mb-8 text-center text-2xl font-bold text-neutral-900"
          >
            カテゴリから探す
          </h2>
          <ul
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            role="list"
          >
            {CATEGORIES.map((cat) => (
              <li key={cat.value}>
                <Link
                  href={cat.href}
                  className="group block rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="mb-2 font-semibold text-neutral-900 group-hover:text-primary-600">
                    {cat.label}
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-600">
                    {cat.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 最新記事セクション */}
      <section className="bg-white py-12 sm:py-16" aria-labelledby="latest-articles-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <h2
              id="latest-articles-heading"
              className="text-2xl font-bold text-neutral-900"
            >
              最新記事
            </h2>
            <Link
              href="/articles"
              className="text-sm font-medium text-primary-600 hover:underline"
              style={{ color: "var(--color-primary-500, #1a365d)" }}
            >
              すべての記事を見る →
            </Link>
          </div>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-neutral-500">読み込み中...</span>
              </div>
            }
          >
            <RecentArticles />
          </Suspense>
        </div>
      </section>

      {/* 信頼性アピールセクション */}
      <section
        className="py-12 sm:py-16"
        style={{ backgroundColor: "var(--color-primary-50, #eef2f8)" }}
        aria-labelledby="trust-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2
            id="trust-heading"
            className="mb-10 text-center text-2xl font-bold text-neutral-900"
          >
            メンズカタリが選ばれる理由
          </h2>
          <ul
            className="grid grid-cols-1 gap-6 sm:grid-cols-3"
            role="list"
          >
            {[
              {
                title: "専門医監修",
                body: "皮膚科・泌尿器科・美容外科の専門医が記事内容を監修。医学的に正確な情報をお届けします。",
              },
              {
                title: "薬機法準拠",
                body: "薬機法・景表法に基づいた適切な表現を使用。誇大広告のない正確な情報を提供しています。",
              },
              {
                title: "定期的な情報更新",
                body: "最新の研究・ガイドラインに基づき、記事を定期的に更新。常に最新の情報をお届けします。",
              },
            ].map((item) => (
              <li
                key={item.title}
                className="rounded-lg bg-white p-6 text-center shadow-sm"
              >
                <h3 className="mb-3 font-semibold text-neutral-900">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
