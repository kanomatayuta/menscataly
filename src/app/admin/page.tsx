import { Suspense } from "react";
import { headers } from "next/headers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { PipelineStatusCard } from "@/components/admin/PipelineStatusCard";
import { AlertsList } from "@/components/admin/AlertsList";
import {
  PipelineSuccessChart,
  generateDefaultPipelineData,
} from "@/components/admin/PipelineSuccessChart";
import type { AdminDashboardData } from "@/types/admin";

// ------------------------------------------------------------------
// Data fetching (Server Component - direct fetch to API route)
// ------------------------------------------------------------------

async function fetchDashboardData(): Promise<AdminDashboardData> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  const res = await fetch(`${protocol}://${host}/api/admin/dashboard`, {
    cache: "no-store",
    headers: {
      "X-Admin-Api-Key": process.env.ADMIN_API_KEY ?? "",
    },
  });

  if (!res.ok) {
    throw new Error(`Dashboard API returned ${res.status}`);
  }

  return res.json();
}

// ------------------------------------------------------------------
// Sub-components (async Server Components)
// ------------------------------------------------------------------

async function DashboardStats() {
  const data = await fetchDashboardData();
  const { articleStats, revenueSummary, costSummary } = data;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Articles"
        value={articleStats.totalArticles}
        subtitle={`${articleStats.publishedCount} published, ${articleStats.draftCount} drafts`}
      />
      <StatCard
        title="Revenue (30d)"
        value={`¥${revenueSummary.totalRevenue30d.toLocaleString()}`}
        subtitle={`${revenueSummary.totalConversions30d} conversions`}
        variant="success"
      />
      <StatCard
        title="Avg Compliance"
        value={`${articleStats.avgComplianceScore}%`}
        subtitle="Target: 95%"
        variant={
          articleStats.avgComplianceScore >= 95
            ? "success"
            : articleStats.avgComplianceScore >= 80
              ? "warning"
              : "danger"
        }
      />
      <StatCard
        title="AI Cost (30d)"
        value={`$${costSummary.totalCost30d.toFixed(2)}`}
        subtitle={`$${costSummary.avgCostPerArticle.toFixed(2)} per article`}
      />
    </div>
  );
}

async function DashboardPipelineAndAlerts() {
  const data = await fetchDashboardData();
  const { pipelineStatus, activeAlerts } = data;

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Pipeline status */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          Pipeline
        </h2>
        <PipelineStatusCard
          status={pipelineStatus.currentStatus}
          lastRunAt={pipelineStatus.lastRunAt}
          successRate={pipelineStatus.successRate7d}
        />
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-neutral-600">
            Success Rate (7 days)
          </h3>
          <PipelineSuccessChart data={generateDefaultPipelineData()} />
        </div>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          Active Alerts
        </h2>
        <AlertsList alerts={activeAlerts} />
      </div>
    </div>
  );
}

async function DashboardCosts() {
  const data = await fetchDashboardData();
  const { costSummary, articleStats } = data;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-neutral-800">
        Cost Breakdown (30d)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Article Generation"
          value={`$${costSummary.articleGenerationCost.toFixed(2)}`}
          subtitle={`${costSummary.totalCost30d > 0 ? ((costSummary.articleGenerationCost / costSummary.totalCost30d) * 100).toFixed(0) : 0}% of total`}
        />
        <StatCard
          title="Image Generation"
          value={`$${costSummary.imageGenerationCost.toFixed(2)}`}
          subtitle={`${costSummary.totalCost30d > 0 ? ((costSummary.imageGenerationCost / costSummary.totalCost30d) * 100).toFixed(0) : 0}% of total`}
        />
        <StatCard
          title="Pending Review"
          value={articleStats.pendingReviewCount}
          subtitle="Articles awaiting review"
          variant={articleStats.pendingReviewCount > 5 ? "warning" : "default"}
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
      <AdminHeader title="Dashboard" />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">Loading stats...</span>
          </div>
        }
      >
        <DashboardStats />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">
              Loading pipeline and alerts...
            </span>
          </div>
        }
      >
        <DashboardPipelineAndAlerts />
      </Suspense>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-neutral-500">Loading costs...</span>
          </div>
        }
      >
        <DashboardCosts />
      </Suspense>
    </>
  );
}
