import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";

export const metadata: Metadata = {
  title: "メンズカタリについて",
  description:
    "メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。運営情報・編集方針・お問い合わせ先をご確認いただけます。",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  // Organization 構造化データ (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "メンズカタリ",
    url: "https://menscataly.com",
    logo: "https://menscataly.com/logo.png",
    description:
      "メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "contact@menscataly.com",
      availableLanguage: "Japanese",
    },
    sameAs: [],
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
            { label: "メンズカタリについて" },
          ]}
        />

        {/* ページヘッダー */}
        <header className="mb-10">
          <h1 className="mb-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            メンズカタリについて
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            メンズカタリは、男性の医療・美容に関する正確で信頼性の高い情報を提供する総合メディアです。
          </p>
        </header>

        {/* メディア概要 */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            メディア概要
          </h2>
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-neutral-500">
                メディア名
              </dt>
              <dd className="mt-1 text-sm text-neutral-800">
                メンズカタリ（MENS CATALY）
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">URL</dt>
              <dd className="mt-1 text-sm text-neutral-800">
                <a
                  href="https://menscataly.com"
                  className="text-blue-600 hover:underline"
                >
                  https://menscataly.com
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">
                取り扱いジャンル
              </dt>
              <dd className="mt-1 text-sm text-neutral-800">
                AGA治療、ED治療、医療脱毛、メンズスキンケア、サプリメント
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-neutral-500">
                お問い合わせ
              </dt>
              <dd className="mt-1 text-sm text-neutral-800">
                <a
                  href="mailto:contact@menscataly.com"
                  className="text-blue-600 hover:underline"
                >
                  contact@menscataly.com
                </a>
              </dd>
            </div>
          </dl>
        </section>

        {/* 編集方針 */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-green-500 pl-3 text-xl font-bold text-neutral-800">
            編集方針
          </h2>
          <div className="space-y-6 text-base leading-relaxed text-neutral-700">
            <div>
              <h3 className="mb-2 text-lg font-semibold text-neutral-800">
                1. 医学的正確性の担保
              </h3>
              <p>
                すべての医療関連記事は、各分野の専門医・有資格者による監修を受けています。
                最新のガイドラインやエビデンスに基づき、正確な情報を提供します。
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold text-neutral-800">
                2. 薬機法・景表法の遵守
              </h3>
              <p>
                薬機法第66条・67条に準拠し、医薬品・医療機器等の虚偽・誇大広告を行いません。
                景品表示法に基づき、不当な表示や優良誤認を防止しています。
                すべてのPR記事にはアフィリエイト広告であることを明示しています。
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold text-neutral-800">
                3. E-E-A-T（経験・専門性・権威性・信頼性）
              </h3>
              <p>
                YMYL（Your Money or Your Life）領域のコンテンツとして、
                Googleが重視するE-E-A-Tの基準を満たすことを目指しています。
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-neutral-600">
                <li>
                  <strong>Experience（経験）:</strong>{" "}
                  実際の治療経験や使用体験に基づく情報
                </li>
                <li>
                  <strong>Expertise（専門性）:</strong>{" "}
                  各分野の専門医・有資格者による監修
                </li>
                <li>
                  <strong>Authoritativeness（権威性）:</strong>{" "}
                  学会ガイドラインや論文等の信頼できるソース
                </li>
                <li>
                  <strong>Trustworthiness（信頼性）:</strong>{" "}
                  透明性の高い情報開示と定期的な更新
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold text-neutral-800">
                4. 利用者のプライバシー保護
              </h3>
              <p>
                個人情報の取り扱いには細心の注意を払い、プライバシーポリシーに基づき適切に管理しています。
                Cookie の使用やトラッキングについても透明に開示しています。
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-lg font-semibold text-neutral-800">
                5. 定期的な情報更新
              </h3>
              <p>
                医療・美容分野は日々進歩しています。公開した記事は定期的に見直し、
                最新のエビデンスやガイドラインに基づいて更新を行っています。
                各記事には公開日と最終更新日を明記しています。
              </p>
            </div>
          </div>
        </section>

        {/* 監修体制 */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-purple-500 pl-3 text-xl font-bold text-neutral-800">
            監修体制
          </h2>
          <p className="mb-4 text-base leading-relaxed text-neutral-700">
            メンズカタリでは、各カテゴリに専門の監修者を配置しています。
            記事の医学的正確性、薬機法準拠、最新性を確保するための体制を整えています。
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                category: "AGA・薄毛",
                role: "皮膚科専門医",
                color: "#3B82F6",
              },
              {
                category: "ED治療",
                role: "泌尿器科専門医",
                color: "#EF4444",
              },
              {
                category: "医療脱毛",
                role: "皮膚科専門医 / レーザー専門医",
                color: "#8B5CF6",
              },
              {
                category: "スキンケア",
                role: "皮膚科専門医",
                color: "#10B981",
              },
            ].map((item) => (
              <div
                key={item.category}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3"
              >
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div>
                  <p className="text-sm font-medium text-neutral-800">
                    {item.category}
                  </p>
                  <p className="text-xs text-neutral-500">{item.role}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link
              href="/supervisors"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              監修者一覧を見る
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

        {/* 広告ポリシー */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-amber-500 pl-3 text-xl font-bold text-neutral-800">
            広告・アフィリエイトについて
          </h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm leading-relaxed text-neutral-700">
              メンズカタリは、記事内のリンクを通じて商品・サービスが購入・申込された際に、
              提携先企業（ASP）から報酬を受け取るアフィリエイト広告を含む場合があります。
              ただし、報酬の有無が記事の内容や評価に影響を与えることはありません。
              アフィリエイト広告を含む記事には「PR」表記を明示しています。
            </p>
          </div>
        </section>

        {/* 各種リンク */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-neutral-500 pl-3 text-xl font-bold text-neutral-800">
            関連ページ
          </h2>
          <ul className="space-y-2" role="list">
            <li>
              <Link
                href="/privacy"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                プライバシーポリシー
              </Link>
            </li>
            <li>
              <Link
                href="/disclaimer"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                免責事項
              </Link>
            </li>
            <li>
              <Link
                href="/supervisors"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                監修者紹介
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                お問い合わせ
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
