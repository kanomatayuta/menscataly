import type { Metadata } from "next";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://menscataly.com";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description:
    "メンズカタリのプライバシーポリシーです。個人情報の収集・利用・管理方針、Cookie・アクセス解析・広告配信に関する情報を開示しています。",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "プライバシーポリシー",
    url: `${BASE_URL}/privacy`,
    description:
      "メンズカタリのプライバシーポリシー。個人情報の収集・利用・管理方針について。",
    isPartOf: {
      "@type": "WebSite",
      name: "メンズカタリ",
      url: BASE_URL,
    },
    inLanguage: "ja",
    datePublished: "2024-01-01",
    dateModified: "2026-03-01",
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
            { label: "プライバシーポリシー" },
          ]}
        />

        {/* ページヘッダー */}
        <header className="mb-10">
          <h1 className="mb-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            プライバシーポリシー
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            MENS CATALY（メンズカタリ）（以下「当サイト」）は、ユーザーの個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。
          </p>
        </header>

        {/* 個人情報の収集 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            個人情報の収集について
          </h2>
          <p className="text-base leading-relaxed text-neutral-700">
            当サイトでは、お問い合わせフォーム等を通じて、お名前・メールアドレス等の個人情報をご提供いただく場合があります。
            収集した個人情報は、お問い合わせへの対応およびサービスの向上のためにのみ使用します。
          </p>
        </section>

        {/* アクセス解析 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            アクセス解析ツールについて
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              当サイトでは、Googleが提供するアクセス解析ツール「Google Analytics 4（GA4）」を使用しています。
              GA4はCookieを使用してデータを収集しますが、個人を特定する情報は含まれません。
              データの収集はGoogleのプライバシーポリシーに基づいて管理されます。
            </p>
            <p>
              詳細は
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Googleのプライバシーポリシー
              </a>
              をご確認ください。
            </p>
          </div>
        </section>

        {/* Cookie */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            Cookie（クッキー）について
          </h2>
          <p className="text-base leading-relaxed text-neutral-700">
            当サイトでは、ユーザー体験の向上、アクセス解析、広告配信のためにCookieを使用しています。
            ブラウザの設定によりCookieの受け入れを拒否することができますが、一部の機能がご利用いただけなくなる場合があります。
          </p>
        </section>

        {/* 広告配信 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            広告配信について
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              当サイトは、以下のアフィリエイトサービスプロバイダ（ASP）と提携し、広告を掲載しています。
            </p>
            <ul className="ml-4 list-inside list-disc space-y-1">
              <li>A8.net（株式会社ファンコミュニケーションズ）</li>
              <li>afb（株式会社フォーイット）</li>
              <li>アクセストレード（株式会社インタースペース）</li>
              <li>もしもアフィリエイト（株式会社もしも）</li>
            </ul>
            <p>
              これらのASPは、ITP（Intelligent Tracking Prevention）対応のためにファーストパーティCookieまたはサーバーサイドトラッキングを使用する場合があります。
            </p>
          </div>
        </section>

        {/* 第三者への提供 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            第三者への提供について
          </h2>
          <p className="text-base leading-relaxed text-neutral-700">
            収集した個人情報は、法令に基づく場合を除き、第三者に提供することはありません。
          </p>
        </section>

        {/* ポリシーの変更 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            プライバシーポリシーの変更について
          </h2>
          <p className="text-base leading-relaxed text-neutral-700">
            当サイトは、必要に応じてプライバシーポリシーを変更することがあります。
            変更後のプライバシーポリシーは、当ページに掲載された時点で効力を生じるものとします。
          </p>
        </section>

        {/* 日付 */}
        <div className="mt-10 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          <p>制定日: 2024年1月1日</p>
          <p>最終更新日: 2026年3月1日</p>
        </div>
      </div>
    </div>
  );
}
