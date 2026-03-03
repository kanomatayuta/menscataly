import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ComplianceScoreBadge } from "@/components/admin/ComplianceScoreBadge";
import { ReviewActions } from "@/components/admin/ReviewActions";
import type { ArticleReviewItem } from "@/types/admin";

// ------------------------------------------------------------------
// Mock data
// ------------------------------------------------------------------

const MOCK_ARTICLES: Record<string, ArticleReviewItem> = {
  "rev-1": {
    id: "rev-1",
    articleId: "art-1",
    microcmsId: "mc-abc123",
    title: "AGA治療の基礎知識 — 原因・治療法・費用を徹底解説",
    slug: "aga-basic-guide",
    category: "aga",
    complianceScore: 96,
    status: "approved",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-01T06:30:00+09:00",
    reviewedAt: "2026-03-01T10:00:00+09:00",
    reviewedBy: "admin",
    reviewNotes: null,
  },
  "rev-2": {
    id: "rev-2",
    articleId: "art-2",
    microcmsId: "mc-def456",
    title: "メンズ医療脱毛おすすめクリニック比較2026",
    slug: "mens-hair-removal-clinics-2026",
    category: "hair-removal",
    complianceScore: 91,
    status: "pending",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-02T06:30:00+09:00",
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
  },
  "rev-3": {
    id: "rev-3",
    articleId: "art-3",
    microcmsId: null,
    title: "ED治療薬の種類と効果 — バイアグラ・シアリス・レビトラ",
    slug: "ed-medication-comparison",
    category: "ed",
    complianceScore: 78,
    status: "rejected",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-02T06:35:00+09:00",
    reviewedAt: "2026-03-02T11:00:00+09:00",
    reviewedBy: "admin",
    reviewNotes: "Compliance score too low. Multiple NG expressions found.",
  },
  "rev-4": {
    id: "rev-4",
    articleId: "art-4",
    microcmsId: "mc-ghi789",
    title: "メンズスキンケア入門 — 肌タイプ別おすすめルーティン",
    slug: "mens-skincare-routine",
    category: "skincare",
    complianceScore: 98,
    status: "approved",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-03T06:30:00+09:00",
    reviewedAt: "2026-03-03T08:00:00+09:00",
    reviewedBy: "admin",
    reviewNotes: null,
  },
  "rev-5": {
    id: "rev-5",
    articleId: "art-5",
    microcmsId: null,
    title: "フィナステリドとデュタステリドの違い — 効果・副作用・選び方",
    slug: "finasteride-vs-dutasteride",
    category: "aga",
    complianceScore: 88,
    status: "pending",
    authorName: "メンズカタリ編集部",
    generatedAt: "2026-03-03T06:35:00+09:00",
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
  },
};

// ------------------------------------------------------------------
// Dynamic content component (inside Suspense)
// ------------------------------------------------------------------

async function ArticleDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = MOCK_ARTICLES[id];

  if (!article) {
    return (
      <>
        <AdminHeader
          title="Article Not Found"
          breadcrumbs={[
            { label: "Articles", href: "/admin/articles" },
            { label: "Not Found" },
          ]}
        />
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <p className="text-sm text-neutral-500">
            Article with ID &quot;{id}&quot; was not found.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title="Article Review"
        breadcrumbs={[
          { label: "Articles", href: "/admin/articles" },
          { label: article.title },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Article details */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-neutral-900">
              {article.title}
            </h2>

            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="font-medium text-neutral-500">Category</dt>
                <dd className="mt-0.5 capitalize text-neutral-900">
                  {article.category}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">Slug</dt>
                <dd className="mt-0.5 font-mono text-xs text-neutral-700">
                  {article.slug}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">Author</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {article.authorName}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">Generated</dt>
                <dd className="mt-0.5 text-neutral-900">
                  {new Date(article.generatedAt).toLocaleString("ja-JP")}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">
                  Compliance Score
                </dt>
                <dd className="mt-1">
                  <ComplianceScoreBadge score={article.complianceScore} />
                </dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-500">microCMS ID</dt>
                <dd className="mt-0.5 font-mono text-xs text-neutral-700">
                  {article.microcmsId ?? "Not published"}
                </dd>
              </div>
            </dl>

            {article.reviewNotes && (
              <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4">
                <p className="mb-1 text-xs font-medium text-neutral-500">
                  Previous Review Notes
                </p>
                <p className="text-sm text-neutral-700">
                  {article.reviewNotes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Review actions */}
        <div>
          <ReviewActions
            articleId={article.id}
            currentStatus={article.status}
          />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

// Provide at least one static param for Cache Components build validation
export function generateStaticParams() {
  return [{ id: "rev-1" }];
}

type Props = {
  params: Promise<{ id: string }>;
};

export default function AdminArticleDetailPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-neutral-500">Loading article...</span>
        </div>
      }
    >
      <ArticleDetailContent params={params} />
    </Suspense>
  );
}
