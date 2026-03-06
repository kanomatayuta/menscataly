interface PipelineStatusCardProps {
  status: string;
  lastRunAt: string | null;
  successRate: number;
}

function getStatusColor(status: string): { dot: string; label: string } {
  switch (status) {
    case "success":
    case "idle":
      return { dot: "bg-green-500", label: "text-green-700" };
    case "failed":
      return { dot: "bg-red-500", label: "text-red-700" };
    case "running":
      return { dot: "bg-yellow-500", label: "text-yellow-700" };
    case "partial":
      return { dot: "bg-amber-500", label: "text-amber-700" };
    default:
      return { dot: "bg-slate-400", label: "text-slate-600" };
  }
}

export function PipelineStatusCard({
  status,
  lastRunAt,
  successRate,
}: PipelineStatusCardProps) {
  const colors = getStatusColor(status);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-500">
          Pipeline Status
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${colors.dot}`}
            aria-hidden="true"
          />
          <span className={`text-sm font-semibold capitalize ${colors.label}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Last run</span>
          <span className="font-medium text-slate-700">
            {lastRunAt
              ? new Date(lastRunAt).toLocaleString("ja-JP")
              : "Never"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Success rate (7d)</span>
          <span className="font-medium text-slate-700">
            {successRate.toFixed(1)}%
          </span>
        </div>

        {/* Success rate bar */}
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${
                successRate >= 90
                  ? "bg-green-500"
                  : successRate >= 70
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${Math.min(successRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
