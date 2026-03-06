"use client";

interface HealthDistribution {
  healthy: number;
  needsImprovement: number;
  critical: number;
}

interface HealthScoreDistributionChartProps {
  distribution: HealthDistribution;
  totalArticles: number;
}

export function HealthScoreDistributionChart({
  distribution,
  totalArticles,
}: HealthScoreDistributionChartProps) {
  if (totalArticles === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">ヘルススコアデータなし</p>
      </div>
    );
  }

  const segments = [
    {
      label: "良好",
      count: distribution.healthy,
      color: "bg-green-500",
      textColor: "text-green-700",
      bgLight: "bg-green-50",
    },
    {
      label: "改善必要",
      count: distribution.needsImprovement,
      color: "bg-amber-500",
      textColor: "text-amber-700",
      bgLight: "bg-amber-50",
    },
    {
      label: "要注意",
      count: distribution.critical,
      color: "bg-red-500",
      textColor: "text-red-700",
      bgLight: "bg-red-50",
    },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-slate-600">スコア分布</h3>

      {/* Horizontal stacked bar */}
      <div className="mb-4 flex h-6 w-full overflow-hidden rounded-full bg-slate-100">
        {segments.map((seg) => {
          const pct = totalArticles > 0 ? (seg.count / totalArticles) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={seg.label}
              className={`${seg.color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${seg.count}件 (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {segments.map((seg) => {
          const pct = totalArticles > 0 ? (seg.count / totalArticles) * 100 : 0;
          return (
            <div
              key={seg.label}
              className="flex items-center justify-between rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${seg.color}`} />
                <span className="text-sm text-slate-700">{seg.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${seg.textColor}`}>
                  {seg.count}件
                </span>
                <span className="text-xs text-slate-400">
                  {pct.toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-3 border-t border-slate-100 pt-3 text-center">
        <span className="text-xs text-slate-400">
          全{totalArticles}件
        </span>
      </div>
    </div>
  );
}
