import { AdminHeader } from "@/components/admin/AdminHeader";
import { ArticleTable } from "@/components/admin/ArticleTable";
import type { ArticleReviewItem } from "@/types/admin";

// ------------------------------------------------------------------
// Mock data
// ------------------------------------------------------------------

const MOCK_ARTICLES: ArticleReviewItem[] = [
  {
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
  {
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
  {
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
  {
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
  {
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
];

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminArticlesPage() {
  return (
    <>
      <AdminHeader
        title="Articles"
        breadcrumbs={[{ label: "Articles" }]}
      />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {MOCK_ARTICLES.length} articles total
        </p>
      </div>

      <ArticleTable articles={MOCK_ARTICLES} />
    </>
  );
}
