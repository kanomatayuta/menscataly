import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { StatCard } from "@/components/admin/StatCard";
import { PipelineStatusCard } from "@/components/admin/PipelineStatusCard";
import { AlertsList } from "@/components/admin/AlertsList";
import type { MonitoringAlert } from "@/types/admin";

// ------------------------------------------------------------------
// Mock data (inline — will be replaced by API calls in Phase 3)
// ------------------------------------------------------------------

const MOCK_ARTICLE_STATS = {
  totalArticles: 47,
  publishedCount: 38,
  draftCount: 5,
  pendingReviewCount: 4,
  avgComplianceScore: 94.2,
};

const MOCK_REVENUE = {
  totalRevenue30d: 128500,
  totalClicks30d: 4230,
  totalConversions30d: 52,
  topAsp: "afb",
};

const MOCK_COST = {
  totalCost30d: 12.45,
  articleGenerationCost: 8.3,
  imageGenerationCost: 3.15,
  avgCostPerArticle: 0.26,
};

const MOCK_PIPELINE = {
  currentStatus: "idle" as const,
  lastRunAt: "2026-03-03T06:30:00+09:00",
  lastRunDurationMs: 84000,
  successRate7d: 92.5,
};

const MOCK_ALERTS: MonitoringAlert[] = [
  {
    id: "alert-1",
    type: "compliance_violation",
    severity: "warning",
    status: "active",
    title: "Compliance score below threshold",
    message:
      "Article 'AGA治療の最新ガイド' has a compliance score of 78, below the 80 threshold.",
    metadata: { articleId: "art-12", score: 78 },
    createdAt: "2026-03-03T07:15:00+09:00",
    acknowledgedAt: null,
    resolvedAt: null,
  },
  {
    id: "alert-2",
    type: "cost_threshold",
    severity: "info",
    status: "active",
    title: "Monthly cost approaching limit",
    message: "AI generation costs are at 85% of the monthly budget ($12.45 / $15.00).",
    metadata: { currentCost: 12.45, budgetLimit: 15.0 },
    createdAt: "2026-03-02T23:00:00+09:00",
    acknowledgedAt: null,
    resolvedAt: null,
  },
  {
    id: "alert-3",
    type: "pipeline_failure",
    severity: "critical",
    status: "active",
    title: "Pipeline step failed: image_generation",
    message: "Ideogram API returned 503 during daily pipeline run.",
    metadata: { stepName: "image_generation", errorCode: 503 },
    createdAt: "2026-03-01T06:45:00+09:00",
    acknowledgedAt: null,
    resolvedAt: null,
  },
];

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

function DashboardStats() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Articles"
        value={MOCK_ARTICLE_STATS.totalArticles}
        subtitle={`${MOCK_ARTICLE_STATS.publishedCount} published, ${MOCK_ARTICLE_STATS.draftCount} drafts`}
      />
      <StatCard
        title="Revenue (30d)"
        value={`¥${MOCK_REVENUE.totalRevenue30d.toLocaleString()}`}
        subtitle={`${MOCK_REVENUE.totalConversions30d} conversions`}
        variant="success"
      />
      <StatCard
        title="Avg Compliance"
        value={`${MOCK_ARTICLE_STATS.avgComplianceScore}%`}
        subtitle="Target: 95%"
        variant={
          MOCK_ARTICLE_STATS.avgComplianceScore >= 95
            ? "success"
            : MOCK_ARTICLE_STATS.avgComplianceScore >= 80
              ? "warning"
              : "danger"
        }
      />
      <StatCard
        title="AI Cost (30d)"
        value={`$${MOCK_COST.totalCost30d.toFixed(2)}`}
        subtitle={`$${MOCK_COST.avgCostPerArticle.toFixed(2)} per article`}
      />
    </div>
  );
}

function DashboardPipelineAndAlerts() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Pipeline status */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          Pipeline
        </h2>
        <PipelineStatusCard
          status={MOCK_PIPELINE.currentStatus}
          lastRunAt={MOCK_PIPELINE.lastRunAt}
          successRate={MOCK_PIPELINE.successRate7d}
        />
      </div>

      {/* Alerts */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-neutral-800">
          Active Alerts
        </h2>
        <AlertsList alerts={MOCK_ALERTS} />
      </div>
    </div>
  );
}

function DashboardCosts() {
  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-neutral-800">
        Cost Breakdown (30d)
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Article Generation"
          value={`$${MOCK_COST.articleGenerationCost.toFixed(2)}`}
          subtitle={`${((MOCK_COST.articleGenerationCost / MOCK_COST.totalCost30d) * 100).toFixed(0)}% of total`}
        />
        <StatCard
          title="Image Generation"
          value={`$${MOCK_COST.imageGenerationCost.toFixed(2)}`}
          subtitle={`${((MOCK_COST.imageGenerationCost / MOCK_COST.totalCost30d) * 100).toFixed(0)}% of total`}
        />
        <StatCard
          title="Pending Review"
          value={MOCK_ARTICLE_STATS.pendingReviewCount}
          subtitle="Articles awaiting review"
          variant={MOCK_ARTICLE_STATS.pendingReviewCount > 5 ? "warning" : "default"}
        />
      </div>
    </div>
  );
}

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
