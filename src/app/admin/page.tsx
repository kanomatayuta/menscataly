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
  const { articles, revenue, costs } = data;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Articles"
        value={articles.total}
        subtitle={`${articles.published} published, ${articles.draft} drafts`}
      />
      <StatCard
        title="Revenue (30d)"
        value={`¥${revenue.monthlyTotalJpy.toLocaleString()}`}
        subtitle={`${revenue.byAsp.reduce((sum, a) => sum + a.monthlyConversions, 0)} conversions`}
        variant="success"
      />
      <StatCard
        title="Avg Compliance"
        value={`${articles.avgComplianceScore}%`}
        subtitle="Target: 95%"
        variant={
          articles.avgComplianceScore >= 95
            ? "success"
            : articles.avgComplianceScore >= 80
              ? "warning"
              : "danger"
        }
      />
      <StatCard
        title="AI Cost (30d)"
        value={`$${costs.monthlyTotalUsd.toFixed(2)}`}
        subtitle={`$${costs.articleAvgUsd.toFixed(2)} per article`}
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
          Pipeline
        </h2>
        <PipelineStatusCard
          status={pipeline.status}
          lastRunAt={pipeline.lastRunAt ?? null}
          successRate={pipeline.totalRuns > 0 ? (pipeline.lastRunSuccess ? 100 : 50) : 0}
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
        Cost Breakdown (30d)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Article Generation"
          value={`$${estimatedArticleCost.toFixed(2)}`}
          subtitle={`${costs.monthlyTotalUsd > 0 ? ((estimatedArticleCost / costs.monthlyTotalUsd) * 100).toFixed(0) : 0}% of total`}
        />
        <StatCard
          title="Image Generation"
          value={`$${estimatedImageCost.toFixed(2)}`}
          subtitle={`${costs.monthlyTotalUsd > 0 ? ((estimatedImageCost / costs.monthlyTotalUsd) * 100).toFixed(0) : 0}% of total`}
        />
        <StatCard
          title="Pending Review"
          value={articles.pendingReview}
          subtitle="Articles awaiting review"
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
