"use client";

import { useState } from "react";
import Link from "next/link";
import type { RankingTab, RankingData } from "@/types/admin";

interface ArticleRankingProps {
  rankings: RankingData;
}

const TABS: { value: RankingTab; label: string }[] = [
  { value: "pageviews", label: "PV" },
  { value: "affiliateCtr", label: "広告CTR" },
  { value: "revenue", label: "収益" },
];

function RankChangeIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined) {
    return <span className="text-xs font-medium text-blue-600">NEW</span>;
  }
  const diff = previous - current;
  if (diff > 0) {
    return <span className="text-xs font-medium text-green-600">↑{diff}</span>;
  }
  if (diff < 0) {
    return <span className="text-xs font-medium text-red-600">↓{Math.abs(diff)}</span>;
  }
  return <span className="text-xs text-slate-400">→</span>;
}

export function ArticleRanking({ rankings }: ArticleRankingProps) {
  const [activeTab, setActiveTab] = useState<RankingTab>("pageviews");

  const items = rankings[activeTab];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-4 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="flex h-[300px] flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-slate-600">まだデータがありません</p>
          <p className="text-xs text-slate-400">
            記事のPVが集計されると自動表示されます
          </p>
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.articleId}
              className={`flex items-center gap-3 rounded px-2 py-1.5 ${
                item.rank === 1 ? "border-l-4 border-amber-400 font-bold" : ""
              } ${item.rank <= 3 && item.rank > 1 ? "font-semibold" : ""}`}
            >
              <span className="w-6 text-center text-sm text-slate-500">
                {item.rank}
              </span>
              <Link
                href={`/admin/articles/${item.articleId}`}
                className="min-w-0 flex-1 truncate text-sm text-slate-800 hover:text-blue-600 hover:underline"
              >
                {item.title}
              </Link>
              <span className="shrink-0 text-sm tabular-nums text-slate-600">
                {item.formattedValue}
              </span>
              <span className="w-10 shrink-0 text-right">
                <RankChangeIndicator current={item.rank} previous={item.previousRank} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
