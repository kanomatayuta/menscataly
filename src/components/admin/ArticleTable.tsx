"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ComplianceScoreBadge } from "./ComplianceScoreBadge";
import type { ArticleReviewItem, ArticleAnalytics, ReviewStatus } from "@/types/admin";

interface ArticleTableProps {
  articles: ArticleReviewItem[];
  analytics?: Map<string, ArticleAnalytics>;
}

type SortColumn = "pageviews" | "searchClicks" | "affiliateClicks" | "conversions" | "revenue" | null;
type SortDirection = "asc" | "desc";

const CATEGORY_LABELS: Record<string, string> = {
  aga: "AGA治療",
  ed: "ED治療",
  "hair-removal": "医療脱毛",
  skincare: "スキンケア",
  column: "サプリメント",
};

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

function SortableHeader({
  label,
  column,
  active,
  direction,
  onClick,
}: {
  label: string;
  column: SortColumn;
  active: boolean;
  direction: SortDirection;
  onClick: (col: SortColumn) => void;
}) {
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 text-right font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
      onClick={() => onClick(column)}
    >
      {label}
      <span className="ml-1 text-xs">
        {active ? (direction === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </th>
  );
}

function ZeroValue() {
  return <span className="text-neutral-300">-</span>;
}

function RevenueValue({ value }: { value: number }) {
  if (value === 0) return <ZeroValue />;
  const formatted = `¥${formatNumber(value)}`;
  if (value >= 10000) {
    return <span className="rounded bg-green-50 px-1 font-bold text-green-700">{formatted}</span>;
  }
  if (value >= 1000) {
    return <span className="font-bold text-green-700">{formatted}</span>;
  }
  return <>{formatted}</>;
}

function AffiliateCtrValue({ affiliateClicks, pageviews }: { affiliateClicks: number; pageviews: number }) {
  if (pageviews === 0) return <ZeroValue />;
  const ctr = (affiliateClicks / pageviews) * 100;
  const formatted = `${ctr.toFixed(1)}%`;
  if (ctr >= 5) {
    return <span className="font-bold text-green-700">{formatted}</span>;
  }
  return <>{formatted}</>;
}

export function ArticleTable({ articles, analytics }: ArticleTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      if (sortDirection === "desc") {
        setSortDirection("asc");
      } else {
        setSortColumn(null);
        setSortDirection("desc");
      }
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedArticles = useMemo(() => {
    if (!sortColumn) return articles;
    return [...articles].sort((a, b) => {
      const statsA = analytics?.get(a.id);
      const statsB = analytics?.get(b.id);
      const valA = statsA?.[sortColumn] ?? 0;
      const valB = statsB?.[sortColumn] ?? 0;
      return sortDirection === "asc" ? valA - valB : valB - valA;
    });
  }, [articles, analytics, sortColumn, sortDirection]);

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
            <th className="px-4 py-3 font-medium text-neutral-600">カテゴリ</th>
            <SortableHeader label="PV" column="pageviews" active={sortColumn === "pageviews"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="検索CL" column="searchClicks" active={sortColumn === "searchClicks"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="広告CL" column="affiliateClicks" active={sortColumn === "affiliateClicks"} direction={sortDirection} onClick={handleSort} />
            <th className="px-4 py-3 text-right font-medium text-neutral-600">広告CTR</th>
            <SortableHeader label="CV" column="conversions" active={sortColumn === "conversions"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="収益" column="revenue" active={sortColumn === "revenue"} direction={sortDirection} onClick={handleSort} />
            <th className="px-4 py-3 font-medium text-neutral-600">ステータス</th>
            <th className="px-4 py-3 font-medium text-neutral-600">コンプライアンス</th>
            <th className="px-4 py-3 font-medium text-neutral-600">日付</th>
            <th className="px-4 py-3 font-medium text-neutral-600">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {sortedArticles.map((article) => {
            const statusStyle = STATUS_STYLES[article.status];
            const stats = analytics?.get(article.id);
            const pv = stats?.pageviews ?? 0;
            const searchCl = stats?.searchClicks ?? 0;
            const affiliateCl = stats?.affiliateClicks ?? 0;
            const cv = stats?.conversions ?? 0;
            const rev = stats?.revenue ?? 0;
            return (
              <tr key={article.id} className="hover:bg-neutral-50">
                <td className="min-w-[200px] truncate px-4 py-3 font-medium text-neutral-900">
                  {article.title}
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  {CATEGORY_LABELS[article.category] ?? article.category}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {pv === 0 ? <ZeroValue /> : formatNumber(pv)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {searchCl === 0 ? <ZeroValue /> : formatNumber(searchCl)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {affiliateCl === 0 ? <ZeroValue /> : formatNumber(affiliateCl)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  <AffiliateCtrValue affiliateClicks={affiliateCl} pageviews={pv} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  {cv === 0 ? <ZeroValue /> : formatNumber(cv)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                  <RevenueValue value={rev} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {statusStyle.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ComplianceScoreBadge score={article.complianceScore} />
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
