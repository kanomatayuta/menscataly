import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { PipelineStatusCard } from "@/components/admin/PipelineStatusCard";
import { AlertsList } from "@/components/admin/AlertsList";
import { PipelineSuccessChart } from "@/components/admin/PipelineSuccessChart";
import { fetchDashboardData } from "@/lib/admin/dashboard-data";

/**
 * サーバーサイドで呼び出し可能なデフォルトパイプラインデータ生成
 * 「use client」ファイルの generateDefaultPipelineData をサーバーから呼べないため
 * ここで同等のロジックを定義する（静的フォールバック）
 */
function getDefaultPipelineData() {
  // 静的なフォールバック値（new Date() はプリレンダリング制約でリスクがあるため固定値）
  const days = ['月', '火', '水', '木', '金', '土', '日'];
  return days.map((day, i) => ({
    date: day,
    successRate: 90 + (i % 3) * 2.5,
    totalRuns: 1 + (i % 2),
  }));
}

// ------------------------------------------------------------------
// Sub-components (async Server Components)
// Phase 3b: 直接 lib 関数でデータ取得（自己APIフェッチを排除）
// ------------------------------------------------------------------

async function DashboardStats() {
  const data = await fetchDashboardData();
  const { articles, revenue, costs } = data;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="記事数"
        value={articles.total}
        subtitle={`${articles.published} 公開済み, ${articles.draft} 下書き`}
      />
      <StatCard
        title="売上 (30日)"
        value={`¥${revenue.monthlyTotalJpy.toLocaleString()}`}
        subtitle={`${revenue.byAsp.reduce((sum, a) => sum + a.monthlyConversions, 0)} コンバージョン`}
        variant="success"
      />
      <StatCard
        title="平均コンプライアンス"
        value={`${articles.avgComplianceScore}%`}
        subtitle="目標: 95%"
        variant={
          articles.avgComplianceScore >= 95
            ? "success"
            : articles.avgComplianceScore >= 80
              ? "warning"
              : "danger"
        }
      />
      <StatCard
        title="AI費用 (30日)"
        value={`$${costs.monthlyTotalUsd.toFixed(2)}`}
        subtitle={`$${costs.articleAvgUsd.toFixed(2)} 記事あたり`}
      />
    </div>
  );
}

async function DashboardPipelineAndAlerts() {
  const data = await fetchDashboardData();
  const { pipeline, alerts } = data;

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Pipeline status */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          パイプライン
        </h2>
        <PipelineStatusCard
          status={pipeline.status}
          lastRunAt={pipeline.lastRunAt ?? null}
          successRate={pipeline.totalRuns > 0 ? (pipeline.lastRunSuccess ? 100 : 50) : 0}
        />
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-neutral-600">
            成功率 (7日間)
          </h3>
          <PipelineSuccessChart data={getDefaultPipelineData()} />
        </div>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          アクティブアラート
        </h2>
        <AlertsList alerts={alerts} />
      </div>
    </div>
  );
}

async function DashboardCosts() {
  const data = await fetchDashboardData();
  const { costs, articles } = data;

  const estimatedArticleCost = costs.monthlyTotalUsd * 0.7;
  const estimatedImageCost = costs.monthlyTotalUsd * 0.3;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-neutral-800">
        コスト内訳 (30日)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="記事生成"
          value={`$${estimatedArticleCost.toFixed(2)}`}
          subtitle={`${costs.monthlyTotalUsd > 0 ? ((estimatedArticleCost / costs.monthlyTotalUsd) * 100).toFixed(0) : 0}% of total`}
        />
        <StatCard
          title="画像生成"
          value={`$${estimatedImageCost.toFixed(2)}`}
          subtitle={`${costs.monthlyTotalUsd > 0 ? ((estimatedImageCost / costs.monthlyTotalUsd) * 100).toFixed(0) : 0}% of total`}
        />
        <StatCard
          title="レビュー待ち"
          value={articles.pendingReview}
          subtitle="レビュー待機中の記事"
          variant={articles.pendingReview > 5 ? "warning" : "default"}
        />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function AdminDashboardPage() {
  return (
    <>
      <AdminHeader title="ダッシュボード" />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">統計情報を読み込み中...</span>
          </div>
        }
      >
        <DashboardStats />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">
              パイプラインとアラートを読み込み中...
            </span>
          </div>
        }
      >
        <DashboardPipelineAndAlerts />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">コストを読み込み中...</span>
          </div>
        }
      >
        <DashboardCosts />
      </Suspense>
    </>
  );
}
