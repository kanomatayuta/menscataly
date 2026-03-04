import type { Metadata } from "next";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://menscataly.com";

export const metadata: Metadata = {
  title: "免責事項",
  description:
    "メンズカタリの免責事項です。医療情報・美容情報・サプリメント情報の取り扱いについて、利用者の皆さまへお知らせします。",
  alternates: {
    canonical: "/disclaimer",
  },
};

export default function DisclaimerPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "免責事項",
    url: `${BASE_URL}/disclaimer`,
    description:
      "メンズカタリの免責事項。医療・美容・サプリメント情報の取り扱いについて。",
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
            { label: "免責事項" },
          ]}
        />

        {/* ページヘッダー */}
        <header className="mb-10">
          <h1 className="mb-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            免責事項
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            MENS CATALY（メンズカタリ）のコンテンツをご利用いただくにあたっての注意事項です。
          </p>
        </header>

        {/* 医療情報 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-red-500 pl-3 text-xl font-bold text-neutral-800">
            医療情報について
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              本サイトは医療情報を提供するものであり、診断・治療を目的としたものではありません。
            </p>
            <p>
              記事内で紹介している治療法・医薬品の情報は、医師の診察・指導のもとで行う治療の参考情報として提供しています。
              自己判断での治療開始・変更・中止は避け、必ず医師にご相談ください。
            </p>
            <p>
              医薬品の効果・副作用には個人差があります。
              治療費用は医療機関によって異なります。記載の費用は参考情報であり、正確な金額は各医療機関にお問い合わせください。
            </p>
          </div>
        </section>

        {/* 美容情報 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-purple-500 pl-3 text-xl font-bold text-neutral-800">
            美容情報について
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              効果には個人差があります。本サイトで紹介している化粧品・美容施術の効果を保証するものではありません。
            </p>
            <p>
              肌に異常を感じた場合は直ちに使用を中止し、皮膚科専門医にご相談ください。
            </p>
            <p>
              化粧品の「浸透」とは角質層までを指します。
              「エイジングケア」とは年齢に応じたお手入れのことです。
              施術・施術費用は各クリニック・サロンによって異なります。
            </p>
          </div>
        </section>

        {/* サプリメント情報 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-green-500 pl-3 text-xl font-bold text-neutral-800">
            サプリメント・健康食品について
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              本サイトで紹介するサプリメントは特定保健用食品ではありません。疾病の診断、治療、予防を目的としたものではありません。
            </p>
            <p>
              食生活は、主食、主菜、副菜を基本に、食事のバランスを。
            </p>
            <p>
              サプリメントは医薬品ではなく、効果・効能を保証するものではありません。効果には個人差があります。
              持病のある方や薬を服用中の方は、使用前に必ず医師・薬剤師にご相談ください。
              妊娠中・授乳中の方は、ご使用前に医師にご相談ください。
            </p>
          </div>
        </section>

        {/* 情報の正確性 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-amber-500 pl-3 text-xl font-bold text-neutral-800">
            情報の正確性について
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              本サイトの情報は一般的な情報提供を目的としており、医療行為に代わるものではありません。
              具体的な症状やお悩みがある場合は、各専門の医療機関にご相談ください。
            </p>
            <p>
              記載の情報は執筆時点のものであり、最新の医療情報・ガイドラインとは異なる場合があります。
              各記事には公開日・最終更新日を明記しておりますので、情報の鮮度をご確認ください。
            </p>
          </div>
        </section>

        {/* 広告・アフィリエイト */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            広告・アフィリエイトについて
          </h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <p className="text-base leading-relaxed text-neutral-700">
              本サイトはアフィリエイト広告（PR）を含みます。
              記事内のリンクを通じて商品・サービスが購入・申込された場合、提携先企業から報酬を受け取ることがあります。
              ただし、報酬の有無が記事の内容や評価に影響を与えることはありません。
              アフィリエイト広告を含む記事には「PR」表記を明示しています。
            </p>
          </div>
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
