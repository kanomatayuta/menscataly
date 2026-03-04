import { Suspense } from "react";
import { headers } from "next/headers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ArticleTable } from "@/components/admin/ArticleTable";
import type { ArticleReviewItem } from "@/types/admin";

// ------------------------------------------------------------------
// Data fetching (Server Component - direct fetch to API route)
// ------------------------------------------------------------------

interface ArticlesResponse {
  articles: ArticleReviewItem[];
  total: number;
}

async function fetchArticles(): Promise<ArticlesResponse> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  const res = await fetch(`${protocol}://${host}/api/admin/articles`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${process.env.ADMIN_API_KEY ?? ""}`,
    },
  });

  if (!res.ok) {
    return { articles: [], total: 0 };
  }

  return res.json();
}

// ------------------------------------------------------------------
// Async content component (wrapped in Suspense)
// ------------------------------------------------------------------

async function ArticlesContent() {
  const { articles, total } = await fetchArticles();

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">{total} articles total</p>
      </div>

      <ArticleTable articles={articles} />
    </>
  );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminArticlesPage() {
  return (
    <>
      <AdminHeader title="Articles" breadcrumbs={[{ label: "Articles" }]} />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">
              Loading articles...
            </span>
          </div>
        }
      >
        <ArticlesContent />
      </Suspense>
    </>
  );
}
