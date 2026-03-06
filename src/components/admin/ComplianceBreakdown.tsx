"use client";

import type { ComplianceScoreBreakdown } from "@/types/admin";

interface ComplianceBreakdownProps {
  breakdown: ComplianceScoreBreakdown;
  overall: number;
}

const CATEGORIES = [
  { key: "yakkinhou" as const, label: "薬機法", description: "第66条・67条準拠" },
  { key: "keihinhou" as const, label: "景表法", description: "不当表示防止" },
  { key: "sutema" as const, label: "ステマ規制", description: "PR表記・広告表示" },
  { key: "eeat" as const, label: "E-E-A-T", description: "監修者・参考文献・更新日" },
];

function getScoreColor(score: number): string {
  if (score >= 95) return "bg-green-500";
  if (score >= 80) return "bg-yellow-500";
  return "bg-red-500";
}

function getScoreTextColor(score: number): string {
  if (score >= 95) return "text-green-700";
  if (score >= 80) return "text-yellow-700";
  return "text-red-700";
}

export function ComplianceBreakdown({ breakdown, overall }: ComplianceBreakdownProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          コンプライアンススコア内訳
        </h3>
        <span
          className={`text-lg font-bold ${getScoreTextColor(overall)}`}
        >
          {overall}%
        </span>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map(({ key, label, description }) => {
          const score = breakdown[key];
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    {label}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">
                    {description}
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${getScoreTextColor(score)}`}
                >
                  {score}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getScoreColor(score)}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
