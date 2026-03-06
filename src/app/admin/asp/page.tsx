import { connection } from "next/server";
import { getCategories } from "@/lib/microcms/client";
import AspManagement from "@/components/admin/AspManagement";
import type { CategoryOption } from "@/components/admin/AspManagement";

/** PPR プリレンダリング時の connection() 拒否はエラーではないため、ログをスキップ */
function isPprRejection(err: unknown): boolean {
  return (err instanceof Error && (err as { digest?: string }).digest === "HANGING_PROMISE_REJECTION");
}

// ------------------------------------------------------------------
// Data fetching — microCMS からカテゴリ取得
// ------------------------------------------------------------------

async function fetchCategories(): Promise<CategoryOption[]> {
  try {
    await connection();
  } catch {
    // PPR fallback
  }
  try {
    const response = await getCategories({ limit: 100 });
    return response.contents.map((cat) => ({
      slug: cat.slug ?? cat.id,
      name: cat.name,
    }));
  } catch (err) {
    if (!isPprRejection(err)) console.error("[admin/asp] Failed to fetch categories:", err);
    return [
      { slug: "aga", name: "AGA・薄毛" },
      { slug: "hair-removal", name: "メンズ脱毛" },
      { slug: "skincare", name: "スキンケア" },
      { slug: "ed", name: "ED治療" },
      { slug: "column", name: "コラム" },
    ];
  }
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default async function AdminAspPage() {
  const categories = await fetchCategories();
  return <AspManagement categories={categories} />;
}
