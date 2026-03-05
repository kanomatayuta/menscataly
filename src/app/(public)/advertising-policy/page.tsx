import type { Metadata } from "next";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://menscataly.com";

export const metadata: Metadata = {
  title: "広告掲載ポリシー",
  description:
    "メンズカタリの広告掲載ポリシーです。アフィリエイト広告の方針、編集の独立性、提携ASP、コンプライアンス体制について説明しています。",
  alternates: {
    canonical: "/advertising-policy",
  },
};

export default function AdvertisingPolicyPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "広告掲載ポリシー",
    url: `${BASE_URL}/advertising-policy`,
    description:
      "メンズカタリの広告掲載ポリシー。アフィリエイト広告の方針と編集の独立性について。",
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
            { label: "広告掲載ポリシー" },
          ]}
        />

        {/* ページヘッダー */}
        <header className="mb-10">
          <h1 className="mb-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            広告掲載ポリシー
          </h1>
          <p className="text-base leading-relaxed text-neutral-600">
            MENS CATALY（メンズカタリ）における広告掲載の方針、編集の独立性、コンプライアンス体制について説明いたします。
          </p>
        </header>

        {/* 広告について */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-blue-500 pl-3 text-xl font-bold text-neutral-800">
            広告について
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              本サイトはアフィリエイト広告（成果報酬型広告）を含みます。
              記事内で紹介するサービス・商品へのリンクからご購入・ご契約いただいた場合、当サイトに報酬が発生することがあります。
            </p>
            <p>
              アフィリエイト広告を含む記事には、記事冒頭に「PR」「広告」等の表記を明示しています（2023年10月施行のステマ規制に準拠）。
            </p>
          </div>
        </section>

        {/* 編集の独立性 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-green-500 pl-3 text-xl font-bold text-neutral-800">
            編集の独立性
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              紹介内容はサービスの品質に基づいた独自の評価であり、広告主からの指示・依頼によるものではありません。
              広告の有無は記事の内容・評価に影響しません。
            </p>
            <p>
              記事の作成・編集にあたっては、以下の基準を遵守しています。
            </p>
            <ul className="ml-4 list-inside list-disc space-y-1">
              <li>広告主からの記事内容の事前承認は受けません</li>
              <li>報酬額の多寡によって推奨順位を変更しません</li>
              <li>広告主の意向により記事の評価を歪めません</li>
              <li>ネガティブな情報であっても、利用者にとって重要であれば記載します</li>
            </ul>
          </div>
        </section>

        {/* 提携ASP */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-purple-500 pl-3 text-xl font-bold text-neutral-800">
            提携アフィリエイトサービスプロバイダ（ASP）
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>当サイトは以下のASPと提携しています。</p>
            <ul className="ml-4 list-inside list-disc space-y-1">
              <li>A8.net（株式会社ファンコミュニケーションズ）</li>
              <li>afb（株式会社フォーイット）</li>
              <li>アクセストレード（株式会社インタースペース）</li>
              <li>もしもアフィリエイト（株式会社もしも）</li>
            </ul>
          </div>
        </section>

        {/* コンプライアンス */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-red-500 pl-3 text-xl font-bold text-neutral-800">
            コンプライアンス体制
          </h2>
          <div className="space-y-3 text-base leading-relaxed text-neutral-700">
            <p>
              記事の作成にあたっては、以下の法令を遵守しています。
            </p>
            <ul className="ml-4 list-inside list-disc space-y-1">
              <li>
                <strong>薬機法</strong>（医薬品、医療機器等の品質、有効性及び安全性の確保等に関する法律）第66条・第67条
              </li>
              <li>
                <strong>景品表示法</strong>（不当景品類及び不当表示防止法）
              </li>
              <li>
                <strong>ステマ規制</strong>（2023年10月施行 不当表示告示）
              </li>
            </ul>
            <p>
              AIによる自動コンプライアンスチェックと、専門家による人的レビューの二重体制で品質を管理しています。
            </p>
          </div>
        </section>

        {/* 価格表記 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-amber-500 pl-3 text-xl font-bold text-neutral-800">
            価格・情報の取り扱い
          </h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <ul className="space-y-2 text-sm leading-relaxed text-neutral-700">
              <li>
                記事内の価格・情報は執筆時点のものです。最新情報は各公式サイトでご確認ください。
              </li>
              <li>
                「最安値」「業界No.1」等の絶対的表現は使用しません。価格情報には必ず調査日時を併記します。
              </li>
              <li>
                医療・美容に関する情報は個人差があります。治療・施術の判断は必ず医師にご相談ください。
              </li>
            </ul>
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
