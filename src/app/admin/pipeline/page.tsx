import { AdminHeader } from "@/components/admin/AdminHeader";
import { PipelineRunTable } from "@/components/admin/PipelineRunTable";
import { PipelineStepTimeline } from "@/components/admin/PipelineStepTimeline";
import { PipelineTriggerButton } from "@/components/admin/PipelineTriggerButton";
import type { PipelineStatus, PipelineType, StepLog } from "@/lib/pipeline/types";

// ------------------------------------------------------------------
// Mock data
// ------------------------------------------------------------------

interface MockPipelineRun {
  id: string;
  type: PipelineType;
  status: PipelineStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

const MOCK_RUNS: MockPipelineRun[] = [
  {
    id: "run-20260303-001",
    type: "daily",
    status: "success",
    startedAt: "2026-03-03T06:00:00+09:00",
    completedAt: "2026-03-03T06:30:00+09:00",
    durationMs: 1800000,
    error: null,
  },
  {
    id: "run-20260302-001",
    type: "daily",
    status: "partial",
    startedAt: "2026-03-02T06:00:00+09:00",
    completedAt: "2026-03-02T06:28:00+09:00",
    durationMs: 1680000,
    error: null,
  },
  {
    id: "run-20260301-001",
    type: "daily",
    status: "failed",
    startedAt: "2026-03-01T06:00:00+09:00",
    completedAt: "2026-03-01T06:15:00+09:00",
    durationMs: 900000,
    error: "Ideogram API returned 503 Service Unavailable",
  },
  {
    id: "run-20260228-001",
    type: "manual",
    status: "success",
    startedAt: "2026-02-28T14:00:00+09:00",
    completedAt: "2026-02-28T14:25:00+09:00",
    durationMs: 1500000,
    error: null,
  },
  {
    id: "run-20260228-pdca",
    type: "pdca",
    status: "success",
    startedAt: "2026-02-28T23:00:00+09:00",
    completedAt: "2026-02-28T23:10:00+09:00",
    durationMs: 600000,
    error: null,
  },
];

const MOCK_LATEST_STEPS: StepLog[] = [
  {
    stepName: "Trend Analysis",
    status: "success",
    startedAt: "2026-03-03T06:00:00+09:00",
    completedAt: "2026-03-03T06:05:00+09:00",
    durationMs: 300000,
    error: null,
    metadata: { keywordsFound: 5 },
  },
  {
    stepName: "Content Generation",
    status: "success",
    startedAt: "2026-03-03T06:05:00+09:00",
    completedAt: "2026-03-03T06:18:00+09:00",
    durationMs: 780000,
    error: null,
    metadata: { articlesGenerated: 2 },
  },
  {
    stepName: "Compliance Check",
    status: "success",
    startedAt: "2026-03-03T06:18:00+09:00",
    completedAt: "2026-03-03T06:20:00+09:00",
    durationMs: 120000,
    error: null,
    metadata: { avgScore: 94.5 },
  },
  {
    stepName: "Image Generation",
    status: "success",
    startedAt: "2026-03-03T06:20:00+09:00",
    completedAt: "2026-03-03T06:25:00+09:00",
    durationMs: 300000,
    error: null,
    metadata: { imagesGenerated: 4 },
  },
  {
    stepName: "Publish to microCMS",
    status: "success",
    startedAt: "2026-03-03T06:25:00+09:00",
    completedAt: "2026-03-03T06:30:00+09:00",
    durationMs: 300000,
    error: null,
    metadata: { articlesPublished: 2 },
  },
];

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export default function AdminPipelinePage() {
  return (
    <>
      <AdminHeader
        title="Pipeline"
        breadcrumbs={[{ label: "Pipeline" }]}
      />

      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Pipeline execution history and manual trigger
        </p>
        <PipelineTriggerButton />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Run history */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Run History
          </h2>
          <PipelineRunTable runs={MOCK_RUNS} />
        </div>

        {/* Latest run steps */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-neutral-800">
            Latest Run Steps
          </h2>
          <PipelineStepTimeline steps={MOCK_LATEST_STEPS} />
        </div>
      </div>
    </>
  );
}
