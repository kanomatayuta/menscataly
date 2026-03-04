import Link from "next/link";
import { ComplianceScoreBadge } from "./ComplianceScoreBadge";
import type { ArticleReviewItem, ReviewStatus } from "@/types/admin";

interface ArticleTableProps {
  articles: ArticleReviewItem[];
}

const STATUS_STYLES: Record<ReviewStatus, { bg: string; text: string }> = {
  draft: { bg: "bg-neutral-100", text: "text-neutral-700" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-800" },
  approved: { bg: "bg-green-100", text: "text-green-800" },
  rejected: { bg: "bg-red-100", text: "text-red-800" },
  revision: { bg: "bg-orange-100", text: "text-orange-800" },
  published: { bg: "bg-blue-100", text: "text-blue-800" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ArticleTable({ articles }: ArticleTableProps) {
  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">No articles found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-3 font-medium text-neutral-600">Title</th>
            <th className="px-4 py-3 font-medium text-neutral-600">
              Category
            </th>
            <th className="px-4 py-3 font-medium text-neutral-600">
              Compliance
            </th>
            <th className="px-4 py-3 font-medium text-neutral-600">Status</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Date</th>
            <th className="px-4 py-3 font-medium text-neutral-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {articles.map((article) => {
            const statusStyle = STATUS_STYLES[article.status];
            return (
              <tr key={article.id} className="hover:bg-neutral-50">
                <td className="max-w-xs truncate px-4 py-3 font-medium text-neutral-900">
                  {article.title}
                </td>
                <td className="px-4 py-3 text-neutral-600 capitalize">
                  {article.category}
                </td>
                <td className="px-4 py-3">
                  <ComplianceScoreBadge score={article.complianceScore} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {article.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {formatDate(article.generatedAt)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/articles/${article.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Review
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
