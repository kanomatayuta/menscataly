"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ComplianceScoreBadge } from "./ComplianceScoreBadge";
import type { ArticleReviewItem, ArticleAnalytics, ArticleGrowthRate, ReviewStatus, CategoryInfo } from "@/types/admin";

interface ArticleTableProps {
  articles: ArticleReviewItem[];
  analytics?: Map<string, ArticleAnalytics>;
  categories?: CategoryInfo[];
  updatedAtMap?: Map<string, string>;
  growthRates?: Map<string, ArticleGrowthRate>;
}

type SortColumn = "pageviews" | "searchClicks" | "affiliateClicks" | "affiliateCtr" | "conversions" | "revenue" | "growthRate" | null;
type SortDirection = "asc" | "desc";

const STATUS_STYLES: Record<ReviewStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-slate-100", text: "text-slate-700", label: "下書き" },
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
      className="sticky top-0 z-20 cursor-pointer select-none whitespace-nowrap bg-slate-50 px-2 py-2 text-right font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:px-4 md:py-3"
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
  return <span className="text-slate-300">-</span>;
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

function GrowthRateValue({ rate }: { rate: number | null | undefined }) {
  if (rate === null || rate === undefined) return <span className="text-slate-300">-</span>;
  const pct = (rate * 100).toFixed(1);
  if (rate > 0) return <span className="font-medium text-green-600">+{pct}%</span>;
  if (rate < 0) return <span className="font-medium text-red-600">{pct}%</span>;
  return <span className="text-slate-400">0.0%</span>;
}

export function ArticleTable({ articles, analytics, categories, updatedAtMap, growthRates }: ArticleTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Build category label map from dynamic categories
  const categoryLabels = useMemo(() => {
    const map: Record<string, string> = {};
    if (categories) {
      for (const cat of categories) {
        map[cat.slug] = cat.name;
      }
    }
    return map;
  }, [categories]);

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

  const filteredArticles = useMemo(() => {
    let result = articles;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.title.toLowerCase().includes(q));
    }
    if (filterCategory) {
      result = result.filter((a) => a.category === filterCategory);
    }
    if (filterStatus) {
      result = result.filter((a) => a.status === filterStatus);
    }
    return result;
  }, [articles, searchQuery, filterCategory, filterStatus]);

  const sortedArticles = useMemo(() => {
    if (!sortColumn) return filteredArticles;
    return [...filteredArticles].sort((a, b) => {
      if (sortColumn === "growthRate") {
        const grA = growthRates?.get(a.id)?.growthRate ?? -Infinity;
        const grB = growthRates?.get(b.id)?.growthRate ?? -Infinity;
        return sortDirection === "asc" ? grA - grB : grB - grA;
      }
      if (sortColumn === "affiliateCtr") {
        const statsA = analytics?.get(a.id);
        const statsB = analytics?.get(b.id);
        const ctrA = (statsA?.pageviews ?? 0) > 0 ? (statsA?.affiliateClicks ?? 0) / statsA!.pageviews : 0;
        const ctrB = (statsB?.pageviews ?? 0) > 0 ? (statsB?.affiliateClicks ?? 0) / statsB!.pageviews : 0;
        return sortDirection === "asc" ? ctrA - ctrB : ctrB - ctrA;
      }
      const statsA = analytics?.get(a.id);
      const statsB = analytics?.get(b.id);
      const valA = statsA?.[sortColumn] ?? 0;
      const valB = statsB?.[sortColumn] ?? 0;
      return sortDirection === "asc" ? valA - valB : valB - valA;
    });
  }, [filteredArticles, analytics, growthRates, sortColumn, sortDirection]);

  const hasActiveFilter = searchQuery || filterCategory || filterStatus;

  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">記事が見つかりません</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 md:gap-3 md:px-4 md:py-3">
        <div className="relative">
          <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="タイトル検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-36 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-400 md:w-48"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-1 focus:ring-slate-400 md:px-2.5"
        >
          <option value="">全カテゴリ</option>
          {categories?.map((cat) => (
            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none transition-colors focus:border-slate-400 focus:ring-1 focus:ring-slate-400 md:px-2.5"
        >
          <option value="">全ステータス</option>
          {Object.entries(STATUS_STYLES).map(([key, style]) => (
            <option key={key} value={key}>{style.label}</option>
          ))}
        </select>
        {hasActiveFilter && (
          <button
            onClick={() => { setSearchQuery(""); setFilterCategory(""); setFilterStatus(""); }}
            className="h-8 rounded-md px-2.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            クリア
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">
          {sortedArticles.length}/{articles.length}件
        </span>
      </div>

      {sortedArticles.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500">条件に一致する記事がありません</p>
        </div>
      ) : (
      <div className="max-h-[70vh] overflow-auto -webkit-overflow-scrolling-touch">
      <table className="w-full min-w-[900px] text-left text-xs md:text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 top-0 z-30 max-w-[200px] bg-slate-50 px-2 py-2 font-medium text-slate-600 after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-slate-200 md:max-w-[300px] md:px-4 md:py-3">タイトル</th>
            <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2 font-medium text-slate-600 md:px-4 md:py-3">カテゴリ</th>
            <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2 font-medium text-slate-600 md:px-4 md:py-3">ステータス</th>
            <SortableHeader label="PV" column="pageviews" active={sortColumn === "pageviews"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="伸び率" column="growthRate" active={sortColumn === "growthRate"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="検索CL" column="searchClicks" active={sortColumn === "searchClicks"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="広告CL" column="affiliateClicks" active={sortColumn === "affiliateClicks"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="広告CTR" column="affiliateCtr" active={sortColumn === "affiliateCtr"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="CV" column="conversions" active={sortColumn === "conversions"} direction={sortDirection} onClick={handleSort} />
            <SortableHeader label="収益" column="revenue" active={sortColumn === "revenue"} direction={sortDirection} onClick={handleSort} />
            <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2 font-medium text-slate-600 md:px-4 md:py-3">コンプラ</th>
            <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2 font-medium text-slate-600 md:px-4 md:py-3">作成日</th>
            <th className="sticky top-0 z-20 whitespace-nowrap bg-slate-50 px-2 py-2 font-medium text-slate-600 md:px-4 md:py-3">更新日</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedArticles.map((article) => {
            const statusStyle = STATUS_STYLES[article.status];
            const stats = analytics?.get(article.id);
            const pv = stats?.pageviews ?? 0;
            const searchCl = stats?.searchClicks ?? 0;
            const affiliateCl = stats?.affiliateClicks ?? 0;
            const cv = stats?.conversions ?? 0;
            const rev = stats?.revenue ?? 0;
            return (
              <tr key={article.id} className="group/row hover:bg-blue-50/40">
                <td className="sticky left-0 z-10 max-w-[200px] bg-white px-2 py-1.5 font-medium after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-slate-200 group-hover/row:bg-blue-50/40 md:max-w-[300px] md:px-4 md:py-2">
                  <Link
                    href={`/admin/articles/${article.id}`}
                    className="flex items-center gap-2 text-slate-800 hover:text-blue-600 hover:underline md:gap-2.5"
                  >
                    {article.thumbnailUrl ? (
                      <Image
                        src={`${article.thumbnailUrl}?w=120&h=64&fit=crop`}
                        alt=""
                        width={56}
                        height={32}
                        className="hidden h-8 w-14 shrink-0 rounded object-cover md:block"
                      />
                    ) : (
                      <span className="hidden h-8 w-14 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400 md:flex">
                        No
                      </span>
                    )}
                    <span className="truncate">{article.title}</span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-600 md:px-4 md:py-3">
                  {categoryLabels[article.category] ?? article.category}
                </td>
                <td className="px-2 py-2 md:px-4 md:py-3">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {statusStyle.label}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600 md:px-4 md:py-3">
                  {pv === 0 ? <ZeroValue /> : formatNumber(pv)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600 md:px-4 md:py-3">
                  <GrowthRateValue rate={growthRates?.get(article.id)?.growthRate} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600 md:px-4 md:py-3">
                  {searchCl === 0 ? <ZeroValue /> : formatNumber(searchCl)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600 md:px-4 md:py-3">
                  {affiliateCl === 0 ? <ZeroValue /> : formatNumber(affiliateCl)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600 md:px-4 md:py-3">
                  <AffiliateCtrValue affiliateClicks={affiliateCl} pageviews={pv} />
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600 md:px-4 md:py-3">
                  {cv === 0 ? <ZeroValue /> : formatNumber(cv)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-slate-600 md:px-4 md:py-3">
                  <RevenueValue value={rev} />
                </td>
                <td className="px-2 py-2 md:px-4 md:py-3">
                  <ComplianceScoreBadge score={article.complianceScore} />
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-500 md:px-4 md:py-3">
                  {formatDate(article.generatedAt)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-slate-500 md:px-4 md:py-3">
                  {updatedAtMap?.get(article.id) ? formatDate(updatedAtMap.get(article.id)!) : <ZeroValue />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      )}
    </div>
  );
}
