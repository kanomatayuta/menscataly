import { StatCard } from "./StatCard";
import type { ArticlesSummary } from "@/types/admin";

interface AnalyticsSummaryCardsProps extends ArticlesSummary {}

export function AnalyticsSummaryCards({
  totalPageviews,
  totalClicks,
  totalConversions,
  totalRevenue,
}: AnalyticsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="総PV"
        value={totalPageviews.toLocaleString("ja-JP")}
      />
      <StatCard
        title="総クリック"
        value={totalClicks.toLocaleString("ja-JP")}
      />
      <StatCard
        title="総CV"
        value={totalConversions.toLocaleString("ja-JP")}
      />
      <StatCard
        title="総収益"
        value={`¥${totalRevenue.toLocaleString("ja-JP")}`}
        variant={totalRevenue > 0 ? "success" : "default"}
      />
    </div>
  );
}
