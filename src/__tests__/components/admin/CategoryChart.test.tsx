/**
 * CategoryChart コンポーネント テスト
 *
 * 3軸切り替え(記事数/PV × 日別/月別 × 作成/更新)とカテゴリサマリーカードの表示を検証する。
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryChart } from "@/components/admin/CategoryChart";
import type { CategoryTrendDataPoint, CategoryInfo } from "@/types/admin";

// recharts は jsdom でレンダリングできないためモック
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const CATEGORIES: CategoryInfo[] = [
  { slug: "aga", name: "AGA治療" },
  { slug: "hair-removal", name: "医療脱毛" },
  { slug: "skincare", name: "スキンケア" },
];

const ARTICLE_COUNT: Record<string, number> = { aga: 10, "hair-removal": 8, skincare: 6 };

const DAILY_CREATED: CategoryTrendDataPoint[] = [
  { date: "3/4", aga: 5, "hair-removal": 3, skincare: 2 },
];
const DAILY_UPDATED: CategoryTrendDataPoint[] = [
  { date: "3/5", aga: 4, "hair-removal": 2, skincare: 3 },
];
const MONTHLY_CREATED: CategoryTrendDataPoint[] = [
  { date: "2026/3", aga: 10, "hair-removal": 8, skincare: 6 },
];
const MONTHLY_UPDATED: CategoryTrendDataPoint[] = [
  { date: "2026/3", aga: 8, "hair-removal": 7, skincare: 5 },
];
const DAILY_PV: CategoryTrendDataPoint[] = [
  { date: "3/4", aga: 120, "hair-removal": 80, skincare: 50 },
];
const MONTHLY_PV: CategoryTrendDataPoint[] = [
  { date: "2026/3", aga: 3600, "hair-removal": 2400, skincare: 1500 },
];
const EMPTY: CategoryTrendDataPoint[] = [];

function renderChart(overrides: Partial<Parameters<typeof CategoryChart>[0]> = {}) {
  return render(
    <CategoryChart
      dailyCreatedData={DAILY_CREATED}
      dailyUpdatedData={DAILY_UPDATED}
      monthlyCreatedData={MONTHLY_CREATED}
      monthlyUpdatedData={MONTHLY_UPDATED}
      dailyPvData={DAILY_PV}
      monthlyPvData={MONTHLY_PV}
      categories={CATEGORIES}
      articleCountByCategory={ARTICLE_COUNT}
      {...overrides}
    />,
  );
}

describe("CategoryChart", () => {
  it("チャートタイトル「カテゴリ別」が表示される", () => {
    renderChart();
    expect(screen.getByText("カテゴリ別")).toBeInTheDocument();
  });

  it("メトリクストグル(記事数/PV)が表示される", () => {
    renderChart();
    expect(screen.getByRole("button", { name: "記事数" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PV" })).toBeInTheDocument();
  });

  it("期間トグル(日別/月別)が表示される", () => {
    renderChart();
    expect(screen.getByRole("button", { name: "日別" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "月別" })).toBeInTheDocument();
  });

  it("日付種別トグル(作成/更新)が表示される", () => {
    renderChart();
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
  });

  it("デフォルトで「記事数」「日別」「作成」がアクティブ", () => {
    renderChart();
    expect(screen.getByRole("button", { name: "記事数" }).className).toContain("bg-neutral-900");
    expect(screen.getByRole("button", { name: "日別" }).className).toContain("bg-neutral-900");
    expect(screen.getByRole("button", { name: "作成" }).className).toContain("bg-neutral-900");
  });

  it("「月別」をクリックすると期間が切り替わる", () => {
    renderChart();
    fireEvent.click(screen.getByRole("button", { name: "月別" }));
    expect(screen.getByRole("button", { name: "月別" }).className).toContain("bg-neutral-900");
    expect(screen.getByRole("button", { name: "日別" }).className).not.toContain("bg-neutral-900");
    // 他のトグルは変わらない
    expect(screen.getByRole("button", { name: "記事数" }).className).toContain("bg-neutral-900");
    expect(screen.getByRole("button", { name: "作成" }).className).toContain("bg-neutral-900");
  });

  it("「更新」をクリックすると日付種別が切り替わる", () => {
    renderChart();
    fireEvent.click(screen.getByRole("button", { name: "更新" }));
    expect(screen.getByRole("button", { name: "更新" }).className).toContain("bg-neutral-900");
    expect(screen.getByRole("button", { name: "作成" }).className).not.toContain("bg-neutral-900");
    // 他のトグルは変わらない
    expect(screen.getByRole("button", { name: "日別" }).className).toContain("bg-neutral-900");
    expect(screen.getByRole("button", { name: "記事数" }).className).toContain("bg-neutral-900");
  });

  it("「PV」をクリックすると折れ線グラフに切り替わり、作成/更新トグルが非表示になる", () => {
    renderChart();
    fireEvent.click(screen.getByRole("button", { name: "PV" }));
    expect(screen.getByRole("button", { name: "PV" }).className).toContain("bg-neutral-900");
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("bar-chart")).not.toBeInTheDocument();
    // 作成/更新トグルが非表示
    expect(screen.queryByRole("button", { name: "作成" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更新" })).not.toBeInTheDocument();
  });

  it("PVモードで月別に切り替えできる", () => {
    renderChart();
    fireEvent.click(screen.getByRole("button", { name: "PV" }));
    fireEvent.click(screen.getByRole("button", { name: "月別" }));
    expect(screen.getByRole("button", { name: "月別" }).className).toContain("bg-neutral-900");
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("PVモードから記事数モードに戻すと棒グラフと作成/更新トグルが復元される", () => {
    renderChart();
    fireEvent.click(screen.getByRole("button", { name: "PV" }));
    fireEvent.click(screen.getByRole("button", { name: "記事数" }));
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "作成" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
  });

  it("デフォルトで棒グラフがレンダリングされる", () => {
    renderChart();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart")).toBeInTheDocument();
  });

  it("データが空の場合、空状態メッセージが表示される", () => {
    renderChart({
      dailyCreatedData: EMPTY,
      dailyUpdatedData: EMPTY,
      monthlyCreatedData: EMPTY,
      monthlyUpdatedData: EMPTY,
      dailyPvData: EMPTY,
      monthlyPvData: EMPTY,
    });
    expect(screen.getByText("まだデータがありません")).toBeInTheDocument();
    expect(screen.queryByTestId("responsive-container")).not.toBeInTheDocument();
  });

  it("日別作成にデータがあり月別作成が空の場合、切り替えで空状態が表示される", () => {
    renderChart({ monthlyCreatedData: EMPTY });
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "月別" }));
    expect(screen.getByText("まだデータがありません")).toBeInTheDocument();
  });

  it("PVモードでデータが空の場合、PV用の空状態メッセージが表示される", () => {
    renderChart({ dailyPvData: EMPTY });
    fireEvent.click(screen.getByRole("button", { name: "PV" }));
    expect(screen.getByText("まだデータがありません")).toBeInTheDocument();
    expect(screen.getByText("GA4連携後、PVデータが表示されます")).toBeInTheDocument();
  });

  it("全カテゴリのサマリーカードが表示される", () => {
    renderChart();
    for (const cat of CATEGORIES) {
      expect(screen.getByText(cat.name)).toBeInTheDocument();
    }
  });

  it("各カテゴリの記事数が正しく表示される", () => {
    renderChart();
    expect(screen.getByText("10記事")).toBeInTheDocument();
    expect(screen.getByText("8記事")).toBeInTheDocument();
    expect(screen.getByText("6記事")).toBeInTheDocument();
  });

  it("各カテゴリに対応するBarが存在する", () => {
    renderChart();
    const bars = screen.getAllByTestId("bar");
    expect(bars).toHaveLength(CATEGORIES.length);
  });

  it("PVモードで各カテゴリに対応するLineが存在する", () => {
    renderChart();
    fireEvent.click(screen.getByRole("button", { name: "PV" }));
    const lines = screen.getAllByTestId("line");
    expect(lines).toHaveLength(CATEGORIES.length);
  });
});
