import Link from "next/link";
import { ComplianceScoreBadge } from "./ComplianceScoreBadge";
import type { ArticleReviewItem, ArticleAnalytics, ReviewStatus } from "@/types/admin";

interface ArticleTableProps {
  articles: ArticleReviewItem[];
  analytics?: Map<string, ArticleAnalytics>;
}

const STATUS_STYLES: Record<ReviewStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-neutral-100", text: "text-neutral-700", label: "下書き" },
  pending: { bg: "bg-yellow-100", text: "text-yellow-800", label: "レビュー待ち" },
  approved: { bg: "bg-green-100", text: "text-green-800", label: "承認済み" },
  rejected: { bg: "bg-red-100", text: "text-red-800", label: "却下" },
  revision: { bg: "bg-orange-100", text: "text-orange-800", label: "修正依頼" },
  published: { bg: "bg-blue-100", text: "text-blue-800", label: "公開済み" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("ja-JP");
}

function formatCurrency(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function ArticleTable({ articles, analytics }: ArticleTableProps) {
  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
        <p className="text-sm text-neutral-500">記事が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-4 py-3 font-medium text-neutral-600">タイトル</th>
            <th className="px-4 py-3 font-medium text-neutral-600">
              カテゴリ
            </th>
            <th className="px-4 py-3 font-medium text-neutral-600">
              コンプライアンス
            </th>
            <th className="px-4 py-3 font-medium text-neutral-600">ステータス</th>
            <th className="px-4 py-3 font-medium text-neutral-600 text-right">PV</th>
            <th className="px-4 py-3 font-medium text-neutral-600 text-right">クリック</th>
            <th className="px-4 py-3 font-medium text-neutral-600 text-right">CV</th>
            <th className="px-4 py-3 font-medium text-neutral-600 text-right">収益</th>
            <th className="px-4 py-3 font-medium text-neutral-600">日付</th>
            <th className="px-4 py-3 font-medium text-neutral-600">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {articles.map((article) => {
            const statusStyle = STATUS_STYLES[article.status];
            const stats = analytics?.get(article.id);
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
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {statusStyle.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {formatNumber(stats?.pageviews ?? 0)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {formatNumber(stats?.clicks ?? 0)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {formatNumber(stats?.conversions ?? 0)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-neutral-900">
                  {formatCurrency(stats?.revenue ?? 0)}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {formatDate(article.generatedAt)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/articles/${article.id}`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    レビュー
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
