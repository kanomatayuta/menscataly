"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { ReviewStatus } from "@/types/admin";

// ------------------------------------------------------------------
// Preview article type
// ------------------------------------------------------------------

interface PreviewArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: ReviewStatus;
  authorName: string;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string;
  seoDescription: string;
  htmlContent: string;
  jsonLd: Record<string, unknown>;
}

// ------------------------------------------------------------------
// Mock data (Supabase未設定時のフォールバック)
// ------------------------------------------------------------------

const MOCK_PREVIEW_ARTICLES: Record<string, PreviewArticle> = {
  "rev-1": {
    id: "rev-1",
    title: "AGA治療の基礎知識 — 原因・治療法・費用を徹底解説",
    slug: "aga-basic-guide",
    category: "AGA治療",
    status: "approved",
    authorName: "メンズカタリ編集部",
    publishedAt: "2026-03-01T06:30:00+09:00",
    updatedAt: "2026-03-01T10:00:00+09:00",
    seoTitle: "AGA治療の基礎知識｜原因・治療法・費用を徹底解説【2026年版】",
    seoDescription:
      "AGA（男性型脱毛症）の原因、最新の治療法、費用相場を医師監修のもと徹底解説。フィナステリド・デュタステリド・ミノキシジルの効果と副作用も紹介します。",
    htmlContent: `
        <p class="pr-disclosure">
          【PR】本記事には広告・アフィリエイトリンクが含まれています。
        </p>

        <p class="article-lead">AGA（男性型脱毛症）は、日本人男性の約3人に1人が悩むとされる脱毛症です。本記事では、AGAの原因から最新の治療法、費用相場まで徹底的に解説します。</p>

        <h2>AGAとは？ -- 男性型脱毛症の基礎知識</h2>
        <p>AGA（Androgenetic Alopecia）は、男性ホルモンの影響により進行する脱毛症です。遺伝的要因と男性ホルモン（DHT: ジヒドロテストステロン）が主な原因とされています。</p>
        <p>日本皮膚科学会の「男性型および女性型脱毛症診療ガイドライン 2017年版」によると、AGAは思春期以降に始まり、徐々に進行する特徴があります。</p>

        <h2>AGA治療の主な選択肢</h2>
        <h3>1. フィナステリド（プロペシア）</h3>
        <p>フィナステリドは、5α還元酵素II型を阻害することで、DHTの産生を抑制する内服薬です。発毛を促進する効果が期待できるとされています。</p>
        <ul>
          <li>費用相場: 月額5,000円〜10,000円（調査時点での価格）</li>
          <li>効果が実感できるまでの期間: 約3〜6ヶ月</li>
          <li>副作用のリスクが低いとされていますが、医師への相談が必要です</li>
        </ul>

        <h3>2. デュタステリド（ザガーロ）</h3>
        <p>デュタステリドは、5α還元酵素I型・II型の両方を阻害する内服薬です。フィナステリドよりも広範な作用が期待できるとされています。</p>

        <h3>3. ミノキシジル外用薬</h3>
        <p>ミノキシジルは、頭皮の血行を促進し、毛母細胞の活性化を助ける外用薬です。</p>

        <h2>AGA治療の費用相場</h2>
        <p>AGA治療にかかる費用は、治療法やクリニックによって異なります。以下は調査時点（2026年3月）での一般的な費用相場です。</p>
        <table>
          <thead>
            <tr><th>治療法</th><th>月額費用</th></tr>
          </thead>
          <tbody>
            <tr><td>フィナステリド内服</td><td>5,000円〜10,000円</td></tr>
            <tr><td>デュタステリド内服</td><td>8,000円〜12,000円</td></tr>
            <tr><td>ミノキシジル外用</td><td>5,000円〜15,000円</td></tr>
          </tbody>
        </table>

        <h2>まとめ</h2>
        <p>AGA治療は早期に開始することで、より効果が期待できるとされています。まずは専門のクリニックで無料カウンセリングを受けることをおすすめします。</p>

        <div style="margin-top:2rem; border-top:1px solid #e0e0e0; padding-top:1rem;">
          <p style="font-size:0.75rem; color:#a0a0a0;">監修: 山田太郎（皮膚科専門医）</p>
          <p style="font-size:0.75rem; color:#a0a0a0;">参考文献: 日本皮膚科学会「男性型および女性型脱毛症診療ガイドライン 2017年版」</p>
          <p style="font-size:0.75rem; color:#a0a0a0;">最終更新日: 2026年3月1日</p>
        </div>
    `,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "AGA治療の基礎知識 — 原因・治療法・費用を徹底解説",
      description:
        "AGA（男性型脱毛症）の原因、最新の治療法、費用相場を医師監修のもと徹底解説。",
      author: {
        "@type": "Organization",
        name: "メンズカタリ編集部",
      },
      publisher: {
        "@type": "Organization",
        name: "MENS CATALY",
        logo: {
          "@type": "ImageObject",
          url: "https://menscataly.com/logo.png",
        },
      },
      datePublished: "2026-03-01T06:30:00+09:00",
      dateModified: "2026-03-01T10:00:00+09:00",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": "https://menscataly.com/articles/aga-basic-guide",
      },
      medicalAudience: {
        "@type": "MedicalAudience",
        audienceType: "Patient",
      },
    },
  },
  "rev-2": {
    id: "rev-2",
    title: "メンズ医療脱毛おすすめクリニック比較2026",
    slug: "mens-hair-removal-clinics-2026",
    category: "医療脱毛",
    status: "pending",
    authorName: "メンズカタリ編集部",
    publishedAt: "2026-03-02T06:30:00+09:00",
    updatedAt: "2026-03-02T06:30:00+09:00",
    seoTitle: "メンズ医療脱毛おすすめクリニック比較【2026年最新】",
    seoDescription:
      "2026年最新のメンズ医療脱毛クリニックを徹底比較。料金・痛み・回数・口コミから最適なクリニックを紹介します。",
    htmlContent: `
        <p class="pr-disclosure">
          【PR】本記事には広告・アフィリエイトリンクが含まれています。
        </p>
        <p class="article-lead">メンズ医療脱毛の需要は年々増加しています。本記事では、主要クリニックの料金・痛み・回数を徹底比較し、あなたに最適なクリニック選びをサポートします。</p>
        <h2>メンズ医療脱毛とは</h2>
        <p>医療脱毛は、医療機関でのみ使用できる高出力レーザーを使用した脱毛方法です。エステ脱毛と比較して、少ない回数で効果が期待できるとされています。</p>
        <h2>おすすめクリニック比較</h2>
        <p>（調査時点: 2026年3月時点の情報です。最新の料金・キャンペーンは各クリニックの公式サイトをご確認ください。）</p>
    `,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "メンズ医療脱毛おすすめクリニック比較2026",
      description: "2026年最新のメンズ医療脱毛クリニックを徹底比較。",
      author: {
        "@type": "Organization",
        name: "メンズカタリ編集部",
      },
      datePublished: "2026-03-02T06:30:00+09:00",
    },
  },
};

// ------------------------------------------------------------------
// Convert API response (ArticleReviewDetail) to PreviewArticle
// ------------------------------------------------------------------

interface ApiArticleDetail {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: ReviewStatus;
  authorName: string;
  generatedAt: string;
  reviewedAt?: string | null;
  seoTitle?: string;
  seoDescription?: string;
  htmlContent?: string;
  content?: string;
  jsonLd?: Record<string, unknown>;
}

function toPreviewArticle(data: ApiArticleDetail): PreviewArticle {
  const CATEGORY_LABELS: Record<string, string> = {
    aga: "AGA治療",
    "hair-removal": "医療脱毛",
    skincare: "スキンケア",
    ed: "ED治療",
    column: "コラム",
  };

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    category: CATEGORY_LABELS[data.category] ?? data.category,
    status: data.status,
    authorName: data.authorName,
    publishedAt: data.generatedAt,
    updatedAt: data.reviewedAt ?? data.generatedAt,
    seoTitle: data.seoTitle ?? data.title,
    seoDescription: data.seoDescription ?? "",
    htmlContent: data.htmlContent ?? data.content ?? "",
    jsonLd: data.jsonLd ?? {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: data.title,
      author: { "@type": "Organization", name: data.authorName },
      datePublished: data.generatedAt,
    },
  };
}

// ------------------------------------------------------------------
// Preview viewport sizes
// ------------------------------------------------------------------

type ViewportMode = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTHS: Record<ViewportMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

const VIEWPORT_LABELS: Record<ViewportMode, string> = {
  desktop: "デスクトップ",
  tablet: "タブレット",
  mobile: "モバイル",
};

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function ArticlePreviewPage() {
  const params = useParams();
  const id = params.id as string;

  const [article, setArticle] = useState<PreviewArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [showJsonLd, setShowJsonLd] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchArticle() {
      setIsLoading(true);
      setNotFound(false);

      try {
        const res = await fetch(`/api/admin/articles/${encodeURIComponent(id)}`, {
          credentials: "include",
        });

        if (res.status === 404) {
          // APIで見つからなければモックにフォールバック
          const mock = MOCK_PREVIEW_ARTICLES[id];
          if (mock) {
            setArticle(mock);
          } else {
            setNotFound(true);
          }
          return;
        }

        if (!res.ok) {
          // APIエラー時はモックにフォールバック
          const mock = MOCK_PREVIEW_ARTICLES[id];
          if (mock) {
            setArticle(mock);
          } else {
            setNotFound(true);
          }
          return;
        }

        const data = await res.json() as { article: ApiArticleDetail };
        if (!data.article) {
          const mock = MOCK_PREVIEW_ARTICLES[id];
          if (mock) {
            setArticle(mock);
          } else {
            setNotFound(true);
          }
          return;
        }

        setArticle(toPreviewArticle(data.article));
      } catch {
        // ネットワークエラー時はモックにフォールバック
        const mock = MOCK_PREVIEW_ARTICLES[id];
        if (mock) {
          setArticle(mock);
        } else {
          setNotFound(true);
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchArticle();
  }, [id]);

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  if (isLoading) {
    return (
      <>
        <AdminHeader
          title="記事プレビュー"
          breadcrumbs={[
            { label: "記事一覧", href: "/admin/articles" },
            { label: "読み込み中..." },
          ]}
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
            <p className="text-sm text-neutral-500">プレビューを読み込み中...</p>
          </div>
        </div>
      </>
    );
  }

  // ------------------------------------------------------------------
  // Not found state
  // ------------------------------------------------------------------
  if (notFound || !article) {
    return (
      <>
        <AdminHeader
          title="プレビューが見つかりません"
          breadcrumbs={[
            { label: "記事一覧", href: "/admin/articles" },
            { label: "Not Found" },
          ]}
        />
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-500">
            ID &quot;{id}&quot; のプレビューデータが見つかりませんでした。
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title="記事プレビュー"
        breadcrumbs={[
          { label: "記事一覧", href: "/admin/articles" },
          { label: article.title, href: `/admin/articles/${id}` },
          { label: "プレビュー" },
        ]}
      />

      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <StatusBadge status={article.status} size="md" />
          <span className="text-sm text-neutral-500">
            {article.category}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewport toggle */}
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {(Object.keys(VIEWPORT_WIDTHS) as ViewportMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewport(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewport === mode
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {mode === "desktop" && (
                  <svg className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
                {mode === "tablet" && (
                  <svg className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
                {mode === "mobile" && (
                  <svg className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
                {VIEWPORT_LABELS[mode]}
              </button>
            ))}
          </div>

          {/* JSON-LD toggle */}
          <button
            type="button"
            onClick={() => setShowJsonLd(!showJsonLd)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              showJsonLd
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            <svg className="mr-1 inline h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            JSON-LD
          </button>

          {/* Back to review */}
          <Link
            href={`/admin/articles/${id}`}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            レビューに戻る
          </Link>
        </div>
      </div>

      <div className={`grid gap-6 ${showJsonLd ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* Article preview */}
        <div className="flex justify-center">
          <div
            className="w-full transition-all duration-300"
            style={{ maxWidth: VIEWPORT_WIDTHS[viewport] }}
          >
            {/* Browser chrome mockup */}
            <div className="overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-lg">
              {/* URL bar */}
              <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 rounded-md bg-white px-3 py-1 text-xs text-neutral-500 border border-neutral-200">
                  menscataly.com/articles/{article.slug}
                </div>
              </div>

              {/* SEO meta preview */}
              <div className="border-b border-neutral-100 bg-neutral-50/50 px-6 py-3">
                <p className="text-xs font-medium text-neutral-400 mb-1">SEOメタ情報</p>
                <p className="text-sm font-medium text-blue-700 mb-0.5">
                  {article.seoTitle}
                </p>
                <p className="text-xs text-green-700 mb-0.5">
                  menscataly.com/articles/{article.slug}
                </p>
                <p className="text-xs text-neutral-500 line-clamp-2">
                  {article.seoDescription}
                </p>
              </div>

              {/* Article content */}
              <div className="p-6">
                <article>
                  <header className="mb-6">
                    <h1 className="mb-3 text-2xl font-bold text-neutral-900 leading-tight">
                      {article.title}
                    </h1>
                    <div className="flex items-center gap-3 text-sm text-neutral-500">
                      <span>{article.authorName}</span>
                      <span>|</span>
                      <time>
                        {new Date(article.publishedAt).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                  </header>

                  <div
                    className="article-body max-w-none"
                    dangerouslySetInnerHTML={{ __html: article.htmlContent }}
                  />
                </article>
              </div>
            </div>

            {/* Viewport indicator */}
            <div className="mt-2 text-center">
              <span className="text-xs text-neutral-400">
                {VIEWPORT_LABELS[viewport]} ({VIEWPORT_WIDTHS[viewport]})
              </span>
            </div>
          </div>
        </div>

        {/* JSON-LD panel */}
        {showJsonLd && (
          <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
              <h3 className="text-sm font-semibold text-neutral-800">
                JSON-LD 構造化データ
              </h3>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    JSON.stringify(article.jsonLd, null, 2)
                  );
                }}
                className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
              >
                コピー
              </button>
            </div>
            <div className="overflow-auto p-5">
              <pre className="whitespace-pre-wrap text-xs text-neutral-700 font-mono leading-relaxed">
                {JSON.stringify(article.jsonLd, null, 2)}
              </pre>
            </div>

            {/* JSON-LD validation hints */}
            <div className="border-t border-neutral-200 px-5 py-3">
              <h4 className="mb-2 text-xs font-semibold text-neutral-600">
                検証チェック
              </h4>
              <ul className="space-y-1">
                {[
                  { key: "@context", label: "@context", required: true },
                  { key: "@type", label: "@type", required: true },
                  { key: "headline", label: "headline", required: true },
                  { key: "author", label: "author", required: true },
                  { key: "datePublished", label: "datePublished", required: true },
                  { key: "dateModified", label: "dateModified", required: false },
                  { key: "publisher", label: "publisher", required: false },
                  { key: "mainEntityOfPage", label: "mainEntityOfPage", required: false },
                ].map((field) => {
                  const exists = field.key in article.jsonLd;
                  return (
                    <li
                      key={field.key}
                      className="flex items-center gap-2 text-xs"
                    >
                      {exists ? (
                        <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className={`h-3.5 w-3.5 ${field.required ? "text-red-500" : "text-yellow-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={field.required ? "M6 18L18 6M6 6l12 12" : "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                        </svg>
                      )}
                      <span className={exists ? "text-neutral-700" : field.required ? "text-red-600" : "text-yellow-600"}>
                        {field.label}
                        {field.required && !exists && " (必須)"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
