import { StatCard } from "./StatCard";

interface AnalyticsSummaryCardsProps {
  totalPageviews: number;
  totalSearchClicks: number;
  totalAffiliateClicks: number;
  totalRevenue: number;
  totalArticles?: number;
  /** @deprecated no longer shown as a card; kept for backward-compatibility */
  totalConversions?: number;
}

export function AnalyticsSummaryCards({
  totalPageviews,
  totalSearchClicks,
  totalAffiliateClicks,
  totalRevenue,
  totalArticles = 0,
}: AnalyticsSummaryCardsProps) {
  // Card 1: 総PV — subtitle shows per-article average
  const avgPv =
    totalArticles > 0
      ? (totalPageviews / totalArticles).toFixed(1)
      : "0.0";
  const pvSubtitle = `記事平均 ${avgPv} PV`;

  // Card 2: 検索CL — subtitle changes when data is not yet available
  const searchSubtitle =
    totalSearchClicks === 0 ? "GSCデータ蓄積中" : "過去30日間 (GSC)";

  // Card 3: 広告CTR
  const ctrValue =
    totalPageviews > 0
      ? `${((totalAffiliateClicks / totalPageviews) * 100).toFixed(1)}%`
      : "-";
  const ctrSubtitle = `広告CL ${totalAffiliateClicks}件 / PV ${totalPageviews}件`;

  // Card 4: 総収益
  const revenueVariant = totalRevenue > 0 ? "success" : "warning";
  const revenueSubtitle =
    totalRevenue > 0 ? "過去30日間" : "ASP承認後に計上";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        title="総記事数"
        value={totalArticles.toLocaleString("ja-JP")}
        variant="default"
        subtitle="公開済み記事"
      />
      <StatCard
        title="総PV"
        value={totalPageviews.toLocaleString("ja-JP")}
        variant="blue"
        subtitle={pvSubtitle}
      />
      <StatCard
        title="検索CL"
        value={totalSearchClicks.toLocaleString("ja-JP")}
        variant="success"
        subtitle={searchSubtitle}
      />
      <StatCard
        title="広告CTR"
        value={ctrValue}
        variant="purple"
        subtitle={ctrSubtitle}
      />
      <StatCard
        title="総収益"
        value={`¥${totalRevenue.toLocaleString("ja-JP")}`}
        variant={revenueVariant}
        subtitle={revenueSubtitle}
      />
    </div>
  );
}
