import type { Metadata } from "next";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://menscataly.com";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description:
    "メンズカタリへのお問い合わせページです。記事内容に関するご指摘・ご意見、広告掲載、その他お問い合わせはこちらからご連絡ください。",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "お問い合わせ",
    url: `${BASE_URL}/contact`,
    description:
      "メンズカタリへのお問い合わせ。記事内容に関するご指摘・ご意見はこちらから。",
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
            { label: "お問い合わせ" },
          ]}
        />

        {/* ページヘッダー */}
        <header className="mb-10">
          <h1 className="mb-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            お問い合わせ
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            メンズカタリに関するお問い合わせは、下記の連絡先よりお願いいたします。
          </p>
        </header>

        {/* お問い合わせ方法 */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            お問い合わせ方法
          </h2>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">メールアドレス</p>
                <p className="mt-1">
                  <a
                    href="mailto:contact@menscataly.com"
                    className="text-base text-blue-600 hover:underline"
                  >
                    contact@menscataly.com
                  </a>
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-500">回答までの目安</p>
                <p className="mt-1 text-base text-neutral-800">
                  3営業日以内にご返信いたします
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* お問い合わせ内容 */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-green-500 pl-3 text-xl font-bold text-neutral-800">
            お問い合わせいただける内容
          </h2>
          <ul className="ml-4 list-inside list-disc space-y-2 text-base leading-relaxed text-neutral-700">
            <li>記事内容に関するご指摘・ご意見・修正依頼</li>
            <li>医療情報の正確性に関するお問い合わせ</li>
            <li>広告掲載・メディア提携に関するご相談</li>
            <li>監修者としてのご協力に関するお問い合わせ</li>
            <li>個人情報の取り扱いに関するご確認</li>
            <li>その他、サイト運営に関するお問い合わせ</li>
          </ul>
        </section>

        {/* 注意事項 */}
        <section className="mb-10">
          <h2 className="mb-4 border-l-4 border-amber-500 pl-3 text-xl font-bold text-neutral-800">
            ご注意事項
          </h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <ul className="space-y-2 text-sm leading-relaxed text-neutral-700">
              <li>
                当サイトでは、個別の医療相談・診断・治療に関するお問い合わせにはお答えしておりません。
                症状に関するお悩みは、各専門の医療機関へご相談ください。
              </li>
              <li>
                お問い合わせいただいた内容により、回答を差し控えさせていただく場合がございます。あらかじめご了承ください。
              </li>
              <li>
                営業目的のメールにはご返信いたしかねる場合がございます。
              </li>
            </ul>
          </div>
        </section>

        {/* 運営情報 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-neutral-500 pl-3 text-xl font-bold text-neutral-800">
            運営情報
          </h2>
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-neutral-200 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-neutral-500">メディア名</dt>
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
              <dt className="text-sm font-medium text-neutral-500">メール</dt>
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
      </div>
    </div>
  );
}
