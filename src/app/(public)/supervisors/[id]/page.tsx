import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { generatePersonSchema } from "@/lib/seo/structured-data";
import {
  getSupervisorById,
  getAllSupervisorIds,
} from "@/lib/seo/supervisors-data";

type Props = {
  params: Promise<{ id: string }>;
};

// SSG: 全監修者の静的パスを生成
export async function generateStaticParams() {
  const ids = getAllSupervisorIds();
  return ids.map((id) => ({ id }));
}

// ページメタデータ
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supervisor = getSupervisorById(id);

  if (!supervisor) {
    return { title: "監修者が見つかりません" };
  }

  return {
    title: `${supervisor.name} | 監修者紹介`,
    description: supervisor.bio,
    alternates: {
      canonical: `/supervisors/${id}`,
    },
  };
}

/** カテゴリごとのアイコン色 */
const CATEGORY_COLORS: Record<string, string> = {
  aga: "#3B82F6",
  ed: "#EF4444",
  "hair-removal": "#8B5CF6",
  skincare: "#10B981",
  column: "#F59E0B",
};

export default async function SupervisorDetailPage({ params }: Props) {
  const { id } = await params;
  const supervisor = getSupervisorById(id);

  if (!supervisor) {
    notFound();
  }

  const color = CATEGORY_COLORS[supervisor.category] ?? "#6B7280";

  // Person 構造化データ (JSON-LD)
  const personJsonLd = generatePersonSchema(
    supervisor.name,
    supervisor.credentials,
    supervisor.bio,
    supervisor.affiliations,
    supervisor.imageUrl
  );

  return (
    <div className="bg-white py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* パンくずリスト */}
        <Breadcrumb
          items={[
            { label: "ホーム", href: "/" },
            { label: "監修者紹介", href: "/supervisors" },
            { label: supervisor.name },
          ]}
        />

        {/* プロフィールヘッダー */}
        <header className="mb-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {/* プロフィール画像 */}
            {supervisor.imageUrl ? (
              <Image
                src={supervisor.imageUrl}
                alt={`${supervisor.name}のプロフィール画像`}
                width={96}
                height={96}
                className="h-24 w-24 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}15` }}
              >
                <svg
                  className="h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  style={{ color }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  {supervisor.categoryLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  医師監修
                </span>
              </div>
              <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
                {supervisor.name}
              </h1>
              <p className="mt-1 text-base font-medium text-neutral-600">
                {supervisor.credentials}
              </p>
            </div>
          </div>
        </header>

        {/* プロフィール詳細 */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-800">
            プロフィール
          </h2>
          <p className="text-base leading-relaxed text-neutral-700">
            {supervisor.bio}
          </p>
        </section>

        {/* 基本情報 */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-800">
            基本情報
          </h2>
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-neutral-500">専門分野</dt>
              <dd className="mt-1 text-sm text-neutral-800">
                {supervisor.specialty}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">経験年数</dt>
              <dd className="mt-1 text-sm text-neutral-800">
                {supervisor.yearsOfExperience}年以上
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">資格</dt>
              <dd className="mt-1 text-sm text-neutral-800">
                {supervisor.credentials}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">担当カテゴリ</dt>
              <dd className="mt-1 text-sm text-neutral-800">
                {supervisor.categoryLabel}
              </dd>
            </div>
          </dl>
        </section>

        {/* 所属学会 */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-800">
            所属学会・団体
          </h2>
          <ul className="space-y-2" role="list">
            {supervisor.affiliations.map((aff) => (
              <li
                key={aff}
                className="flex items-center gap-2 text-sm text-neutral-700"
              >
                <span className="flex-shrink-0 text-green-500">&#10003;</span>
                {aff}
              </li>
            ))}
          </ul>
        </section>

        {/* 監修テーマ */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-800">
            監修対象テーマ
          </h2>
          <div className="flex flex-wrap gap-2">
            {supervisor.topics.map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700"
              >
                {topic}
              </span>
            ))}
          </div>
        </section>

        {/* 関連記事セクション（将来的にmicroCMSから取得） */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-neutral-800">
            {supervisor.name}先生が監修した記事
          </h2>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 text-center">
            <p className="text-sm text-neutral-500">
              監修記事は随時追加されます。
            </p>
            <Link
              href={`/articles?category=${supervisor.category}`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              {supervisor.categoryLabel}の記事一覧を見る
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
          </div>
        </section>

        {/* ナビゲーション */}
        <nav
          aria-label="監修者ページナビゲーション"
          className="mt-10 flex items-center justify-between border-t border-neutral-200 pt-6"
        >
          <Link
            href="/supervisors"
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
            監修者一覧に戻る
          </Link>
        </nav>
      </div>
    </div>
  );
}
