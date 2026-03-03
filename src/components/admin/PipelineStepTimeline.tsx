import type { StepLog, StepStatus } from "@/lib/pipeline/types";

interface PipelineStepTimelineProps {
  steps: StepLog[];
}

const STATUS_CONFIG: Record<
  StepStatus,
  { icon: string; color: string; bgColor: string }
> = {
  pending: { icon: "○", color: "text-neutral-400", bgColor: "bg-neutral-100" },
  running: { icon: "●", color: "text-blue-500", bgColor: "bg-blue-100" },
  success: { icon: "✓", color: "text-green-600", bgColor: "bg-green-100" },
  failed: { icon: "✕", color: "text-red-600", bgColor: "bg-red-100" },
  skipped: { icon: "–", color: "text-neutral-400", bgColor: "bg-neutral-100" },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function PipelineStepTimeline({ steps }: PipelineStepTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
        <p className="text-sm text-neutral-500">No step data available</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-800">
        Pipeline Steps
      </h3>
      <div className="relative space-y-0">
        {steps.map((step, index) => {
          const config = STATUS_CONFIG[step.status];
          const isLast = index === steps.length - 1;

          return (
            <div key={step.stepName} className="relative flex gap-4">
              {/* Timeline line and icon */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${config.bgColor} ${config.color}`}
                >
                  {config.icon}
                </div>
                {!isLast && (
                  <div className="h-full w-px bg-neutral-200" />
                )}
              </div>

              {/* Step content */}
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-neutral-900">
                    {step.stepName}
                  </p>
                  <span
                    className={`text-xs font-medium capitalize ${config.color}`}
                  >
                    {step.status}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                  <span>Duration: {formatDuration(step.durationMs)}</span>
                  {step.startedAt && (
                    <span>
                      Started:{" "}
                      {new Date(step.startedAt).toLocaleTimeString("ja-JP")}
                    </span>
                  )}
                </div>
                {step.error && (
                  <p className="mt-1 text-xs text-red-600">{step.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
