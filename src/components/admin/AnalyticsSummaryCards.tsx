import { StatCard } from "./StatCard";

interface AnalyticsSummaryCardsProps {
  totalPageviews: number;
  totalSearchClicks: number;
  totalAffiliateClicks: number;
  totalConversions: number;
  totalRevenue: number;
}

export function AnalyticsSummaryCards({
  totalPageviews,
  totalSearchClicks,
  totalAffiliateClicks,
  totalConversions,
  totalRevenue,
}: AnalyticsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="総PV"
        value={totalPageviews.toLocaleString("ja-JP")}
      />
      <StatCard
        title="検索CL"
        value={totalSearchClicks.toLocaleString("ja-JP")}
      />
      <StatCard
        title="広告CL"
        value={totalAffiliateClicks.toLocaleString("ja-JP")}
        variant="purple"
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
