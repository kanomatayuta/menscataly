import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import {
  SUPERVISORS,
  getSupervisorsGroupedByCategory,
} from "@/lib/seo/supervisors-data";

export const metadata: Metadata = {
  title: "監修者紹介",
  description:
    "メンズカタリの記事を監修する医師・専門家をご紹介します。AGA治療、ED治療、医療脱毛、スキンケアなど各分野の専門医が監修しています。",
  alternates: {
    canonical: "/supervisors",
  },
};

/** カテゴリごとのアイコン色 */
const CATEGORY_COLORS: Record<string, string> = {
  aga: "#3B82F6",
  ed: "#EF4444",
  "hair-removal": "#8B5CF6",
  skincare: "#10B981",
  column: "#F59E0B",
};

export default function SupervisorsPage() {
  const grouped = getSupervisorsGroupedByCategory();

  // 組織の構造化データ (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "監修者紹介 | メンズカタリ",
    description:
      "メンズカタリの記事を監修する医師・専門家の一覧ページです。",
    url: "https://menscataly.com/supervisors",
    mainEntity: SUPERVISORS.map((s) => ({
      "@type": "Person",
      name: s.name,
      jobTitle: s.credentials,
      description: s.bio,
      memberOf: s.affiliations.map((org) => ({
        "@type": "Organization",
        name: org,
      })),
    })),
  };

  return (
    <div className="bg-white py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* パンくずリスト */}
        <Breadcrumb
          items={[
            { label: "ホーム", href: "/" },
            { label: "監修者紹介" },
          ]}
        />

        {/* ページヘッダー */}
        <header className="mb-10">
          <h1 className="mb-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            監修者紹介
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            メンズカタリでは、各分野の専門医・有資格者が記事の医学的正確性を監修しています。
            YMYL（Your Money or Your Life）領域のコンテンツとして、
            E-E-A-T（経験・専門性・権威性・信頼性）を重視した情報提供を行っています。
          </p>
        </header>

        {/* カテゴリ別 監修者一覧 */}
        {Object.entries(grouped).map(([category, supervisors]) => (
          <section
            key={category}
            id={category}
            className="mb-12 scroll-mt-20"
          >
            <h2
              className="mb-6 border-l-4 pl-3 text-xl font-bold text-neutral-800"
              style={{
                borderColor: CATEGORY_COLORS[category] ?? "#6B7280",
              }}
            >
              {supervisors[0].categoryLabel}
            </h2>

            <div className="grid gap-6">
              {supervisors.map((supervisor) => (
                <Link
                  key={supervisor.id}
                  href={`/supervisors/${supervisor.id}`}
                  className="group block rounded-lg border border-neutral-200 p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    {/* プロフィール画像プレースホルダー */}
                    <div
                      className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[category] ?? "#6B7280",
                        opacity: 0.15,
                      }}
                    >
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[category] ?? "#6B7280"}20`,
                        }}
                      >
                        <svg
                          className="h-8 w-8"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          style={{
                            color: CATEGORY_COLORS[category] ?? "#6B7280",
                          }}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* 監修者情報 */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-neutral-900 group-hover:text-blue-600">
                        {supervisor.name}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-neutral-600">
                        {supervisor.credentials}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        専門: {supervisor.specialty} / 経験
                        {supervisor.yearsOfExperience}年以上
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                        {supervisor.bio}
                      </p>

                      {/* 所属学会タグ */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {supervisor.affiliations.map((aff) => (
                          <span
                            key={aff}
                            className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600"
                          >
                            {aff}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 矢印 */}
                    <svg
                      className="mt-1 h-5 w-5 flex-shrink-0 text-neutral-400 group-hover:text-blue-500"
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
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {/* E-E-A-T 信頼性説明 */}
        <aside className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
          <h2 className="mb-3 text-base font-semibold text-neutral-800">
            メンズカタリの監修体制について
          </h2>
          <ul className="space-y-2 text-sm leading-relaxed text-neutral-600">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-green-500">
                &#10003;
              </span>
              各カテゴリの専門医・有資格者が記事の医学的正確性を確認
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-green-500">
                &#10003;
              </span>
              薬機法第66条・67条に準拠した表現のチェック
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-green-500">
                &#10003;
              </span>
              最新のガイドライン・エビデンスに基づく情報提供
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0 text-green-500">
                &#10003;
              </span>
              定期的な記事内容の見直しと更新
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
